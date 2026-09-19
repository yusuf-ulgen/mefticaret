import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Advanced E-İhracat Growth & Logistics sunucu fonksiyonları.
 * Yazma işlemleri `assertStoreManager` ile korunur; okuma RLS ile mağazaya kapalıdır.
 * Gerçek taşıyıcı/pazaryeri hesap bilgisi olmadan hiçbir yerde uydurma takip
 * numarası veya fiyat üretilmez — kayıtlar "hesap bekleniyor" olarak işaretlenir.
 */

const storeId = z.guid();
const country = z.string().trim().min(2).max(2);
const currency = z.string().trim().min(3).max(3);

async function guard(supabase: unknown, store: string, userId: string) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await assertStoreManager(supabase as any, store, userId);
}

function reference(prefix: string): string {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;
  return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

/* ------------------------------- affiliate ------------------------------- */

export const saveAffiliatePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid().nullish(),
        name: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(200).nullish(),
        countryCode: country.default("TR"),
        code: z.string().trim().min(3).max(40),
        commissionPercent: z.number().min(0).max(90),
        payoutCurrency: currency.default("USD"),
        promoCode: z.string().trim().max(40).nullish(),
        isActive: z.boolean().default(true),
        notes: z.string().trim().max(1000).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const row = {
      store_id: data.storeId,
      name: data.name,
      email: data.email ?? null,
      country_code: data.countryCode.toUpperCase(),
      code: data.code.toLowerCase(),
      commission_percent: data.commissionPercent,
      payout_currency: data.payoutCurrency.toUpperCase(),
      promo_code: data.promoCode ?? null,
      is_active: data.isActive,
      notes: data.notes ?? null,
    };
    const query = data.id
      ? context.supabase.from("affiliate_partners").update(row).eq("id", data.id).eq("store_id", data.storeId)
      : context.supabase.from("affiliate_partners").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAffiliatePartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("affiliate_partners")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Ödenmiş siparişlerden ortak komisyonlarını hesaplar ve kaydeder. */
export const syncAffiliateCommissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, days: z.number().int().min(1).max(365).default(90) }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { calculateCommission } = await import("@/lib/growth-export");

    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const [partnersRes, ordersRes, existingRes] = await Promise.all([
      context.supabase
        .from("affiliate_partners")
        .select("id, code, promo_code, commission_percent, payout_currency, is_active")
        .eq("store_id", data.storeId),
      context.supabase
        .from("orders")
        .select("id, order_number, grand_total, currency, payment_status, discount_code, created_at")
        .eq("store_id", data.storeId)
        .eq("payment_status", "paid")
        .gte("created_at", since)
        .limit(500),
      context.supabase.from("affiliate_conversions").select("order_id").eq("store_id", data.storeId),
    ]);
    if (partnersRes.error) throw new Error(partnersRes.error.message);
    if (ordersRes.error) throw new Error(ordersRes.error.message);
    if (existingRes.error) throw new Error(existingRes.error.message);

    const partners = (partnersRes.data ?? []).filter((p) => p.is_active);
    const already = new Set((existingRes.data ?? []).map((r) => String(r.order_id)));
    const inserts: Array<{
      store_id: string;
      partner_id: string;
      order_id: string;
      order_total: number;
      order_currency: string;
      commission_amount: number;
      commission_currency: string;
      status: string;
    }> = [];

    for (const order of ordersRes.data ?? []) {
      if (already.has(String(order.id))) continue;
      const coupon = (order.discount_code ?? "").toString().toLowerCase();
      if (!coupon) continue;
      const partner = partners.find(
        (p) => p.code.toLowerCase() === coupon || (p.promo_code ?? "").toLowerCase() === coupon,
      );
      if (!partner) continue;
      const commission = calculateCommission({
        orderTotal: Number(order.grand_total ?? 0),
        orderCurrency: String(order.currency ?? "TRY"),
        commissionPercent: Number(partner.commission_percent ?? 0),
        payoutCurrency: String(partner.payout_currency ?? "USD"),
      });
      inserts.push({
        store_id: data.storeId,
        partner_id: String(partner.id),
        order_id: String(order.id),
        order_total: Number(order.grand_total ?? 0),
        order_currency: String(order.currency ?? "TRY"),
        commission_amount: commission.amount,
        commission_currency: commission.currency,
        status: "pending",
      });
    }

    if (inserts.length > 0) {
      const { error } = await context.supabase.from("affiliate_conversions").insert(inserts);
      if (error) throw new Error(error.message);
    }
    return { created: inserts.length, scanned: (ordersRes.data ?? []).length };
  });

