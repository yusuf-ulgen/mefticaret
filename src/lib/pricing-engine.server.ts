/**
 * PriceCalculationEngine — fiyatın TEK yetkili kaynağı (server-side authoritative).
 *
 * Öncelik sırası (yüksekten düşüğe):
 *   1) Manuel ürün/varyant market fiyatı (product_market_prices, source = manual)
 *   2) Market'e bağlı fiyat listesi kalemi (price_list_items)
 *   3) Aktif kampanya kuru/marjı ile çevrim (pricing_campaigns)
 *   4) Otomatik çevrim: kur → para birimi marjı → market marjı → yuvarlama
 * Sonrasında pricing_rules (IF/THEN) uygulanır, ardından minimum kâr marjı ve
 * maksimum fiyat değişimi korumaları çalışır.
 *
 * Frontend'den gelen fiyat/kur/indirim değerlerine asla güvenilmez.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  applyRounding,
  applyMarkup,
  convertPrice,
  currencyDecimals,
  isRateStale,
  marginPercent,
  type MarkupType,
  type PriceSource,
  type RoundingMode,
} from "@/lib/pricing-engine";
import { buildRateTable, resolveRate, type RateRow } from "@/lib/money";

type Client = SupabaseClient<Database>;

export type MarketRow = {
  id: string;
  name: string;
  code: string;
  country_code: string | null;
  currency: string;
  locale: string | null;
  domain: string | null;
  url_prefix: string | null;
  tax_included: boolean;
  tax_class_id: string | null;
  price_list_id: string | null;
  markup_type: MarkupType;
  markup_value: number;
  rounding: RoundingMode;
  is_default: boolean;
  is_active: boolean;
};

export type PricingContext = {
  storeId: string;
  baseCurrency: string;
  currency: string;
  decimals: number;
  market: MarketRow | null;
  rate: number;
  rateSource: "base" | "manual" | "auto" | "campaign" | "missing";
  rateStale: boolean;
  currencyMarkup: { type: MarkupType; value: number };
  rounding: RoundingMode;
  marketMarkup: { type: MarkupType; value: number };
  minMarginPercent: number | null;
  maxChangePercent: number | null;
  priceListId: string | null;
  campaign: { id: string; name: string } | null;
  symbol: string | null;
  symbolPosition: string | null;
};

export type PriceInput = {
  productId: string;
  variantId?: string | null;
  basePrice: number;
  baseCompareAt?: number | null;
  cost?: number | null;
  categoryIds?: string[];
  quantity?: number;
};

export type PriceResult = {
  productId: string;
  variantId: string | null;
  currency: string;
  price: number;
  compareAtPrice: number | null;
  basePrice: number;
  exchangeRate: number;
  source: PriceSource;
  rounding: RoundingMode;
  marginPercent: number | null;
  marginWarning: boolean;
  changeGuardApplied: boolean;
  rateStale: boolean;
};

type Overrides = {
  marketPrices: Map<string, { price: number; compareAt: number | null; source: string }>;
  listPrices: Map<string, { price: number; compareAt: number | null }>;
  rules: RuleRow[];
};

export type RuleRow = {
  id: string;
  name: string;
  priority: number;
  conditions: Record<string, unknown>;
  actions: Record<string, unknown>;
  starts_at: string | null;
  ends_at: string | null;
};

function key(productId: string, variantId?: string | null): string {
  return `${productId}::${variantId ?? ""}`;
}

function activeWindow(startsAt: string | null, endsAt: string | null, now = Date.now()): boolean {
  if (startsAt && new Date(startsAt).getTime() > now) return false;
  if (endsAt && new Date(endsAt).getTime() < now) return false;
  return true;
}

/** Ülke koduna göre market çözer; yoksa varsayılan market kullanılır. */
export async function resolveMarket(
  supabase: Client,
  storeId: string,
  options: { marketId?: string | null; countryCode?: string | null; currency?: string | null },
): Promise<MarketRow | null> {
  const { data, error } = await supabase
    .from("markets")
    .select(
      "id, name, code, country_code, currency, locale, domain, url_prefix, tax_included, tax_class_id, price_list_id, markup_type, markup_value, rounding, is_default, is_active, sort_order",
    )
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw new Error(error.message);
  const markets = (data ?? []) as unknown as MarketRow[];
  if (markets.length === 0) return null;

  if (options.marketId) {
    const found = markets.find((market) => market.id === options.marketId);
    if (found) return found;
  }

  const country = options.countryCode?.toUpperCase() ?? null;
  if (country) {
    const direct = markets.find((market) => market.country_code?.toUpperCase() === country);
    if (direct) return direct;
    const { data: mapped } = await supabase
      .from("market_countries")
      .select("market_id")
      .eq("store_id", storeId)
      .eq("country_code", country);
    for (const row of mapped ?? []) {
      const found = markets.find((market) => market.id === row.market_id);
      if (found) return found;
    }
  }

  if (options.currency) {
    const byCurrency = markets.find(
      (market) => market.currency.toUpperCase() === options.currency?.toUpperCase(),
    );
    if (byCurrency) return byCurrency;
  }

  return markets.find((market) => market.is_default) ?? markets[0] ?? null;
}

