import { z } from "zod";
import { checkoutPolicies } from "@/lib/checkout-policies.server";
import { samePolicyVersions } from "@/lib/checkout-policies";

import { DEFAULT_STORE_TIMEZONE, QUOTA_EXCLUDED_STATUSES, storeDayStart } from "@/lib/day-window";
import {
  CUSTOMS_ID_PATTERN,
  DOMESTIC_ONLY_PAYMENT_CODES,
  EXPORT_INVOICE_LABEL,
  isGeorgia,
} from "@/lib/export-ge";
import { isGiftCardUsable, normalizeGiftCardCode, redeemableAmount } from "@/lib/gift-cards";

/**
 * Halka açık kasa (checkout) iş mantığı. Fiyat, stok ve indirim doğrulaması
 * daima veritabanı üzerinden yapılır; istemciden gelen tutarlara güvenilmez.
 * Sipariş yazımı servis anahtarı ile yapılır, bu yüzden her adımda mağazanın
 * yayınlanmış olduğu ve ürünlerin aktif olduğu tekrar doğrulanır.
 */

export const checkoutOptionsSchema = z.object({ slug: z.string().trim().min(1).max(120) });

export const placeOrderSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  items: z
    .array(z.object({ variantId: z.guid(), quantity: z.number().int().min(1).max(50) }))
    .min(1)
    .max(30),
  customer: z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(180),
    phone: z.string().trim().min(5).max(40),
    acceptsMarketing: z.boolean().default(false),
  }),
  /** Yalnız dijital ürünlü sepetlerde boş bırakılabilir; sunucu doğrular. */
  address: z
    .object({
      country: z.string().trim().min(2).max(60),
      /** ETGB (mikro ihracat) için pasaport/kimlik no — Gürcistan teslimatında zorunlu. */
      customsId: z.string().trim().regex(CUSTOMS_ID_PATTERN).optional(),
      city: z.string().trim().min(1).max(80),
      district: z.string().trim().max(80).optional(),
      line1: z.string().trim().min(5).max(240),
      postalCode: z.string().trim().max(20).optional(),
    })
    .optional(),
  billingAddress: z
    .object({
      recipient: z.string().trim().max(120).optional(),
      company: z.string().trim().max(160).optional(),
      taxId: z.string().trim().max(40).optional(),
      country: z.string().trim().min(2).max(60),
      city: z.string().trim().min(1).max(80),
      district: z.string().trim().max(80).optional(),
      line1: z.string().trim().min(5).max(240),
      postalCode: z.string().trim().max(20).optional(),
    })
    .optional(),
  /** Müşterinin kasada gördüğü görüntüleme para birimi (kur anlık olarak kilitlenir). */
  displayCurrency: z.string().trim().length(3).toUpperCase().optional(),
  shippingRateId: z.guid().optional(),
  paymentMethodId: z.guid().optional(),
  discountCode: z.string().trim().max(60).optional(),
  giftCardCode: z.string().trim().max(60).optional(),
  note: z.string().trim().max(500).optional(),
  giftWrap: z.boolean().optional(),
  giftMessage: z.string().trim().max(300).optional(),
  /** Gizlilik politikası ve mesafeli satış sözleşmesi onayı (zorunlu, sunucuda kontrol edilir). */
  policyAccepted: z.boolean().optional(),
  policyVersionIds: z.array(z.guid()).length(3).optional(),
});

export const orderStatusSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  orderNumber: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(180),
});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function publishedStore(slug: string) {
  const supabase = await admin();
  const { data, error } = await supabase
    .from("stores")
    .select("id, name, slug, currency, locale, status, published_at")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (data.status !== "active") return null;
  return data;
}

export async function loadCheckoutOptions(input: z.infer<typeof checkoutOptionsSchema>) {
  const store = await publishedStore(input.slug);
  if (!store) return null;
  const supabase = await admin();
  const policies = await checkoutPolicies(supabase, store.id);

  const [paymentsRes, ratesRes, settingsRes] = await Promise.all([
    supabase
      .from("store_payment_methods")
      .select("id, display_name, instructions, installments_enabled, extra_fee_rate, sort_order, connectors(code)")
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("shipping_rates")
      .select(
        "id, title, price, free_over, eta_days, sort_order, zone_id, shipping_zones!inner(name, is_active)",
      )
      .eq("store_id", store.id)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("store_settings")
      .select("guest_checkout, default_tax_rate, tax_included_prices, contact_email, contact_phone")
      .eq("store_id", store.id)
      .maybeSingle(),
  ]);
  if (paymentsRes.error) throw new Error(paymentsRes.error.message);
  if (ratesRes.error) throw new Error(ratesRes.error.message);
  if (settingsRes.error) throw new Error(settingsRes.error.message);

  return {
    store: { id: store.id, name: store.name, slug: store.slug, currency: store.currency },
    paymentMethods: paymentsRes.data ?? [],
    shippingRates: (ratesRes.data ?? [])
      .filter(
        (rate) =>
          (rate as { shipping_zones?: { is_active: boolean } }).shipping_zones?.is_active !== false,
      )
      .map((rate) => ({
        id: rate.id,
        title: rate.title,
        price: Number(rate.price),
        free_over: rate.free_over === null ? null : Number(rate.free_over),
        eta_days: rate.eta_days,
        zone_name: (rate as { shipping_zones?: { name: string } }).shipping_zones?.name ?? null,
      })),
    settings: settingsRes.data,
    policies,
  };
}