export const updateAffiliateConversionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ storeId, id: z.guid(), status: z.enum(["pending", "approved", "paid", "rejected"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("affiliate_conversions")
      .update({
        status: data.status,
        paid_at: data.status === "paid" ? new Date().toISOString() : null,
      })
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------- tatil kampanyaları -------------------------- */

export const seedHolidayCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        year: z.number().int().min(2026).max(2030),
        discountPercent: z.number().min(0).max(90).default(15),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { planHolidayCampaigns } = await import("@/lib/growth-export");
    const planned = planHolidayCampaigns(data.year, data.discountPercent);

    const { data: existing, error: readError } = await context.supabase
      .from("holiday_campaigns")
      .select("holiday_key, starts_at")
      .eq("store_id", data.storeId);
    if (readError) throw new Error(readError.message);
    const taken = new Set(
      (existing ?? []).map((row) => `${row.holiday_key}:${new Date(row.starts_at).getUTCFullYear()}`),
    );

    const rows = planned
      .filter((plan) => !taken.has(`${plan.key}:${data.year}`))
      .map((plan) => ({
        store_id: data.storeId,
        holiday_key: plan.key,
        name: `${plan.name} ${data.year}`,
        countries: plan.countries,
        starts_at: plan.startsAt,
        ends_at: plan.endsAt,
        discount_percent: data.discountPercent,
        banner_text: plan.bannerText,
        banner_locale: "en",
        is_auto: true,
        is_active: true,
      }));
    if (rows.length > 0) {
      const { error } = await context.supabase.from("holiday_campaigns").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { created: rows.length, planned: planned.length };
  });

export const saveHolidayCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid(),
        discountPercent: z.number().min(0).max(90).optional(),
        bannerText: z.string().trim().max(300).nullish(),
        isActive: z.boolean().optional(),
        isAuto: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const patch: {
      discount_percent?: number;
      banner_text?: string | null;
      is_active?: boolean;
      is_auto?: boolean;
    } = {};
    if (data.discountPercent !== undefined) patch.discount_percent = data.discountPercent;
    if (data.bannerText !== undefined) patch.banner_text = data.bannerText ?? null;
    if (data.isActive !== undefined) patch.is_active = data.isActive;
    if (data.isAuto !== undefined) patch.is_auto = data.isAuto;
    const { error } = await context.supabase
      .from("holiday_campaigns")
      .update(patch)
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteHolidayCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("holiday_campaigns")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------ bildirim saat pencereleri ---------------------- */

export const saveDispatchWindow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        countryCode: country,
        channel: z.enum(["email", "whatsapp"]),
        localSendHour: z.number().int().min(0).max(23),
        isActive: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase.from("global_dispatch_windows").upsert(
      {
        store_id: data.storeId,
        country_code: data.countryCode.toUpperCase(),
        channel: data.channel,
        local_send_hour: data.localSendHour,
        is_active: data.isActive,
      },
      { onConflict: "store_id,country_code,channel" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Her ülke penceresi için sıradaki gerçek UTC gönderim zamanını hesaplar. */
export const previewDispatchSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId }).parse(data))
  .handler(async ({ data, context }) => {
    const { nextLocalSendTime } = await import("@/lib/growth-export");
    const { data: rows, error } = await context.supabase
      .from("global_dispatch_windows")
      .select("id, country_code, channel, local_send_hour, is_active")
      .eq("store_id", data.storeId)
      .order("country_code", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => {
      const next = nextLocalSendTime(row.country_code, Number(row.local_send_hour));
      return {
        id: String(row.id),
        country: String(row.country_code),
        channel: String(row.channel),
        localHour: Number(row.local_send_hour),
        isActive: Boolean(row.is_active),
        timezone: next.timezone,
        sendAt: next.sendAt,
      };
    });
  });

/* ----------------------------- yerel iade hub ---------------------------- */