/** Fiyat hesaplaması için gereken tüm ayar/kur/kampanya verisini tek seferde yükler. */
export async function loadPricingContext(
  supabase: Client,
  storeId: string,
  options: {
    marketId?: string | null;
    countryCode?: string | null;
    currency?: string | null;
  } = {},
): Promise<PricingContext> {
  const market = await resolveMarket(supabase, storeId, options);
  const targetCurrency = (options.currency ?? market?.currency ?? "TRY").toUpperCase();

  const [settingsRes, currencyRes, ratesRes, campaignRes, platformRes] = await Promise.all([
    supabase
      .from("store_pricing_settings")
      .select(
        "base_currency, default_markup_type, default_markup_value, default_rounding, min_margin_percent, max_change_percent, stale_after_hours, last_rate_sync_at",
      )
      .eq("store_id", storeId)
      .maybeSingle(),
    supabase
      .from("store_currencies")
      .select(
        "currency, is_active, is_base, markup_type, markup_value, rounding, manual_rate, use_manual_rate, symbol_position",
      )
      .eq("store_id", storeId)
      .eq("currency", targetCurrency)
      .maybeSingle(),
    supabase
      .from("currency_rates")
      .select("base_currency, quote_currency, rate, source, fetched_at")
      .eq("store_id", storeId),
    supabase
      .from("pricing_campaigns")
      .select("id, name, currency, rate, markup_type, markup_value, rounding, market_id, price_list_id, starts_at, ends_at")
      .eq("store_id", storeId)
      .eq("is_active", true),
    supabase
      .from("platform_currencies")
      .select("code, symbol, decimals, symbol_position")
      .eq("code", targetCurrency)
      .maybeSingle(),
  ]);

  const settings = settingsRes.data;
  const baseCurrency = (settings?.base_currency ?? "TRY").toUpperCase();
  const rateRows = (ratesRes.data ?? []) as RateRow[];
  const table = buildRateTable(rateRows);

  const campaign =
    (campaignRes.data ?? []).find(
      (row) =>
        activeWindow(row.starts_at, row.ends_at) &&
        row.currency.toUpperCase() === targetCurrency &&
        (!row.market_id || row.market_id === market?.id),
    ) ?? null;

  let rate = 1;
  let rateSource: PricingContext["rateSource"] = "base";
  if (targetCurrency !== baseCurrency) {
    if (campaign && Number(campaign.rate ?? 0) > 0) {
      rate = Number(campaign.rate);
      rateSource = "campaign";
    } else if (currencyRes.data?.use_manual_rate && Number(currencyRes.data.manual_rate ?? 0) > 0) {
      rate = Number(currencyRes.data.manual_rate);
      rateSource = "manual";
    } else {
      const resolved = resolveRate(table, baseCurrency, targetCurrency);
      if (resolved && resolved > 0) {
        rate = resolved;
        rateSource = "auto";
      } else {
        rate = 0;
        rateSource = "missing";
      }
    }
  }

  const latestFetch = rateRows
    .filter((row) => row.quote_currency?.toUpperCase() === targetCurrency)
    .map((row) => row.fetched_at)
    .sort()
    .at(-1);

  const currencyMarkup = {
    type: (campaign?.markup_type ??
      currencyRes.data?.markup_type ??
      settings?.default_markup_type ??
      "none") as MarkupType,
    value: Number(campaign?.markup_value ?? currencyRes.data?.markup_value ?? settings?.default_markup_value ?? 0),
  };

  return {
    storeId,
    baseCurrency,
    currency: targetCurrency,
    decimals: platformRes.data?.decimals ?? currencyDecimals(targetCurrency),
    market,
    rate,
    rateSource,
    rateStale:
      targetCurrency !== baseCurrency &&
      rateSource === "auto" &&
      isRateStale(latestFetch ?? null, settings?.stale_after_hours ?? 36),
    currencyMarkup,
    rounding: (campaign?.rounding ??
      currencyRes.data?.rounding ??
      settings?.default_rounding ??
      "none") as RoundingMode,
    marketMarkup: {
      type: (market?.markup_type ?? "none") as MarkupType,
      value: Number(market?.markup_value ?? 0),
    },
    minMarginPercent:
      settings?.min_margin_percent === null || settings?.min_margin_percent === undefined
        ? null
        : Number(settings.min_margin_percent),
    maxChangePercent:
      settings?.max_change_percent === null || settings?.max_change_percent === undefined
        ? null
        : Number(settings.max_change_percent),
    priceListId: campaign?.price_list_id ?? market?.price_list_id ?? null,
    campaign: campaign ? { id: campaign.id, name: campaign.name } : null,
    symbol: platformRes.data?.symbol ?? null,
    symbolPosition: platformRes.data?.symbol_position ?? currencyRes.data?.symbol_position ?? "before",
  };
}