function orderNumber() {
  const stamp = Date.now().toString(36).toUpperCase().slice(-6);
  const rand = Math.floor(Math.random() * 46_656)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0");
  return `MEF-${stamp}${rand}`;
}

/** Sunucu tarafı fiyatlandırma çekirdeği: fiyat, stok, indirim, kargo, vergi,
 * ödeme farkı ve hediye kartı daima veritabanından hesaplanır. */
type PricingInput = {
  items: { variantId: string; quantity: number }[];
  shippingRateId?: string | undefined;
  paymentMethodId?: string | undefined;
  discountCode?: string | undefined;
  giftCardCode?: string | undefined;
  giftWrap?: boolean | undefined;
  /** Teslimat ülkesi; yurt dışı (mikro ihracat) siparişlerinde KDV %0 uygulanır. */
  country?: string | undefined;
  address?: { country: string } | undefined;
};

async function priceCart(
  supabase: Awaited<ReturnType<typeof admin>>,
  store: { id: string; currency: string },
  input: PricingInput,
) {
  const variantIds = [...new Set(input.items.map((item) => item.variantId))];
  const { data: variants, error: variantsError } = await supabase
    .from("product_variants")
    .select(
      "id, product_id, title, sku, price, stock, products!inner(id, title, status, base_price, store_id, is_digital)",
    )
    .eq("store_id", store.id)
    .in("id", variantIds);
  if (variantsError) throw new Error(variantsError.message);

  type VariantRow = NonNullable<typeof variants>[number] & {
    products: {
      id: string;
      title: string;
      status: string;
      base_price: number;
      store_id: string;
      is_digital: boolean;
    };
  };
  const rows = (variants ?? []) as VariantRow[];

  const lines = input.items.map((item) => {
    const variant = rows.find((row) => row.id === item.variantId);
    if (!variant) throw new Error("Sepetteki bir ürün artık mevcut değil");
    if (variant.products.status !== "active")
      throw new Error(`${variant.products.title} satışta değil`);
    if ((variant.stock ?? 0) < item.quantity) {
      throw new Error(
        `${variant.products.title} için yeterli stok yok (kalan ${variant.stock ?? 0})`,
      );
    }
    const unitPrice = Number(variant.price ?? variant.products.base_price);
    return {
      variant,
      quantity: item.quantity,
      unitPrice,
      lineTotal: Number((unitPrice * item.quantity).toFixed(2)),
    };
  });

  const subtotal = Number(lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2));

  // İndirim doğrulaması (kod, aktiflik, tarih, limit, minimum sepet)
  let discountTotal = 0;
  let freeShipping = false;
  let discountRow: { id: string; code: string; used_count: number } | null = null;
  if (input.discountCode) {
    const { data: discount, error: discountError } = await supabase
      .from("discounts")
      .select(
        "id, code, type, value, min_subtotal, usage_limit, used_count, starts_at, ends_at, is_active",
      )
      .eq("store_id", store.id)
      .ilike("code", input.discountCode)
      .maybeSingle();
    if (discountError) throw new Error(discountError.message);
    const now = Date.now();
    const usable =
      discount &&
      discount.is_active &&
      new Date(discount.starts_at).getTime() <= now &&
      (!discount.ends_at || new Date(discount.ends_at).getTime() >= now) &&
      (discount.usage_limit === null || discount.used_count < discount.usage_limit) &&
      subtotal >= Number(discount.min_subtotal ?? 0);
    if (!usable) throw new Error("İndirim kodu geçersiz veya bu sepet için uygun değil");
    if (discount.type === "percentage") {
      discountTotal = Number(((subtotal * Number(discount.value)) / 100).toFixed(2));
    } else if (discount.type === "fixed_amount") {
      discountTotal = Math.min(subtotal, Number(discount.value));
    } else {
      freeShipping = true;
    }
    discountRow = { id: discount.id, code: discount.code, used_count: discount.used_count };
  }

  // Yalnız dijital ürünlerden oluşan sepet kargo gerektirmez.
  const digitalOnly =
    lines.length > 0 && lines.every((line) => line.variant.products.is_digital === true);

  // Kargo
  let shippingTotal = 0;
  let shippingTitle: string | null = null;
  if (input.shippingRateId && !digitalOnly) {
    const { data: rate, error: rateError } = await supabase
      .from("shipping_rates")
      .select("id, title, price, free_over, eta_days, is_active")
      .eq("store_id", store.id)
      .eq("id", input.shippingRateId)
      .maybeSingle();
    if (rateError) throw new Error(rateError.message);
    if (!rate || !rate.is_active) throw new Error("Seçilen kargo yöntemi kullanılamıyor");
    shippingTitle = rate.title;
    shippingTotal = Number(rate.price);
    if (rate.free_over !== null && subtotal - discountTotal >= Number(rate.free_over))
      shippingTotal = 0;
  }
  // Kolay Panel promosyonları: kargo bedava eşiği ve hediye paketi ücreti
  const { data: promo } = await supabase
    .from("kolay_promo_settings")
    .select("free_shipping_enabled, free_shipping_threshold, gift_wrap_enabled, gift_wrap_fee")
    .eq("store_id", store.id)
    .maybeSingle();
  if (
    promo?.free_shipping_enabled &&
    Number(promo.free_shipping_threshold ?? 0) > 0 &&
    subtotal - discountTotal >= Number(promo.free_shipping_threshold)
  ) {
    shippingTotal = 0;
  }
  if (freeShipping) shippingTotal = 0;
  const giftWrapFee =
    input.giftWrap && promo?.gift_wrap_enabled ? Math.max(0, Number(promo.gift_wrap_fee ?? 0)) : 0;

  // Vergi
  const { data: settings } = await supabase
    .from("store_settings")
    .select("default_tax_rate, tax_included_prices")
    .eq("store_id", store.id)
    .maybeSingle();
  // Mikro ihracat (Gürcistan teslimatı): KDV %0, ETGB ihracat faturası.
  const exportInvoice = !digitalOnly && isGeorgia(input.address?.country ?? input.country);
  const taxRate = exportInvoice ? 0 : Number(settings?.default_tax_rate ?? 0);
  const taxIncluded = exportInvoice ? false : Boolean(settings?.tax_included_prices);
  const taxable = Math.max(0, subtotal - discountTotal);
  const taxTotal = taxIncluded || exportInvoice ? 0 : Number(((taxable * taxRate) / 100).toFixed(2));

  let paymentLabel: string | null = null;
  let extraFee = 0;
  if (input.paymentMethodId) {
    const { data: method, error: methodError } = await supabase
      .from("store_payment_methods")
      .select("id, display_name, extra_fee_rate, is_active, connectors(code)")
      .eq("store_id", store.id)
      .eq("id", input.paymentMethodId)
      .maybeSingle();
    if (methodError) throw new Error(methodError.message);
    if (!method || !method.is_active) throw new Error("Seçilen ödeme yöntemi kullanılamıyor");
    const methodCode = (method as { connectors?: { code?: string } | null }).connectors?.code ?? "";
    if (exportInvoice && (DOMESTIC_ONLY_PAYMENT_CODES as readonly string[]).includes(methodCode)) {
      throw new Error("Bu ödeme yöntemi yurt dışı siparişlerde kullanılamaz; lütfen kartla ödemeyi seçin.");
    }
    paymentLabel = method.display_name;
    extraFee = Number(
      (((taxable + shippingTotal) * Number(method.extra_fee_rate ?? 0)) / 100).toFixed(2),
    );
  }

  const orderTotal = Number(
    (taxable + shippingTotal + taxTotal + extraFee + giftWrapFee).toFixed(2),
  );

  // Hediye kartı: kod, aktiflik, son kullanma ve bakiye sunucuda doğrulanır
  let giftCardApplied = 0;
  let giftCard: { id: string; code: string; balance: number } | null = null;
  if (input.giftCardCode) {
    const code = normalizeGiftCardCode(input.giftCardCode);
    const { data: cards, error: giftError } = await supabase
      .from("gift_cards")
      .select("id, code, balance, status, expires_at, currency")
      .eq("store_id", store.id)
      .ilike("code", code);
    if (giftError) throw new Error(giftError.message);
    const card = (cards ?? []).find((row) => normalizeGiftCardCode(row.code) === code);
    if (
      !card ||
      !isGiftCardUsable({
        status: card.status,
        balance: Number(card.balance),
        expires_at: card.expires_at,
      })
    ) {
      throw new Error("Hediye kartı geçersiz veya bakiyesi yok");
    }
    giftCardApplied = redeemableAmount(Number(card.balance), orderTotal);
    giftCard = { id: card.id, code: card.code, balance: Number(card.balance) };
  }

  const grandTotal = Number((orderTotal - giftCardApplied).toFixed(2));

  return {
    lines,
    subtotal,
    discountTotal,
    discountRow,
    freeShipping,
    shippingTotal,
    shippingTitle,
    taxRate,
    taxIncluded,
    taxTotal,
    paymentLabel,
    extraFee,
    giftWrapFee,
    orderTotal,
    giftCard,
    giftCardApplied,
    grandTotal,
    digitalOnly,
    exportInvoice,
    currency: store.currency,
  };
}

