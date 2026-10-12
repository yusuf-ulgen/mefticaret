import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStoreManager } from "@/lib/store-access.server";

/**
 * Markets & Pricing yönetim uçları. Tüm yazma işlemleri oturum + mağaza yöneticisi
 * doğrulamasından geçer; fiyat hesaplamaları yalnızca sunucudaki motorla yapılır.
 */

const markupType = z.enum(["none", "fixed", "percent"]);
const rounding = z.enum([
  "none",
  "nearest_0_01",
  "nearest_0_05",
  "nearest_0_10",
  "nearest_1",
  "nearest_5",
  "nearest_10",
  "psych_99",
  "psych_95",
  "psych_90",
]);

export const savePricingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        baseCurrency: z.string().length(3),
        updateFrequency: z.enum(["manual", "hourly", "six_hourly", "daily"]),
        defaultMarkupType: markupType,
        defaultMarkupValue: z.number().min(-100).max(1000),
        defaultRounding: rounding,
        minMarginPercent: z.number().min(0).max(95).nullable(),
        maxChangePercent: z.number().min(0).max(500).nullable(),
        requireApproval: z.boolean(),
        staleAfterHours: z.number().int().min(1).max(720),
        geolocationEnabled: z.boolean(),
        providerCode: z.string().max(40).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase.from("store_pricing_settings").upsert(
      {
        store_id: data.storeId,
        base_currency: data.baseCurrency.toUpperCase(),
        update_frequency: data.updateFrequency,
        default_markup_type: data.defaultMarkupType,
        default_markup_value: data.defaultMarkupValue,
        default_rounding: data.defaultRounding,
        min_margin_percent: data.minMarginPercent,
        max_change_percent: data.maxChangePercent,
        require_approval: data.requireApproval,
        stale_after_hours: data.staleAfterHours,
        geolocation_enabled: data.geolocationEnabled,
        provider_code: data.providerCode,
      } as never,
      { onConflict: "store_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveStoreCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        currency: z.string().length(3),
        isActive: z.boolean(),
        markupType: markupType,
        markupValue: z.number().min(-100).max(1000),
        rounding: rounding,
        useManualRate: z.boolean(),
        manualRate: z.number().min(0).max(1_000_000).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    if (data.useManualRate && !(data.manualRate && data.manualRate > 0)) {
      throw new Error("Manuel kur için sıfırdan büyük bir değer girin.");
    }
    const { error } = await context.supabase.from("store_currencies").upsert(
      {
        store_id: data.storeId,
        currency: data.currency.toUpperCase(),
        is_active: data.isActive,
        markup_type: data.markupType,
        markup_value: data.markupValue,
        rounding: data.rounding,
        use_manual_rate: data.useManualRate,
        manual_rate: data.manualRate,
      } as never,
      { onConflict: "store_id,currency" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeStoreCurrency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), currency: z.string().length(3) }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("store_currencies")
      .delete()
      .eq("store_id", data.storeId)
      .eq("currency", data.currency.toUpperCase())
      .eq("is_base", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        id: z.guid().nullable(),
        name: z.string().min(2).max(80),
        code: z.string().min(2).max(30),
        countryCode: z.string().length(2).nullable(),
        currency: z.string().length(3),
        locale: z.string().max(10).nullable(),
        domain: z.string().max(200).nullable(),
        urlPrefix: z.string().max(40).nullable(),
        taxIncluded: z.boolean(),
        priceListId: z.guid().nullable(),
        markupType: markupType,
        markupValue: z.number().min(-100).max(1000),
        rounding: rounding,
        isDefault: z.boolean(),
        isActive: z.boolean(),
        countries: z.array(z.string().length(2)).max(250),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const payload = {
      store_id: data.storeId,
      name: data.name,
      code: data.code.toLowerCase(),
      country_code: data.countryCode?.toUpperCase() ?? null,
      currency: data.currency.toUpperCase(),
      locale: data.locale,
      domain: data.domain,
      url_prefix: data.urlPrefix,
      tax_included: data.taxIncluded,
      price_list_id: data.priceListId,
      markup_type: data.markupType,
      markup_value: data.markupValue,
      rounding: data.rounding,
      is_default: data.isDefault,
      is_active: data.isActive,
    };

    let marketId = data.id;
    if (marketId) {
      const { error } = await context.supabase
        .from("markets")
        .update(payload as never)
        .eq("id", marketId)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await context.supabase
        .from("markets")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      marketId = inserted.id;
    }

    if (data.isDefault) {
      await context.supabase
        .from("markets")
        .update({ is_default: false } as never)
        .eq("store_id", data.storeId)
        .neq("id", marketId);
    }

    await context.supabase.from("market_countries").delete().eq("market_id", marketId);
    if (data.countries.length > 0) {
      const rows = [...new Set(data.countries.map((code) => code.toUpperCase()))].map((code) => ({
        store_id: data.storeId,
        market_id: marketId,
        country_code: code,
      }));
      const { error } = await context.supabase.from("market_countries").insert(rows as never);
      if (error) throw new Error(error.message);
    }

    return { id: marketId };
  });

export const removeMarket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("markets")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const savePriceList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        id: z.guid().nullable(),
        name: z.string().min(2).max(80),
        code: z.string().min(2).max(40),
        currency: z.string().length(3),
        kind: z.enum(["retail", "wholesale", "b2b", "campaign", "vip"]),
        isActive: z.boolean(),
        startsAt: z.string().nullable(),
        endsAt: z.string().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const payload = {
      store_id: data.storeId,
      name: data.name,
      code: data.code.toLowerCase(),
      currency: data.currency.toUpperCase(),
      kind: data.kind,
      is_active: data.isActive,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("price_lists")
        .update(payload as never)
        .eq("id", data.id)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("price_lists")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const savePriceListItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        priceListId: z.guid(),
        currency: z.string().length(3),
        items: z
          .array(
            z.object({
              productId: z.guid(),
              variantId: z.guid().nullable(),
              price: z.number().min(0).max(99_999_999),
              compareAtPrice: z.number().min(0).max(99_999_999).nullable(),
            }),
          )
          .min(1)
          .max(1000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const rows = data.items.map((item) => ({
      store_id: data.storeId,
      price_list_id: data.priceListId,
      product_id: item.productId,
      variant_id: item.variantId,
      currency: data.currency.toUpperCase(),
      price: item.price,
      compare_at_price: item.compareAtPrice,
    }));
    const { error } = await context.supabase
      .from("price_list_items")
      .upsert(rows as never, { onConflict: "price_list_id,product_id,variant_id,currency" });
    if (error) throw new Error(error.message);
    return { count: rows.length };
  });

export const saveMarketPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        marketId: z.guid(),
        currency: z.string().length(3),
        source: z.enum(["manual", "auto"]),
        reason: z.string().max(200).nullable(),
        items: z
          .array(
            z.object({
              productId: z.guid(),
              variantId: z.guid().nullable(),
              price: z.number().min(0).max(99_999_999),
              compareAtPrice: z.number().min(0).max(99_999_999).nullable(),
            }),
          )
          .min(1)
          .max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const currency = data.currency.toUpperCase();

    const { data: existing } = await context.supabase
      .from("product_market_prices")
      .select("product_id, variant_id, price")
      .eq("store_id", data.storeId)
      .eq("market_id", data.marketId)
      .eq("currency", currency)
      .in(
        "product_id",
        data.items.map((item) => item.productId),
      );

    const rows = data.items.map((item) => ({
      store_id: data.storeId,
      market_id: data.marketId,
      product_id: item.productId,
      variant_id: item.variantId,
      currency,
      price: item.price,
      compare_at_price: item.compareAtPrice,
      source: data.source,
    }));

    const { error } = await context.supabase
      .from("product_market_prices")
      .upsert(rows as never, { onConflict: "market_id,product_id,variant_id,currency" });
    if (error) throw new Error(error.message);

    const logs = data.items.map((item) => {
      const previous = (existing ?? []).find(
        (row) => row.product_id === item.productId && (row.variant_id ?? null) === item.variantId,
      );
      return {
        store_id: data.storeId,
        user_id: context.userId,
        product_id: item.productId,
        variant_id: item.variantId,
        market_id: data.marketId,
        currency,
        old_price: previous ? Number(previous.price) : null,
        new_price: item.price,
        reason: data.reason,
        source: data.source,
      };
    });
    await context.supabase.from("pricing_audit_logs").insert(logs as never);

    return { count: rows.length };
  });