async function loadOverrides(
  supabase: Client,
  context: PricingContext,
  items: PriceInput[],
): Promise<Overrides> {
  const productIds = [...new Set(items.map((item) => item.productId))];
  const marketPrices = new Map<string, { price: number; compareAt: number | null; source: string }>();
  const listPrices = new Map<string, { price: number; compareAt: number | null }>();

  const [marketRes, listRes, ruleRes] = await Promise.all([
    context.market
      ? supabase
          .from("product_market_prices")
          .select("product_id, variant_id, price, compare_at_price, source, currency")
          .eq("store_id", context.storeId)
          .eq("market_id", context.market.id)
          .eq("currency", context.currency)
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as never[] }),
    context.priceListId
      ? supabase
          .from("price_list_items")
          .select("product_id, variant_id, price, compare_at_price, currency")
          .eq("store_id", context.storeId)
          .eq("price_list_id", context.priceListId)
          .eq("currency", context.currency)
          .in("product_id", productIds)
      : Promise.resolve({ data: [] as never[] }),
    supabase
      .from("pricing_rules")
      .select("id, name, priority, conditions, actions, starts_at, ends_at")
      .eq("store_id", context.storeId)
      .eq("is_active", true)
      .order("priority", { ascending: false }),
  ]);

  for (const row of (marketRes.data ?? []) as {
    product_id: string;
    variant_id: string | null;
    price: number;
    compare_at_price: number | null;
    source: string;
  }[]) {
    marketPrices.set(key(row.product_id, row.variant_id), {
      price: Number(row.price),
      compareAt: row.compare_at_price === null ? null : Number(row.compare_at_price),
      source: row.source,
    });
  }
  for (const row of (listRes.data ?? []) as {
    product_id: string;
    variant_id: string | null;
    price: number;
    compare_at_price: number | null;
  }[]) {
    listPrices.set(key(row.product_id, row.variant_id), {
      price: Number(row.price),
      compareAt: row.compare_at_price === null ? null : Number(row.compare_at_price),
    });
  }

  const rules = ((ruleRes.data ?? []) as unknown as RuleRow[]).filter((rule) =>
    activeWindow(rule.starts_at, rule.ends_at),
  );

  return { marketPrices, listPrices, rules };
}