export const quoteCheckoutSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  items: z
    .array(z.object({ variantId: z.guid(), quantity: z.number().int().min(1).max(50) }))
    .min(1)
    .max(30),
  shippingRateId: z.guid().optional(),
  paymentMethodId: z.guid().optional(),
  discountCode: z.string().trim().max(60).optional(),
  giftCardCode: z.string().trim().max(60).optional(),
  giftWrap: z.boolean().optional(),
  country: z.string().trim().max(60).optional(),
});

/**
 * Kasada gösterilen tutarların tek doğruluk kaynağı. İstemci yalnızca ürün
 * kimliği/adet ve kod gönderir; tüm tutarlar burada hesaplanır.
 */
export async function quoteCheckout(input: z.infer<typeof quoteCheckoutSchema>) {
  const store = await publishedStore(input.slug);
  if (!store) throw new Error("Mağaza bulunamadı veya yayında değil");
  const supabase = await admin();
  try {
    const quote = await priceCart(supabase, store, input);
    return {
      ok: true as const,
      error: null,
      currency: quote.currency,
      lines: quote.lines.map((line) => ({
        variantId: line.variant.id,
        title: line.variant.products.title,
        variantTitle: line.variant.title,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      })),
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      discountCode: quote.discountRow?.code ?? null,
      freeShipping: quote.freeShipping,
      shippingTotal: quote.shippingTotal,
      shippingTitle: quote.shippingTitle,
      taxRate: quote.taxRate,
      taxIncluded: quote.taxIncluded,
      taxTotal: quote.taxTotal,
      paymentLabel: quote.paymentLabel,
      paymentFee: quote.extraFee,
      giftWrapFee: quote.giftWrapFee,
      giftCardApplied: quote.giftCardApplied,
      grandTotal: quote.grandTotal,
      digitalOnly: quote.digitalOnly,
      exportInvoice: quote.exportInvoice,
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Sepet doğrulanamadı",
      currency: store.currency,
      lines: [],
      subtotal: 0,
      discountTotal: 0,
      discountCode: null,
      freeShipping: false,
      shippingTotal: 0,
      shippingTitle: null,
      taxRate: 0,
      taxIncluded: false,
      taxTotal: 0,
      paymentLabel: null,
      paymentFee: 0,
      giftWrapFee: 0,
      giftCardApplied: 0,
      grandTotal: 0,
      digitalOnly: false,
      exportInvoice: false,
    };
  }
}