export const saveReturnHub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid().nullish(),
        countryCode: country,
        hubName: z.string().trim().min(2).max(160),
        address: z.string().trim().max(400).nullish(),
        city: z.string().trim().max(120).nullish(),
        postalCode: z.string().trim().max(24).nullish(),
        carrierCode: z.string().trim().max(40).nullish(),
        instructions: z.string().trim().max(1000).nullish(),
        isActive: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const row = {
      store_id: data.storeId,
      country_code: data.countryCode.toUpperCase(),
      hub_name: data.hubName,
      address: data.address ?? null,
      city: data.city ?? null,
      postal_code: data.postalCode ?? null,
      carrier_code: data.carrierCode ?? null,
      instructions: data.instructions ?? null,
      is_active: data.isActive,
    };
    const query = data.id
      ? context.supabase.from("return_hubs").update(row).eq("id", data.id).eq("store_id", data.storeId)
      : context.supabase.from("return_hubs").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReturnHub = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("return_hubs")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Yurt dışı alıcı için yerel iade etiketi kaydı oluşturur.
 * Taşıyıcı hesabı bağlı değilse takip numarası boş bırakılır; etiket
 * yazdırılabilir taslak olarak üretilir.
 */
export const createInternationalReturnLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        orderId: z.guid(),
        hubId: z.guid().nullish(),
        carrierCode: z.string().trim().max(40).nullish(),
        trackingNumber: z.string().trim().max(60).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { normalizeCountryCode } = await import("@/lib/global-commerce");

    const { data: order, error: orderError } = await context.supabase
      .from("orders")
      .select("id, order_number, shipping_address, currency, grand_total")
      .eq("id", data.orderId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Sipariş bulunamadı");

    const address = (order.shipping_address ?? {}) as Record<string, unknown>;
    const buyerCountry = normalizeCountryCode(String(address["country"] ?? ""), "TR");

    let hub = null as { id: string; country_code: string; hub_name: string; carrier_code: string | null } | null;
    if (data.hubId) {
      const { data: row, error } = await context.supabase
        .from("return_hubs")
        .select("id, country_code, hub_name, carrier_code")
        .eq("id", data.hubId)
        .eq("store_id", data.storeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      hub = row as typeof hub;
    } else {
      const { data: rows, error } = await context.supabase
        .from("return_hubs")
        .select("id, country_code, hub_name, carrier_code")
        .eq("store_id", data.storeId)
        .eq("is_active", true);
      if (error) throw new Error(error.message);
      hub =
        ((rows ?? []).find((row) => row.country_code === buyerCountry) as typeof hub) ??
        ((rows ?? [])[0] as typeof hub) ??
        null;
    }

    const ref = reference("RMA");
    const payload = {
      order_number: String(order.order_number ?? ""),
      buyer: {
        name: String(address["full_name"] ?? address["name"] ?? ""),
        city: String(address["city"] ?? ""),
        country: buyerCountry,
      },
      hub: hub ? { name: String(hub.hub_name), country: String(hub.country_code) } : null,
      instructions_locale: buyerCountry,
      generated_at: new Date().toISOString(),
    };

    const { error } = await context.supabase.from("international_return_labels").insert({
      store_id: data.storeId,
      hub_id: hub?.id ?? null,
      order_id: String(order.id),
      reference: ref,
      destination_country: hub?.country_code ?? "TR",
      origin_country: buyerCountry,
      carrier_code: data.carrierCode ?? hub?.carrier_code ?? null,
      tracking_number: data.trackingNumber ?? null,
      status: data.trackingNumber ? "issued" : "draft",
      label_payload: payload,
    });
    if (error) throw new Error(error.message);
    return { reference: ref, hub: hub?.hub_name ?? null, buyerCountry };
  });

export const updateReturnLabelStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid(),
        status: z.enum(["draft", "issued", "in_transit", "received", "cancelled"]),
        trackingNumber: z.string().trim().max(60).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const patch: { status: string; tracking_number?: string | null } = { status: data.status };
    if (data.trackingNumber !== undefined) patch.tracking_number = data.trackingNumber ?? null;
    const { error } = await context.supabase
      .from("international_return_labels")
      .update(patch)
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------ taşıyıcı fiyat karşılaştırma ------------------- */