export const savePricingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        id: z.guid().nullable(),
        name: z.string().min(2).max(80),
        description: z.string().max(400).nullable(),
        priority: z.number().int().min(0).max(1000),
        isActive: z.boolean(),
        conditions: z.record(z.string(), z.unknown()),
        actions: z.record(z.string(), z.unknown()),
        startsAt: z.string().nullable(),
        endsAt: z.string().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const payload = {
      store_id: data.storeId,
      name: data.name,
      description: data.description,
      priority: data.priority,
      is_active: data.isActive,
      conditions: data.conditions,
      actions: data.actions,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("pricing_rules")
        .update(payload as never)
        .eq("id", data.id)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("pricing_rules")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const removePricingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("pricing_rules")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const savePricingCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        id: z.guid().nullable(),
        name: z.string().min(2).max(80),
        currency: z.string().length(3),
        rate: z.number().min(0).max(1_000_000).nullable(),
        markupType: markupType,
        markupValue: z.number().min(-100).max(1000),
        rounding: rounding,
        marketId: z.guid().nullable(),
        priceListId: z.guid().nullable(),
        startsAt: z.string().nullable(),
        endsAt: z.string().nullable(),
        isActive: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const payload = {
      store_id: data.storeId,
      name: data.name,
      currency: data.currency.toUpperCase(),
      rate: data.rate,
      markup_type: data.markupType,
      markup_value: data.markupValue,
      rounding: data.rounding,
      market_id: data.marketId,
      price_list_id: data.priceListId,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      is_active: data.isActive,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("pricing_campaigns")
        .update(payload as never)
        .eq("id", data.id)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await context.supabase
      .from("pricing_campaigns")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const removePricingCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("pricing_campaigns")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Kur güncelleme (manuel tetikleme). Sağlayıcı zinciri ve failover sunucuda çalışır. */
export const refreshExchangeRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncStoreRates } = await import("@/lib/exchange-rates.server");
    const result = await syncStoreRates(supabaseAdmin, data.storeId);
    return {
      base: result.base,
      provider: result.provider,
      updated: result.updated.length,
      skippedManual: result.skippedManual,
      failedOver: result.failedOver,
    };
  });