export async function createStorefrontOrder(
  input: z.infer<typeof placeOrderSchema>,
  auth?: { userId: string; email: string } | undefined,
) {
  const store = await publishedStore(input.slug);
  if (!store) throw new Error("Mağaza bulunamadı veya yayında değil");
  const supabase = await admin();
  const policies = await checkoutPolicies(supabase, store.id);
  if (
    input.policyAccepted !== true ||
    !policies.ready ||
    !samePolicyVersions(
      policies.versions.map((policy) => policy.versionId),
      input.policyVersionIds,
    )
  )
    throw new Error(
      "Mağaza politika metinleri eksik veya değişti. Güncel metinleri yeniden onaylayın.",
    );
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const acceptanceMeta = {
    userId: auth?.userId ?? null,
    ip:
      request?.headers.get("cf-connecting-ip") ??
      request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      null,
    userAgent: request?.headers.get("user-agent")?.slice(0, 500) ?? null,
  };

  const { data: checkoutSettings } = await supabase
    .from("store_settings")
    .select("guest_checkout, daily_order_limit")
    .eq("store_id", store.id)
    .maybeSingle();
  if (!auth && checkoutSettings && checkoutSettings.guest_checkout === false) {
    throw new Error("Bu mağazada misafir ödeme kapalı; lütfen giriş yapın.");
  }

  // Günlük sipariş kotası: satıcı kapasitesini aşan siparişler kabul edilmez.
  // Pencere mağazanın yerel gününe göre hesaplanır ve iptal/iade siparişler sayılmaz;
  // böylece panel ile ödeme adımı aynı sayıyı gösterir.
  const dailyLimit = Number(
    (checkoutSettings as { daily_order_limit?: number | null } | null)?.daily_order_limit ?? 0,
  );
  if (dailyLimit > 0) {
    const { data: storeZone } = await supabase
      .from("stores")
      .select("timezone")
      .eq("id", store.id)
      .maybeSingle();
    const dayStart = storeDayStart(storeZone?.timezone ?? DEFAULT_STORE_TIMEZONE);
    const { count, error: countError } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .not("status", "in", `(${QUOTA_EXCLUDED_STATUSES.join(",")})`)
      .gte("placed_at", dayStart.toISOString());
    if (countError) throw countError;
    if ((count ?? 0) >= dailyLimit) {
      throw new Error(
        "Bu mağaza bugünün sipariş kapasitesini doldurdu. Lütfen yarın tekrar deneyin.",
      );
    }
  }
  if (auth && auth.email.toLowerCase() !== input.customer.email.trim().toLowerCase()) {
    throw new Error("Sipariş e-postası hesabınızla eşleşmiyor.");
  }

  const priced = await priceCart(supabase, store, input);
  const {
    lines,
    subtotal,
    discountTotal,
    discountRow,
    shippingTotal,
    shippingTitle,
    taxTotal,
    paymentLabel,
    extraFee,
    giftWrapFee,
    giftCard,
    giftCardApplied,
    grandTotal,
    digitalOnly,
    exportInvoice,
  } = priced;
  // Fiziki ürün içeren sepetlerde teslimat adresi zorunludur (sunucu karar verir).
  if (!digitalOnly && !input.address) throw new Error("Teslimat adresi gerekli.");
  if (exportInvoice && !input.address?.customsId) {
    throw new Error("Gürcistan teslimatı için pasaport veya kimlik numarası (ETGB) zorunludur.");
  }

  // Müşteri kaydı (e-posta ile tekilleştirilir)
  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id, orders_count, total_spent")
    .eq("store_id", store.id)
    .ilike("email", input.customer.email)
    .maybeSingle();

  let customerId = existingCustomer?.id ?? null;
  if (!customerId) {
    const { data: inserted, error: customerError } = await supabase
      .from("customers")
      .insert({
        store_id: store.id,
        full_name: input.customer.fullName,
        email: input.customer.email.toLowerCase(),
        phone: input.customer.phone,
        accepts_marketing: input.customer.acceptsMarketing,
        ...(auth ? { user_id: auth.userId } : {}),
      })
      .select("id")
      .single();
    if (customerError) throw new Error(customerError.message);
    customerId = inserted.id;
  } else if (auth) {
    // Üyelikle ödeme: e-postası doğrulanmış misafir kaydını hesaba bağla.
    await supabase
      .from("customers")
      .update({ user_id: auth.userId })
      .eq("id", customerId)
      .is("user_id", null);
  }

  const addressJson = input.address
    ? {
        recipient: input.customer.fullName,
        phone: input.customer.phone,
        country: input.address.country,
        city: input.address.city,
        district: input.address.district ?? null,
        line1: input.address.line1,
        postal_code: input.address.postalCode ?? null,
        ...(exportInvoice
          ? {
              customs_id: input.address.customsId ?? null,
              export_invoice: { label: EXPORT_INVOICE_LABEL, regime: "ETGB", vat_rate: 0 },
            }
          : {}),
      }
    : { recipient: input.customer.fullName, phone: input.customer.phone, digital_delivery: true };

  const billingJson = input.billingAddress
    ? {
        recipient: input.billingAddress.recipient?.length
          ? input.billingAddress.recipient
          : input.customer.fullName,
        phone: input.customer.phone,
        country: input.billingAddress.country,
        city: input.billingAddress.city,
        district: input.billingAddress.district ?? null,
        line1: input.billingAddress.line1,
        postal_code: input.billingAddress.postalCode ?? null,
        tax_id: input.billingAddress.taxId ?? null,
        company: input.billingAddress.company ?? null,
        ...(exportInvoice
          ? { export_invoice: { label: EXPORT_INVOICE_LABEL, regime: "ETGB", vat_rate: 0 } }
          : {}),
      }
    : addressJson;

  // Kur kilidi: sipariş anındaki kur snapshot olarak yazılır; sonradan kur değişse bile
  // bu sipariş asla yeniden hesaplanmaz (geçmiş siparişler eski kurda kalır).
  const baseCurrency = String(store.currency).toUpperCase();
  const displayCurrency = (input.displayCurrency ?? baseCurrency).toUpperCase();
  let exchangeRate = 1;
  let rateSource: "base" | "auto" | "manual" | "missing" = "base";
  if (displayCurrency !== baseCurrency) {
    const { data: rateRow } = await supabase
      .from("currency_rates")
      .select("rate, source")
      .eq("store_id", store.id)
      .eq("base_currency", baseCurrency)
      .eq("quote_currency", displayCurrency)
      .maybeSingle();
    const rate = Number(rateRow?.rate ?? 0);
    if (Number.isFinite(rate) && rate > 0) {
      exchangeRate = rate;
      rateSource = rateRow?.source === "manual" ? "manual" : "auto";
    } else {
      // Mağaza kur tablosunda yoksa vitrinde gösterilen canlı kur kilitlenir.
      const { liveRate } = await import("@/lib/live-fx.server");
      const live = await liveRate(baseCurrency, displayCurrency);
      if (live) {
        exchangeRate = live;
        rateSource = "auto";
      } else {
        rateSource = "missing";
      }
    }
  }

  const number = orderNumber();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      store_id: store.id,
      customer_id: customerId,
      order_number: number,
      status: "pending",
      payment_status: "pending",
      fulfillment_status: "unfulfilled",
      currency: store.currency,
      display_currency: rateSource === "missing" ? baseCurrency : displayCurrency,
      exchange_rate: rateSource === "missing" ? 1 : exchangeRate,
      rate_source: rateSource === "missing" ? "base" : rateSource,
      subtotal,
      discount_total: discountTotal,
      shipping_total: shippingTotal,
      tax_total: Number((taxTotal + extraFee + giftWrapFee).toFixed(2)),
      grand_total: grandTotal,
      discount_code: discountRow?.code ?? null,
      customer_email: input.customer.email.toLowerCase(),
      customer_name: input.customer.fullName,
      customer_phone: input.customer.phone,
      is_digital: digitalOnly,
      shipping_address: addressJson,
      billing_address: billingJson,
      shipping_carrier: digitalOnly ? null : shippingTitle,
      note: input.note?.length ? input.note : null,
      gift_wrap: input.giftWrap === true,
      gift_message: input.giftWrap && input.giftMessage?.length ? input.giftMessage : null,
      checkout_policy_version_ids: policies.versions.map((policy) => policy.versionId),
      checkout_acceptance_meta: acceptanceMeta,
    })
    .select("id, order_number, grand_total, currency")
    .single();
  if (orderError) throw new Error(orderError.message);

  const { error: itemsError } = await supabase.from("order_items").insert(
    lines.map((line) => ({
      order_id: order.id,
      store_id: store.id,
      product_id: line.variant.product_id,
      variant_id: line.variant.id,
      title: line.variant.products.title,
      variant_title: line.variant.title,
      sku: line.variant.sku,
      unit_price: line.unitPrice,
      quantity: line.quantity,
      line_total: line.lineTotal,
    })),
  );
  if (itemsError) throw new Error(itemsError.message);

  // Stok düşümü: satır kilidi (FOR UPDATE) ile atomik rezervasyon. Aynı anda
  // gelen siparişler tek adet stoku ikiye satamaz; yetersizse sipariş iptal edilir.
  const reserved: { variantId: string; quantity: number; before: number; after: number }[] = [];
  for (const line of lines) {
    const { data, error } = await supabase.rpc("reserve_variant_stock", {
      _variant_id: line.variant.id,
      _qty: line.quantity,
    });
    const row = (Array.isArray(data) ? data[0] : data) as
      { stock_before: number; stock_after: number } | undefined;
    if (error || !row) {
      // Rezerve edilen stokları geri bırak ve siparişi geri al.
      for (const item of reserved) {
        await supabase.rpc("release_variant_stock", {
          _variant_id: item.variantId,
          _qty: item.quantity,
        });
      }
      await supabase.from("order_items").delete().eq("order_id", order.id);
      await supabase.from("orders").delete().eq("id", order.id);
      throw new Error(
        error?.message ??
          `"${line.variant.products.title}" için yeterli stok kalmadı, lütfen adedi güncelleyin.`,
      );
    }
    reserved.push({
      variantId: line.variant.id,
      quantity: line.quantity,
      before: Number(row.stock_before),
      after: Number(row.stock_after),
    });
    await supabase.from("inventory_movements").insert({
      store_id: store.id,
      product_id: line.variant.product_id,
      variant_id: line.variant.id,
      kind: "sale",
      quantity: line.quantity,
      stock_before: Number(row.stock_before),
      stock_after: Number(row.stock_after),
      reason: `Sipariş ${number}`,
    });
  }

  await supabase.from("order_events").insert({
    order_id: order.id,
    store_id: store.id,
    kind: "created",
    message: `Vitrinden sipariş alındı${paymentLabel ? ` · ${paymentLabel}` : ""}`,
    meta: {
      source: "storefront",
      payment_method: paymentLabel,
      payment_method_id: input.paymentMethodId ?? null,
      shipping: shippingTitle,
    },
  });

  {
    const { dispatchCustomerEvent } = await import("@/lib/customer-notify.server");
    await dispatchCustomerEvent(order.id, "ORDER_CREATED");
  }

  if (discountRow) {
    await supabase
      .from("discounts")
      .update({ used_count: discountRow.used_count + 1 })
      .eq("id", discountRow.id);
  }

  if (giftCard && giftCardApplied > 0) {
    const nextBalance = Number((giftCard.balance - giftCardApplied).toFixed(2));
    await supabase
      .from("gift_cards")
      .update({ balance: nextBalance, status: nextBalance === 0 ? "depleted" : "active" })
      .eq("id", giftCard.id);
    await supabase.from("gift_card_transactions").insert({
      store_id: store.id,
      gift_card_id: giftCard.id,
      order_id: order.id,
      kind: "redeem",
      amount: -giftCardApplied,
      balance_after: nextBalance,
      note: `Sipariş ${number}`,
    });
    await supabase.from("order_events").insert({
      order_id: order.id,
      store_id: store.id,
      kind: "note",
      message: `Hediye kartı kullanıldı: ${giftCard.code} · ${giftCardApplied}`,
      meta: { gift_card_id: giftCard.id, amount: giftCardApplied },
    });
  }

  if (existingCustomer) {
    await supabase
      .from("customers")
      .update({
        orders_count: (existingCustomer.orders_count ?? 0) + 1,
        total_spent: Number(existingCustomer.total_spent ?? 0) + grandTotal,
      })
      .eq("id", existingCustomer.id);
  } else if (customerId) {
    await supabase
      .from("customers")
      .update({ orders_count: 1, total_spent: grandTotal })
      .eq("id", customerId);
  }

  return {
    orderNumber: order.order_number,
    grandTotal: Number(order.grand_total),
    currency: order.currency,
    paymentLabel,
    giftCardApplied,
  };
}