function matchesRule(rule: RuleRow, context: PricingContext, item: PriceInput, price: number): boolean {
  const c = rule.conditions ?? {};
  const list = (value: unknown): string[] => (Array.isArray(value) ? value.map(String) : []);

  const productIds = list(c["productIds"]);
  if (productIds.length > 0 && !productIds.includes(item.productId)) return false;

  const categoryIds = list(c["categoryIds"]);
  if (categoryIds.length > 0 && !(item.categoryIds ?? []).some((id) => categoryIds.includes(id))) return false;

  const marketIds = list(c["marketIds"]);
  if (marketIds.length > 0 && !(context.market && marketIds.includes(context.market.id))) return false;

  const currencies = list(c["currencies"]).map((code) => code.toUpperCase());
  if (currencies.length > 0 && !currencies.includes(context.currency)) return false;

  const countries = list(c["countries"]).map((code) => code.toUpperCase());
  if (countries.length > 0 && !(context.market?.country_code && countries.includes(context.market.country_code.toUpperCase())))
    return false;

  const minPrice = Number(c["minPrice"] ?? Number.NaN);
  if (Number.isFinite(minPrice) && price < minPrice) return false;
  const maxPrice = Number(c["maxPrice"] ?? Number.NaN);
  if (Number.isFinite(maxPrice) && price > maxPrice) return false;

  const minQty = Number(c["minQuantity"] ?? Number.NaN);
  if (Number.isFinite(minQty) && (item.quantity ?? 1) < minQty) return false;

  return true;
}

function applyRuleActions(rule: RuleRow, price: number, decimals: number): number {
  const actions = rule.actions ?? {};
  const type = String(actions["type"] ?? "none");
  const value = Number(actions["value"] ?? 0);
  let next = price;
  if (type === "increase_percent") next = applyMarkup(price, "percent", value);
  else if (type === "decrease_percent") next = applyMarkup(price, "percent", -value);
  else if (type === "increase_amount") next = applyMarkup(price, "fixed", value);
  else if (type === "decrease_amount") next = applyMarkup(price, "fixed", -value);
  else if (type === "set") next = value;
  const rounding = actions["rounding"];
  if (typeof rounding === "string") next = applyRounding(next, rounding as RoundingMode, decimals);
  return Math.max(0, next);
}