export const saveCarrierQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid().nullish(),
        destinationCountry: country,
        weightGrams: z.number().int().min(1).max(200000),
        carrierCode: z.string().trim().min(2).max(40),
        service: z.string().trim().max(80).nullish(),
        cost: z.number().min(0).max(1000000),
        currency: currency.default("USD"),
        transitDays: z.number().int().min(1).max(90).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const row = {
      store_id: data.storeId,
      destination_country: data.destinationCountry.toUpperCase(),
      weight_grams: data.weightGrams,
      carrier_code: data.carrierCode.toLowerCase(),
      service: data.service ?? null,
      cost: data.cost,
      currency: data.currency.toUpperCase(),
      transit_days: data.transitDays ?? null,
      source: "manual" as const,
      fetched_at: new Date().toISOString(),
    };
    const query = data.id
      ? context.supabase.from("carrier_rate_quotes").update(row).eq("id", data.id).eq("store_id", data.storeId)
      : context.supabase.from("carrier_rate_quotes").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCarrierQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("carrier_rate_quotes")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Kayıtlı teklifler içinden en ucuz/en hızlı rotayı seçer. */
export const compareCarriers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        destinationCountry: country,
        weightGrams: z.number().int().min(1).max(200000).default(1000),
        strategy: z.enum(["cheapest", "fastest"]).default("cheapest"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { compareCarrierQuotes } = await import("@/lib/growth-export");
    const { data: rows, error } = await context.supabase
      .from("carrier_rate_quotes")
      .select("id, carrier_code, service, cost, currency, transit_days, source, weight_grams")
      .eq("store_id", data.storeId)
      .eq("destination_country", data.destinationCountry.toUpperCase())
      .lte("weight_grams", Math.round(data.weightGrams * 1.5))
      .order("cost", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: rates } = await context.supabase
      .from("currency_rates")
      .select("quote_currency, rate")
      .eq("store_id", data.storeId)
      .limit(50);
    const fx: Record<string, number> = { TRY: 1 };
    for (const rate of rates ?? []) {
      fx[String(rate.quote_currency).toUpperCase()] = Number(rate.rate ?? 1);
    }

    const comparison = compareCarrierQuotes(
      (rows ?? []).map((row) => ({
        id: String(row.id),
        carrier_code: String(row.carrier_code),
        service: row.service ? String(row.service) : null,
        cost: Number(row.cost ?? 0),
        currency: String(row.currency ?? "USD"),
        transit_days: row.transit_days == null ? null : Number(row.transit_days),
        source: String(row.source ?? "manual"),
      })),
      fx,
      data.strategy,
    );
    return comparison;
  });

/* -------------------------- depo yönlendirme testi ----------------------- */

export const simulateWarehouseRouting = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ storeId, destinationCountry: country, quantity: z.number().int().min(1).max(10000).default(1) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { routeOrderToWarehouse } = await import("@/lib/growth-export");
    const { data: rows, error } = await context.supabase
      .from("fulfillment_warehouses")
      .select("id, code, name, provider, country_code, priority, is_active")
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    const decision = routeOrderToWarehouse(
      (rows ?? []).map((row) => ({
        id: String(row.id),
        code: String(row.code),
        name: String(row.name),
        provider: String(row.provider),
        country_code: String(row.country_code),
        priority: Number(row.priority ?? 0),
        is_active: Boolean(row.is_active),
      })),
      data.destinationCountry,
      data.quantity,
    );
    return {
      reason: decision.reason,
      warehouse: decision.warehouse,
      ranked: decision.ranked.map((entry) => ({
        id: entry.warehouse.id,
        name: entry.warehouse.name,
        country: entry.warehouse.country_code,
        provider: entry.warehouse.provider,
        distance: entry.distance,
        score: entry.score,
      })),
    };
  });

/* ------------------------------ B2B toptan ------------------------------- */