export async function loadOrderStatus(input: z.infer<typeof orderStatusSchema>) {
  const store = await publishedStore(input.slug);
  if (!store) return null;
  const supabase = await admin();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_status, fulfillment_status, currency, subtotal, discount_total, shipping_total, tax_total, grand_total, customer_name, customer_phone, is_digital, shipping_address, shipping_carrier, tracking_number, placed_at",
    )
    .eq("store_id", store.id)
    .eq("order_number", input.orderNumber)
    .ilike("customer_email", input.email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) return null;

  const { data: items } = await supabase
    .from("order_items")
    .select("id, product_id, title, variant_title, unit_price, quantity, line_total")
    .eq("order_id", order.id);

  const { data: shipments } = await supabase
    .from("shipments")
    .select(
      "id, carrier, tracking_number, tracking_url, status, shipped_at, delivered_at, created_at",
    )
    .eq("order_id", order.id)
    .order("created_at", { ascending: false });

  // Ödeme bilgisi: kartla ödeme yalnızca mağaza Mefpay modundaysa ve QNBpay
  // yapılandırılmışsa gösterilir; havale modunda IBAN talimatı verilir.
  const { data: settings } = await supabase
    .from("store_settings")
    .select("payment_mode, bank_iban, bank_account_holder")
    .eq("store_id", store.id)
    .maybeSingle();

  const paymentMode = (settings?.payment_mode ?? null) as string | null;
  const unpaid =
    order.payment_status !== "paid" && !["cancelled", "refunded"].includes(order.status);
  let cardAvailable = false;
  const { data: kindRow } = await supabase
    .from("stores")
    .select("store_kind")
    .eq("id", store.id)
    .maybeSingle();
  // Satıcının kurduğu iyzico / PayTR ile seçilmiş siparişler kartla ödenebilir.
  if (unpaid && Number(order.grand_total) > 0) {
    const { orderPaymentMethodId, resolveOrderGateway } =
      await import("@/lib/store-gateways.server");
    const gateway = await resolveOrderGateway(
      supabase as never,
      store.id,
      await orderPaymentMethodId(supabase as never, order.id),
    );
    if (gateway) cardAvailable = true;
  }
  // QNBpay yalnız Kolay Panel mağazalarında kullanılır.
  if (
    !cardAvailable &&
    unpaid &&
    paymentMode === "mefpay" &&
    kindRow?.store_kind === "micro" &&
    Number(order.grand_total) > 0
  ) {
    const { cardPaymentAvailable } = await import("@/lib/qnbpay-admin.server");
    cardAvailable = await cardPaymentAvailable();
  }

  // Dijital teslimat: dosya/bağlantı yalnız ödeme onaylandıktan sonra ve
  // kısa ömürlü imzalı adresle verilir.
  const digitalProductIds = [
    ...new Set(
      (items ?? []).map((item) => item.product_id).filter((id): id is string => Boolean(id)),
    ),
  ];
  let digital: {
    productId: string;
    title: string;
    downloadUrl: string | null;
    fileName: string | null;
    accessUrl: string | null;
    deliveryNote: string | null;
  }[] = [];
  if (digitalProductIds.length > 0) {
    const { data: assets } = await supabase
      .from("kolay_digital_assets")
      .select("product_id, file_path, file_name, access_url, delivery_note")
      .eq("store_id", store.id)
      .in("product_id", digitalProductIds);
    if (assets?.length && order.payment_status === "paid") {
      digital = await Promise.all(
        assets.map(async (asset) => {
          let downloadUrl: string | null = null;
          if (asset.file_path) {
            const { data: signed } = await supabase.storage
              .from("digital-assets")
              .createSignedUrl(asset.file_path, 60 * 60, { download: asset.file_name ?? true });
            downloadUrl = signed?.signedUrl ?? null;
          }
          return {
            productId: asset.product_id,
            title:
              (items ?? []).find((item) => item.product_id === asset.product_id)?.title ??
              "Dijital ürün",
            downloadUrl,
            fileName: asset.file_name,
            accessUrl: asset.access_url,
            deliveryNote: asset.delivery_note,
          };
        }),
      );
    }
  }

  return {
    store: { name: store.name, slug: store.slug },
    order,
    items: (items ?? []).map(({ product_id: _p, ...rest }) => rest),
    shipments: shipments ?? [],
    digital,
    payment: {
      mode: paymentMode,
      cardAvailable,
      unpaid,
      bankIban: unpaid && paymentMode === "bank_transfer" ? (settings?.bank_iban ?? null) : null,
      bankAccountHolder:
        unpaid && paymentMode === "bank_transfer" ? (settings?.bank_account_holder ?? null) : null,
    },
  };
}