/** Bir ürün/varyant listesi için yetkili fiyatları hesaplar. */
export async function calculatePrices(
  supabase: Client,
  context: PricingContext,
  items: PriceInput[],
): Promise<PriceResult[]> {
  if (items.length === 0) return [];
  const overrides = await loadOverrides(supabase, context, items);

  return items.map((item) => {
    const basePrice = Number(item.basePrice ?? 0);
    const decimals = context.decimals;
    let source: PriceSource = "base";
    let price: number;
    let compareAt: number | null = null;

    const manual = overrides.marketPrices.get(key(item.productId, item.variantId));
    const list = overrides.listPrices.get(key(item.productId, item.variantId));

    if (manual && manual.source === "manual") {
      price = manual.price;
      compareAt = manual.compareAt;
      source = "manual";
    } else if (list) {
      price = list.price;
      compareAt = list.compareAt;
      source = "price_list";
    } else if (context.currency === context.baseCurrency) {
      price = applyRounding(
        applyMarkup(basePrice, context.marketMarkup.type, context.marketMarkup.value),
        context.rounding,
        decimals,
      );
      compareAt =
        item.baseCompareAt && item.baseCompareAt > 0
          ? applyRounding(Number(item.baseCompareAt), context.rounding, decimals)
          : null;
      source = "base";
    } else {
      const converted = convertPrice({
        baseAmount: applyMarkup(basePrice, context.marketMarkup.type, context.marketMarkup.value),
        rate: context.rate,
        markupType: context.currencyMarkup.type,
        markupValue: context.currencyMarkup.value,
        rounding: context.rounding,
        decimals,
      });
      price = converted.amount;
      compareAt =
        item.baseCompareAt && item.baseCompareAt > 0
          ? convertPrice({
              baseAmount: Number(item.baseCompareAt),
              rate: context.rate,
              markupType: context.currencyMarkup.type,
              markupValue: context.currencyMarkup.value,
              rounding: context.rounding,
              decimals,
            }).amount
          : null;
      source = context.rateSource === "campaign" ? "campaign" : "auto";
    }

    // IF/THEN kuralları (yalnızca manuel fiyatlar hariç, öncelik sırasına göre)
    if (source !== "manual") {
      for (const rule of overrides.rules) {
        if (!matchesRule(rule, context, item, price)) continue;
        price = applyRuleActions(rule, price, decimals);
        source = "rule";
      }
    }

    // Kâr koruması: minimum marj altına düşen fiyat yükseltilir.
    let margin = marginPercent(price, Number(item.cost ?? 0));
    let marginWarning = false;
    if (context.minMarginPercent !== null && item.cost && item.cost > 0) {
      const minPrice = Number(item.cost) / (1 - context.minMarginPercent / 100);
      const converted =
        context.currency === context.baseCurrency ? minPrice : minPrice * (context.rate || 1);
      if (price < converted) {
        price = applyRounding(converted, context.rounding, decimals);
        marginWarning = true;
        margin = marginPercent(price, Number(item.cost));
      }
    }

    // Maksimum fiyat değişimi koruması (temel fiyata göre aşırı sapma).
    let changeGuardApplied = false;
    if (context.maxChangePercent !== null && basePrice > 0 && context.currency === context.baseCurrency) {
      const limit = basePrice * (1 + context.maxChangePercent / 100);
      const floor = basePrice * (1 - context.maxChangePercent / 100);
      if (price > limit) {
        price = applyRounding(limit, context.rounding, decimals);
        changeGuardApplied = true;
      } else if (price < floor) {
        price = applyRounding(floor, context.rounding, decimals);
        changeGuardApplied = true;
      }
    }

    if (compareAt !== null && compareAt <= price) compareAt = null;

    return {
      productId: item.productId,
      variantId: item.variantId ?? null,
      currency: context.currency,
      price: Number(price.toFixed(decimals)),
      compareAtPrice: compareAt === null ? null : Number(compareAt.toFixed(decimals)),
      basePrice,
      exchangeRate: context.rate,
      source,
      rounding: context.rounding,
      marginPercent: margin,
      marginWarning,
      changeGuardApplied,
      rateStale: context.rateStale,
    };
  });
}

/** Kolaylık: tek ürün için fiyat. */
export async function calculatePrice(
  supabase: Client,
  context: PricingContext,
  item: PriceInput,
): Promise<PriceResult> {
  const [result] = await calculatePrices(supabase, context, [item]);
  if (!result) throw new Error("Fiyat hesaplanamadı");
  return result;
}

/** Kasa kilidi: hesaplanan fiyatlar sipariş/sepet için anlık görüntüye yazılır. */
export async function lockPriceSnapshot(
  supabase: Client,
  params: {
    storeId: string;
    marketId: string | null;
    cartToken?: string | null;
    orderId?: string | null;
    currency: string;
    exchangeRate: number;
    rateSource: string;
    payload: unknown;
    ttlMinutes?: number;
  },
): Promise<string | null> {
  const expiresAt = new Date(Date.now() + (params.ttlMinutes ?? 30) * 60_000).toISOString();
  const { data, error } = await supabase
    .from("price_snapshots")
    .insert({
      store_id: params.storeId,
      market_id: params.marketId,
      cart_token: params.cartToken ?? null,
      order_id: params.orderId ?? null,
      currency: params.currency,
      exchange_rate: params.exchangeRate,
      rate_source: params.rateSource,
      payload: params.payload as never,
      expires_at: expiresAt,
    } as never)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}
