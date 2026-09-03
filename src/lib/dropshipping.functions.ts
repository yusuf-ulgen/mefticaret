import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Dropshipping ve tedarikçi besleme sunucu katmanı. Tenant izolasyonu RLS
 * (is_store_member / can_manage_store) ile zorlanır; besleme indirme ve
 * tedarikçiye sipariş gönderme yalnızca sunucuda çalışır.
 */

const storeGuard = async (supabase: any, storeId: string) => {
  const { data, error } = await supabase.from("stores").select("id").eq("id", storeId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
};

const fieldMapSchema = z
  .object({
    external_id: z.string().trim().max(120).optional(),
    sku: z.string().trim().max(120).optional(),
    barcode: z.string().trim().max(120).optional(),
    title: z.string().trim().max(120).optional(),
    brand: z.string().trim().max(120).optional(),
    category: z.string().trim().max(120).optional(),
    price: z.string().trim().max(120).optional(),
    stock: z.string().trim().max(120).optional(),
    images: z.string().trim().max(120).optional(),
    description: z.string().trim().max(120).optional(),
  })
  .default({});

const priceRulesSchema = z
  .object({
    mode: z.enum(["markup", "margin", "fixed"]).default("markup"),
    value: z.number().min(-0.9).max(100).default(0),
    rounding: z.enum(["none", "integer", "psychological"]).default("none"),
    minPrice: z.number().min(0).max(10_000_000).optional(),
    maxPrice: z.number().min(0).max(10_000_000).optional(),
  })
  .default({ mode: "markup", value: 0, rounding: "none" });

const stockRulesSchema = z
  .object({
    buffer: z.number().int().min(0).max(100_000).default(0),
    minThreshold: z.number().int().min(0).max(100_000).default(0),
    cap: z.number().int().min(0).max(1_000_000).optional(),
  })
  .default({ buffer: 0, minThreshold: 0 });

const mappingSchema = z.record(z.string().max(160), z.string().max(160)).default({});

export const saveSupplierFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        id: z.string().uuid().optional(),
        supplierId: z.string().uuid().nullish(),
        name: z.string().trim().min(2).max(120),
        kind: z.enum(["xml", "csv", "api"]),
        sourceUrl: z.string().trim().url().max(600),
        authHeader: z.string().trim().max(300).nullish(),
        schedule: z.enum(["manual", "hourly", "six_hourly", "daily"]).default("manual"),
        matchKey: z.enum(["sku", "barcode", "external_id"]).default("sku"),
        itemPath: z.string().trim().max(120).nullish(),
        fieldMap: fieldMapSchema,
        categoryMap: mappingSchema,
        brandMap: mappingSchema,
        priceRules: priceRulesSchema,
        stockRules: stockRulesSchema,
        importImages: z.boolean().default(true),
        createMissing: z.boolean().default(false),
        isActive: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await storeGuard(supabase, data.storeId);
    const { nextRunAt } = await import("@/lib/dropshipping");

    const payload = {
      store_id: data.storeId,
      supplier_id: data.supplierId || null,
      name: data.name,
      kind: data.kind,
      source_url: data.sourceUrl,
      auth_header: data.authHeader || null,
      schedule: data.schedule,
      match_key: data.matchKey,
      item_path: data.itemPath || null,
      field_map: data.fieldMap as never,
      category_map: data.categoryMap as never,
      brand_map: data.brandMap as never,
      price_rules: data.priceRules as never,
      stock_rules: data.stockRules as never,
      import_images: data.importImages,
      create_missing: data.createMissing,
      is_active: data.isActive,
      next_run_at: data.isActive ? nextRunAt(data.schedule) : null,
    };

    if (data.id) {
      const { error } = await supabase
        .from("supplier_feeds")
        .update(payload)
        .eq("id", data.id)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: inserted, error } = await supabase
      .from("supplier_feeds")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

export const deleteSupplierFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), feedId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("supplier_feeds")
      .delete()
      .eq("id", data.feedId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runSupplierFeedNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), feedId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await storeGuard(supabase, data.storeId);

    const { data: feed, error } = await supabase
      .from("supplier_feeds")
      .select("*")
      .eq("id", data.feedId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!feed) throw new Error("Besleme bulunamadı");

    const { runSupplierFeed } = await import("@/lib/dropshipping.server");
    return runSupplierFeed(supabase as never, feed as never, "manual");
  });