export const saveWholesaleTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid().nullish(),
        productId: z.guid().nullish(),
        minQuantity: z.number().int().min(1).max(100000),
        discountPercent: z.number().min(0).max(90),
        isActive: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const row = {
      store_id: data.storeId,
      product_id: data.productId ?? null,
      min_quantity: data.minQuantity,
      discount_percent: data.discountPercent,
      is_active: data.isActive,
    };
    const query = data.id
      ? context.supabase.from("wholesale_tiers").update(row).eq("id", data.id).eq("store_id", data.storeId)
      : context.supabase.from("wholesale_tiers").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWholesaleTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("wholesale_tiers")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveB2bSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId, b2bEnabled: z.boolean(), defaultMoq: z.number().int().min(1).max(100000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase.from("store_global_settings").upsert(
      { store_id: data.storeId, b2b_enabled: data.b2bEnabled, b2b_default_moq: data.defaultMoq },
      { onConflict: "store_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Teklif (RFQ) oluşturur: kademeli iskontoyu uygular ve toplamı hesaplar. */
export const createRfqQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        companyName: z.string().trim().min(2).max(200),
        contactName: z.string().trim().max(160).nullish(),
        email: z.string().trim().email().max(200).nullish(),
        phone: z.string().trim().max(40).nullish(),
        countryCode: country.default("TR"),
        currency: currency.default("USD"),
        validDays: z.number().int().min(1).max(180).default(30),
        notes: z.string().trim().max(2000).nullish(),
        items: z
          .array(
            z.object({
              productId: z.guid(),
              quantity: z.number().int().min(1).max(1000000),
            }),
          )
          .min(1)
          .max(50),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { buildWholesaleQuote, meetsMoq } = await import("@/lib/growth-export");

    const [productsRes, tiersRes, settingsRes] = await Promise.all([
      context.supabase
        .from("products")
        .select("id, title, base_price, currency")
        .eq("store_id", data.storeId)
        .in("id", data.items.map((i) => i.productId)),
      context.supabase
        .from("wholesale_tiers")
        .select("product_id, min_quantity, discount_percent, is_active")
        .eq("store_id", data.storeId),
      context.supabase
        .from("store_global_settings")
        .select("b2b_default_moq")
        .eq("store_id", data.storeId)
        .maybeSingle(),
    ]);
    if (productsRes.error) throw new Error(productsRes.error.message);
    if (tiersRes.error) throw new Error(tiersRes.error.message);

    const moq = Number(settingsRes.data?.b2b_default_moq ?? 1);
    const tiers = tiersRes.data ?? [];
    const lines: Array<{ title: string; unitPrice: number; quantity: number; productId: string }> = [];
    const belowMoq: string[] = [];

    for (const item of data.items) {
      const product = (productsRes.data ?? []).find((p) => String(p.id) === item.productId);
      if (!product) continue;
      if (!meetsMoq(item.quantity, moq)) belowMoq.push(String(product.title));
      lines.push({
        productId: item.productId,
        title: String(product.title),
        unitPrice: Number(product.base_price ?? 0),
        quantity: item.quantity,
      });
    }
    if (lines.length === 0) throw new Error("Teklif için geçerli ürün bulunamadı");
    if (belowMoq.length > 0) {
      throw new Error(`Minimum sipariş adedi ${moq}: ${belowMoq.join(", ")}`);
    }

    const quoted = buildWholesaleQuote(
      lines,
      tiers.map((tier) => ({
        min_quantity: Number(tier.min_quantity),
        discount_percent: Number(tier.discount_percent),
        is_active: Boolean(tier.is_active),
      })),
    );

    const ref = reference("RFQ");
    const validUntil = new Date(Date.now() + data.validDays * 86400000).toISOString().slice(0, 10);
    const { error } = await context.supabase.from("rfq_requests").insert({
      store_id: data.storeId,
      reference: ref,
      company_name: data.companyName,
      contact_name: data.contactName ?? null,
      email: data.email ?? null,
      phone: data.phone ?? null,
      country_code: data.countryCode.toUpperCase(),
      currency: data.currency.toUpperCase(),
      items: quoted.lines.map((line, index) => ({ ...line, product_id: lines[index]?.productId })),
      requested_total: quoted.subtotal,
      quoted_total: quoted.total,
      status: "quoted",
      valid_until: validUntil,
      notes: data.notes ?? null,
    });
    if (error) throw new Error(error.message);
    return { reference: ref, ...quoted, validUntil };
  });

export const updateRfqStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId, id: z.guid(), status: z.enum(["new", "quoted", "won", "lost"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("rfq_requests")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------------- pazaryeri kanalları ------------------------ */

export const saveMarketplaceChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        channel: z.enum(["amazon_us", "amazon_eu", "etsy", "ebay", "walmart", "allegro", "noon"]),
        isActive: z.boolean(),
        targetCurrency: currency.default("USD"),
        credentialsReady: z.boolean().default(false),
        notes: z.string().trim().max(500).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase.from("global_marketplace_channels").upsert(
      {
        store_id: data.storeId,
        channel: data.channel,
        is_active: data.isActive,
        target_currency: data.targetCurrency.toUpperCase(),
        credentials_ready: data.credentialsReady,
        notes: data.notes ?? null,
      },
      { onConflict: "store_id,channel" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Aktarım hazırlığı: kanalın para birimine göre gönderilecek ürün paketini
 * hazırlar. Hesap bilgisi bağlı değilse gerçek aktarım yapılmaz, eksikler
 * raporlanır.
 */
export const prepareMarketplaceSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        channel: z.enum(["amazon_us", "amazon_eu", "etsy", "ebay", "walmart", "allegro", "noon"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);

    const [channelRes, productsRes, customsRes] = await Promise.all([
      context.supabase
        .from("global_marketplace_channels")
        .select("channel, credentials_ready, target_currency")
        .eq("store_id", data.storeId)
        .eq("channel", data.channel)
        .maybeSingle(),
      context.supabase
        .from("products")
        .select("id, title, status, base_price, currency, description")
        .eq("store_id", data.storeId)
        .eq("status", "active")
        .limit(500),
      context.supabase
        .from("variant_customs_profiles")
        .select("hs_code, origin_country")
        .eq("store_id", data.storeId)
        .limit(500),
    ]);
    if (productsRes.error) throw new Error(productsRes.error.message);

    const products = productsRes.data ?? [];
    const missingDescription = products.filter((p) => !p.description).length;
    const missingCustoms = (customsRes.data ?? []).filter((row) => !row.hs_code).length;
    const credentialsReady = Boolean(channelRes.data?.credentials_ready);

    const { error } = await context.supabase
      .from("global_marketplace_channels")
      .update({
        last_sync_at: new Date().toISOString(),
        last_status: credentialsReady
          ? `${products.length} ürün aktarıma hazır`
          : "Hesap bilgisi bekleniyor — aktarım yapılmadı",
        synced_products: credentialsReady ? products.length : 0,
      })
      .eq("store_id", data.storeId)
      .eq("channel", data.channel);
    if (error) throw new Error(error.message);

    return {
      channel: data.channel,
      credentialsReady,
      readyProducts: products.length,
      missingDescription,
      missingCustoms,
      targetCurrency: String(channelRes.data?.target_currency ?? "USD"),
    };
  });

/* ---------------------------- dashboard widget'ları ---------------------- */

export const getGrowthDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, days: z.number().int().min(1).max(365).default(90) }).parse(data))
  .handler(async ({ data, context }) => {
    const { returnRate } = await import("@/lib/growth-export");
    const { normalizeCountryCode } = await import("@/lib/global-commerce");
    const normalizeCountryCodeSafe = (value: unknown) =>
      normalizeCountryCode(value == null ? "" : String(value), "TR");
    const since = new Date(Date.now() - data.days * 86400000).toISOString();

    const [partnersRes, conversionsRes, ordersRes, returnsRes, warehouseRes, docsRes] = await Promise.all([
      context.supabase
        .from("affiliate_partners")
        .select("id, name, country_code, commission_percent, payout_currency, is_active")
        .eq("store_id", data.storeId),
      context.supabase
        .from("affiliate_conversions")
        .select("partner_id, order_total, order_currency, commission_amount, commission_currency, status, created_at")
        .eq("store_id", data.storeId)
        .gte("created_at", since),
      context.supabase
        .from("orders")
        .select("id, grand_total, currency, shipping_address, payment_status, created_at")
        .eq("store_id", data.storeId)
        .gte("created_at", since)
        .limit(1000),
      context.supabase
        .from("international_return_labels")
        .select("id, origin_country, status, created_at")
        .eq("store_id", data.storeId)
        .gte("created_at", since),
      context.supabase
        .from("warehouse_inventory")
        .select("available, fulfillment_warehouses(name, country_code, provider)")
        .eq("store_id", data.storeId)
        .limit(1000),
      context.supabase
        .from("export_documents")
        .select("currency, total_value, payload, created_at")
        .eq("store_id", data.storeId)
        .gte("created_at", since)
        .limit(500),
    ]);

    const partners = partnersRes.data ?? [];
    const conversions = conversionsRes.data ?? [];
    const orders = ordersRes.data ?? [];
    const returns = returnsRes.data ?? [];

    const influencerRoi = partners
      .map((partner) => {
        const own = conversions.filter((c) => String(c.partner_id) === String(partner.id));
        const revenue = own.reduce((sum, c) => sum + Number(c.order_total ?? 0), 0);
        const commission = own.reduce((sum, c) => sum + Number(c.commission_amount ?? 0), 0);
        return {
          id: String(partner.id),
          name: String(partner.name),
          country: String(partner.country_code),
          orders: own.length,
          revenue: Math.round(revenue * 100) / 100,
          commission: Math.round(commission * 100) / 100,
          payoutCurrency: String(partner.payout_currency ?? "USD"),
          roi: commission > 0 ? Math.round((revenue / commission) * 10) / 10 : null,
          isActive: Boolean(partner.is_active),
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const byCountry = new Map<string, { orders: number; returns: number }>();
    for (const order of orders) {
      const address = (order.shipping_address ?? {}) as Record<string, unknown>;
      const code = normalizeCountryCodeSafe(address["country"]);
      const entry = byCountry.get(code) ?? { orders: 0, returns: 0 };
      entry.orders += 1;
      byCountry.set(code, entry);
    }
    for (const label of returns) {
      const code = normalizeCountryCodeSafe(label.origin_country);
      const entry = byCountry.get(code) ?? { orders: 0, returns: 0 };
      entry.returns += 1;
      byCountry.set(code, entry);
    }
    const returnAnalytics = Array.from(byCountry.entries())
      .map(([code, value]) => ({ country: code, ...value, rate: returnRate(value.orders, value.returns) }))
      .sort((a, b) => b.returns - a.returns || b.orders - a.orders);

    const stockMap = new Map<string, { name: string; country: string; provider: string; available: number }>();
    for (const row of warehouseRes.data ?? []) {
      const wh = (row as unknown as { fulfillment_warehouses: { name: string; country_code: string; provider: string } | null })
        .fulfillment_warehouses;
      if (!wh) continue;
      const key = `${wh.name}:${wh.country_code}`;
      const entry = stockMap.get(key) ?? {
        name: wh.name,
        country: wh.country_code,
        provider: wh.provider,
        available: 0,
      };
      entry.available += Number(row.available ?? 0);
      stockMap.set(key, entry);
    }

    const dutyByCountry = new Map<string, { duty: number; vat: number; currency: string }>();
    for (const doc of docsRes.data ?? []) {
      const detail = (doc.payload ?? {}) as Record<string, unknown>;
      const code = normalizeCountryCodeSafe(detail["destination_country"] ?? detail["country"]);
      const entry = dutyByCountry.get(code) ?? { duty: 0, vat: 0, currency: String(doc.currency ?? "USD") };
      entry.duty += Number(detail["duty_total"] ?? detail["duty"] ?? 0);
      entry.vat += Number(detail["vat_total"] ?? detail["vat"] ?? 0);
      dutyByCountry.set(code, entry);
    }

    return {
      influencerRoi,
      returnAnalytics,
      totalReturns: returns.length,
      totalOrders: orders.length,
      stockAllocation: Array.from(stockMap.values()).sort((a, b) => b.available - a.available),
      dutySummary: Array.from(dutyByCountry.entries()).map(([country, value]) => ({
        country,
        duty: Math.round(value.duty * 100) / 100,
        vat: Math.round(value.vat * 100) / 100,
        currency: value.currency,
      })),
      pendingCommission:
        Math.round(
          conversions
            .filter((c) => c.status !== "paid" && c.status !== "rejected")
            .reduce((sum, c) => sum + Number(c.commission_amount ?? 0), 0) * 100,
        ) / 100,
    };
  });