export const previewDiscountSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(60),
  subtotal: z.number().min(0).max(10_000_000),
});

/**
 * Kasada kupon önizlemesi. Sunucuda doğrulanır; istemciye yalnızca hesaplanan
 * indirim tutarı ve etiketi döner. Sipariş anındaki kesin hesap yine
 * createStorefrontOrder içinde tekrar yapılır.
 */
export async function previewDiscount(input: z.infer<typeof previewDiscountSchema>) {
  const store = await publishedStore(input.slug);
  if (!store) throw new Error("Mağaza bulunamadı veya yayında değil");
  const supabase = await admin();

  const { data: discount, error } = await supabase
    .from("discounts")
    .select(
      "code, title, type, value, min_subtotal, usage_limit, used_count, starts_at, ends_at, is_active",
    )
    .eq("store_id", store.id)
    .ilike("code", input.code)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const now = Date.now();
  const usable =
    discount &&
    discount.is_active &&
    new Date(discount.starts_at).getTime() <= now &&
    (!discount.ends_at || new Date(discount.ends_at).getTime() >= now) &&
    (discount.usage_limit === null || discount.used_count < discount.usage_limit);
  if (!usable) throw new Error("İndirim kodu geçersiz veya süresi dolmuş");

  const minSubtotal = Number(discount.min_subtotal ?? 0);
  if (input.subtotal < minSubtotal) {
    throw new Error(
      `Bu kupon için minimum sepet tutarı ${minSubtotal.toFixed(2)} ${store.currency}`,
    );
  }

  let discountTotal = 0;
  let freeShipping = false;
  if (discount.type === "percentage") {
    discountTotal = Number(((input.subtotal * Number(discount.value)) / 100).toFixed(2));
  } else if (discount.type === "fixed_amount") {
    discountTotal = Math.min(input.subtotal, Number(discount.value));
  } else {
    freeShipping = true;
  }

  return {
    code: discount.code,
    title: discount.title,
    type: discount.type,
    discountTotal,
    freeShipping,
    label:
      discount.type === "percentage"
        ? `%${Number(discount.value)} indirim`
        : discount.type === "fixed_amount"
          ? `${Number(discount.value)} ${store.currency} indirim`
          : "Ücretsiz kargo",
  };
}