/** Kaynağı indirip ilk kayıtları döndürür: alan eşleştirme sihirbazı için. */
export const previewSupplierFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        kind: z.enum(["xml", "csv", "api"]),
        sourceUrl: z.string().trim().url().max(600),
        authHeader: z.string().trim().max(300).nullish(),
        itemPath: z.string().trim().max(120).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await storeGuard(context.supabase, data.storeId);
    const { parseFeedPayload } = await import("@/lib/dropshipping");

    const headers: Record<string, string> = { "user-agent": "Mefticaret-FeedSync/1.0" };
    if (data.authHeader) {
      const [name, ...rest] = data.authHeader.split(":");
      if (name && rest.length) headers[name.trim().toLowerCase()] = rest.join(":").trim();
    }
    const response = await fetch(data.sourceUrl, { headers, redirect: "follow" });
    if (!response.ok) throw new Error(`Kaynak yanıtı ${response.status}`);
    const body = await response.text();
    const records = parseFeedPayload(data.kind, body, data.itemPath);
    const fields = Array.from(new Set(records.slice(0, 20).flatMap((r) => Object.keys(r)))).slice(0, 80);
    const sample = records.slice(0, 3).map((record) =>
      Object.fromEntries(
        Object.entries(record).map(([key, value]) => [
          key,
          typeof value === "object" ? JSON.stringify(value) : String(value ?? ""),
        ]),
      ),
    );
    return { total: records.length, fields, sample };
  });

export const saveDropshipSupplierSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        supplierId: z.string().uuid(),
        isDropship: z.boolean(),
        leadTimeDays: z.number().int().min(0).max(180).default(3),
        currency: z.string().trim().min(3).max(3).default("TRY"),
        autoSendOrders: z.boolean().default(false),
        orderEndpoint: z.string().trim().url().max(600).nullish().or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("suppliers")
      .update({
        is_dropship: data.isDropship,
        lead_time_days: data.leadTimeDays,
        currency: data.currency.toUpperCase(),
        auto_send_orders: data.autoSendOrders,
        order_endpoint: data.orderEndpoint || null,
      })
      .eq("id", data.supplierId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const dispatchDropshipOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        orderId: z.string().uuid(),
        supplierId: z.string().uuid().nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await storeGuard(supabase, data.storeId);
    const { sendDropshipOrder } = await import("@/lib/dropshipping.server");
    return sendDropshipOrder(supabase as never, data.storeId, data.orderId, data.supplierId ?? null);
  });

export const updateDropshipOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        dropshipOrderId: z.string().uuid(),
        status: z.enum(["pending", "sent", "accepted", "shipped", "cancelled", "failed"]),
        carrier: z.string().trim().max(80).nullish(),
        trackingNumber: z.string().trim().max(80).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("dropship_orders")
      .update({
        status: data.status,
        carrier: data.carrier || null,
        tracking_number: data.trackingNumber || null,
      })
      .eq("id", data.dropshipOrderId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Besleme kategorilerini mağaza kategorileriyle otomatik eşleştirir. */
export const autoMapFeedCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), feedId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await storeGuard(supabase, data.storeId);
    const { autoMapFeedCategories: run } = await import("@/lib/xml-publish.server");
    return run(supabase as never, data.storeId, data.feedId);
  });

/** Tek tıkla yayınlama: siteye ve seçilen pazaryerlerine ürün aktarımı. */
export const publishFeedProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        feedId: z.string().uuid(),
        supplierProductIds: z.array(z.string().uuid()).max(1000).optional(),
        channelIds: z.array(z.string().uuid()).max(30).default([]),
        activate: z.boolean().default(true),
        onlyInStock: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await storeGuard(supabase, data.storeId);
    const { publishSupplierProducts } = await import("@/lib/xml-publish.server");
    const totals = await publishSupplierProducts(supabase as never, {
      storeId: data.storeId,
      feedId: data.feedId,
      ...(data.supplierProductIds ? { supplierProductIds: data.supplierProductIds } : {}),
      channelIds: data.channelIds,
      activate: data.activate,
      onlyInStock: data.onlyInStock,
    });
    return totals;
  });

/** Tedarikçiye kendi paneli için erişim verir/kaldırır (e-posta ile eşleşen hesap). */
export const setSupplierPortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        supplierId: z.string().uuid(),
        email: z.string().trim().email().max(200).optional(),
        enabled: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await storeGuard(supabase, data.storeId);

    if (!data.enabled) {
      const { error } = await supabase
        .from("suppliers")
        .update({ portal_enabled: false })
        .eq("id", data.supplierId)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      return { ok: true, portalUserId: null as string | null };
    }

    if (!data.email) throw new Error("Portal erişimi için tedarikçi e-postası gerekli");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", data.email)
      .limit(1)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);
    if (!profile) {
      throw new Error("Bu e-posta ile kayıtlı kullanıcı yok. Tedarikçi önce üye olmalı.");
    }

    const { error } = await supabase
      .from("suppliers")
      .update({ portal_enabled: true, portal_user_id: profile.id })
      .eq("id", data.supplierId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true, portalUserId: profile.id as string };
  });