/** Fiyat simülatörü: seçilen market/para birimi için yetkili fiyatları döndürür. */
export const simulatePricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        marketId: z.guid().nullable(),
        currency: z.string().length(3).nullable(),
        countryCode: z.string().length(2).nullable(),
        productIds: z.array(z.guid()).min(1).max(100),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { loadPricingContext, calculatePrices } = await import("@/lib/pricing-engine.server");

    const { data: products, error } = await context.supabase
      .from("products")
      .select("id, title, base_price, compare_at_price, cost_price")
      .eq("store_id", data.storeId)
      .in("id", data.productIds);
    if (error) throw new Error(error.message);

    const pricingContext = await loadPricingContext(context.supabase, data.storeId, {
      marketId: data.marketId,
      currency: data.currency,
      countryCode: data.countryCode,
    });

    const results = await calculatePrices(
      context.supabase,
      pricingContext,
      (products ?? []).map((product) => ({
        productId: product.id,
        variantId: null,
        basePrice: Number(product.base_price ?? 0),
        baseCompareAt: product.compare_at_price === null ? null : Number(product.compare_at_price),
        cost: "cost_price" in product ? Number(product.cost_price ?? 0) : null,
      })),
    );

    const titles = new Map((products ?? []).map((product) => [product.id, product.title]));
    return {
      currency: pricingContext.currency,
      baseCurrency: pricingContext.baseCurrency,
      rate: pricingContext.rate,
      rateSource: pricingContext.rateSource,
      rateStale: pricingContext.rateStale,
      market: pricingContext.market
        ? { id: pricingContext.market.id, name: pricingContext.market.name }
        : null,
      campaign: pricingContext.campaign,
      rows: results.map((result) => ({ ...result, title: titles.get(result.productId) ?? "" })),
    };
  });
