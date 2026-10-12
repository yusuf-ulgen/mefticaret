import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateNetProfit, normalizeCountryCode } from "@/lib/global-commerce";

/**
 * Ultra-zengin e-ihracat suite sunucu uçları:
 * bölgesel katalog kuralları, varyant gümrük bilgileri, çoklu depo ve
 * döviz bazlı kârlılık raporu. Tüm yazmalar kullanıcı oturumuyla (RLS) yürür.
 */

const countryRuleSchema = z.object({
  storeId: z.string().uuid(),
  productId: z.string().uuid(),
  mode: z.enum(["all", "allow", "block"]),
  countryCodes: z.array(z.string().trim().length(2)).max(60),
  note: z.string().trim().max(300).nullable().optional(),
});

export const saveProductCountryRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => countryRuleSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("product_country_rules").upsert(
      {
        store_id: data.storeId,
        product_id: data.productId,
        mode: data.mode,
        country_codes: data.countryCodes.map((code) => code.toUpperCase()),
        note: data.note || null,
      } as never,
      { onConflict: "product_id" },
    );
    if (error) throw new Error(error.message);
    return { saved: true };
  });

export const deleteProductCountryRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ storeId: z.string().uuid(), id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_country_rules")
      .delete()
      .eq("store_id", data.storeId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  });

const variantCustomsSchema = z.object({
  storeId: z.string().uuid(),
  variantId: z.string().uuid(),
  hsCode: z.string().trim().max(20).nullable().optional(),
  originCountry: z.string().trim().length(2).nullable().optional(),
  weightGrams: z.number().int().min(0).max(200000).nullable().optional(),
  descriptionEn: z.string().trim().max(300).nullable().optional(),
});

export const saveVariantCustomsProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => variantCustomsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("variant_customs_profiles").upsert(
      {
        store_id: data.storeId,
        variant_id: data.variantId,
        hs_code: data.hsCode || null,
        origin_country: (data.originCountry || "TR").toUpperCase(),
        weight_grams: data.weightGrams ?? null,
        description_en: data.descriptionEn || null,
      } as never,
      { onConflict: "variant_id" },
    );
    if (error) throw new Error(error.message);
    return { saved: true };
  });

const warehouseSchema = z.object({
  storeId: z.string().uuid(),
  id: z.string().uuid().nullable().optional(),
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(120),
  provider: z.enum(["own", "amazon_fba", "shipbob", "third_party"]),
  countryCode: z.string().trim().length(2),
  city: z.string().trim().max(120).nullable().optional(),
  priority: z.number().int().min(0).max(100),
  isActive: z.boolean(),
  notes: z.string().trim().max(400).nullable().optional(),
});

export const saveFulfillmentWarehouse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => warehouseSchema.parse(data))
  .handler(async ({ data, context }) => {
    const payload = {
      store_id: data.storeId,
      code: data.code.toUpperCase(),
      name: data.name,
      provider: data.provider,
      country_code: data.countryCode.toUpperCase(),
      city: data.city || null,
      priority: data.priority,
      is_active: data.isActive,
      notes: data.notes || null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("fulfillment_warehouses")
        .update(payload as never)
        .eq("store_id", data.storeId)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { saved: true };
    }
    const { error } = await context.supabase
      .from("fulfillment_warehouses")
      .upsert(payload as never, { onConflict: "store_id,code" });
    if (error) throw new Error(error.message);
    return { saved: true };
  });

export const deleteFulfillmentWarehouse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ storeId: z.string().uuid(), id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("fulfillment_warehouses")
      .delete()
      .eq("store_id", data.storeId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  });

export const saveWarehouseStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        storeId: z.string().uuid(),
        warehouseId: z.string().uuid(),
        variantId: z.string().uuid(),
        available: z.number().int().min(0).max(1000000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("warehouse_inventory").upsert(
      {
        store_id: data.storeId,
        warehouse_id: data.warehouseId,
        variant_id: data.variantId,
        available: data.available,
      } as never,
      { onConflict: "warehouse_id,variant_id" },
    );
    if (error) throw new Error(error.message);
    return { saved: true };
  });

type OrderRow = {
  id: string;
  currency: string;
  grand_total: number | string;
  shipping_total: number | string | null;
  tax_total: number | string | null;
  display_currency: string | null;
  exchange_rate: number | string | null;
  shipping_address: { country?: string | null } | null;
};

/**
 * Ülke bazlı ciro, sipariş sayısı ve net kâr raporu.
 * Ciro gerçek siparişlerden, maliyet varyant alış fiyatından, kargo gideri
 * `global_shipments` kayıtlarından okunur; uydurma veri üretilmez.
 */
export const getGlobalProfitReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        storeId: z.string().uuid(),
        days: z.number().int().min(1).max(365).default(90),
        paymentFeePercent: z.number().min(0).max(25).default(3),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.days * 86400000).toISOString();
    const { data: orders, error } = await context.supabase
      .from("orders")
      .select(
        "id, currency, grand_total, shipping_total, tax_total, display_currency, exchange_rate, shipping_address, payment_status, created_at",
      )
      .eq("store_id", data.storeId)
      .gte("created_at", since)
      .in("payment_status", ["paid", "partially_refunded"]);
    if (error) throw new Error(error.message);

    const rows = (orders ?? []) as unknown as (OrderRow & { payment_status: string })[];
    const orderIds = rows.map((row) => row.id);

    const costByOrder = new Map<string, number>();
    if (orderIds.length > 0) {
      const { data: items, error: itemsError } = await context.supabase
        .from("order_items")
        .select("order_id, quantity, variant_id, product_variants(cost_price)")
        .eq("store_id", data.storeId)
        .in("order_id", orderIds);
      if (itemsError) throw new Error(itemsError.message);
      for (const item of (items ?? []) as unknown as {
        order_id: string;
        quantity: number;
        product_variants: { cost_price: number | string | null } | null;
      }[]) {
        const cost = Number(item.product_variants?.cost_price ?? 0) * Number(item.quantity ?? 0);
        costByOrder.set(item.order_id, (costByOrder.get(item.order_id) ?? 0) + cost);
      }
    }

    const shipByOrder = new Map<string, number>();
    if (orderIds.length > 0) {
      const { data: shipments, error: shipError } = await context.supabase
        .from("global_shipments")
        .select("order_id, cost")
        .eq("store_id", data.storeId)
        .in("order_id", orderIds);
      if (shipError) throw new Error(shipError.message);
      for (const row of (shipments ?? []) as unknown as { order_id: string; cost: number | string | null }[]) {
        shipByOrder.set(row.order_id, (shipByOrder.get(row.order_id) ?? 0) + Number(row.cost ?? 0));
      }
    }

    const byCountry = new Map<
      string,
      { country: string; orders: number; revenue: number; cogs: number; shipping: number; revenueTry: number }
    >();
    const byCurrency = new Map<string, { currency: string; orders: number; revenue: number; revenueTry: number }>();
    for (const row of rows) {
      const country = normalizeCountryCode(row.shipping_address?.country);
      const entry =
        byCountry.get(country) ??
        { country, orders: 0, revenue: 0, cogs: 0, shipping: 0, revenueTry: 0 };
      const revenue = Number(row.grand_total ?? 0);
      const rate = Number(row.exchange_rate ?? 0);
      entry.orders += 1;
      entry.revenue += revenue;
      entry.revenueTry += rate > 0 ? revenue * rate : revenue;
      entry.cogs += costByOrder.get(row.id) ?? 0;
      entry.shipping += shipByOrder.get(row.id) ?? Number(row.shipping_total ?? 0);
      byCountry.set(country, entry);

      // Döviz bazlı gelir: siparişin gösterim para birimi esas alınır.
      const currency = String(row.display_currency ?? row.currency ?? "TRY").toUpperCase().slice(0, 3);
      const fx = byCurrency.get(currency) ?? { currency, orders: 0, revenue: 0, revenueTry: 0 };
      fx.orders += 1;
      fx.revenue += revenue;
      fx.revenueTry += rate > 0 ? revenue * rate : revenue;
      byCurrency.set(currency, fx);
    }

    const countries = [...byCountry.values()]
      .map((entry) => {
        const profit = calculateNetProfit({
          revenue: entry.revenue,
          cogs: entry.cogs,
          shippingCost: entry.shipping,
          paymentFeePercent: data.paymentFeePercent,
          currencyToTryRate: entry.revenue > 0 ? entry.revenueTry / entry.revenue : 1,
        });
        return { ...entry, ...profit };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const currencies = [...byCurrency.values()].sort((a, b) => b.revenueTry - a.revenueTry);

    return {
      days: data.days,
      totalOrders: rows.length,
      countries,
      currencies,
      totals: {
        revenue: countries.reduce((sum, row) => sum + row.revenue, 0),
        netProfit: countries.reduce((sum, row) => sum + row.netProfit, 0),
        netProfitTry: countries.reduce((sum, row) => sum + row.netProfitTry, 0),
        revenueTry: currencies.reduce((sum, row) => sum + row.revenueTry, 0),
      },
    };
  });

/* ---------------------------- AI Çeviri Stüdyosu ---------------------------- */

/**
 * Seçili dile ürün başlığı, açıklaması ve SEO metalarını çevirir.
 * Mevcut çeviri motoru (`translation.server`) kullanılır; sonuç önizlemesi
 * gerçek `translation_entries` kayıtlarından okunur, uydurma metin dönmez.
 */
export const runTranslationStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        storeId: z.string().uuid(),
        locale: z.string().trim().min(2).max(5),
        limit: z.number().int().min(1).max(300).default(120),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);

    const locale = data.locale.slice(0, 2).toLowerCase();
    const {
      collectSourceItems,
      syncSourceEntries,
      translateEntries,
      ensureDefaultLocale,
      loadTranslationSettings,
    } = await import("@/lib/translation.server");
    const { isRtlLanguage, languageNative } = await import("@/lib/languages");

    const sourceLocale = await ensureDefaultLocale(context.supabase, data.storeId);
    if (locale === sourceLocale.slice(0, 2).toLowerCase()) {
      throw new Error("Hedef dil, mağazanın kaynak diliyle aynı olamaz");
    }

    const { error: localeError } = await context.supabase.from("store_locales").upsert(
      {
        store_id: data.storeId,
        code: locale,
        locale,
        label: locale.toUpperCase(),
        native_label: languageNative(locale),
        dir: isRtlLanguage(locale) ? "rtl" : "ltr",
        is_active: true,
        is_default: false,
      } as never,
      { onConflict: "store_id,locale" },
    );
    if (localeError) throw new Error(localeError.message);

    const settings = await loadTranslationSettings(context.supabase, data.storeId);
    const sourceItems = await collectSourceItems(context.supabase, data.storeId, ["product", "seo"]);
    await syncSourceEntries(context.supabase, data.storeId, locale, sourceItems);

    const { data: pending, error: pendingError } = await context.supabase
      .from("translation_entries")
      .select("id, translation_key, source_value, field")
      .eq("store_id", data.storeId)
      .eq("locale", locale)
      .in("content_type", ["product", "seo"])
      .in("status", ["missing", "needs_review"])
      // URL parçaları çevrilmez; aksi hâlde mevcut ürün bağlantıları bozulur.
      .neq("field", "slug")
      .limit(data.limit);
    if (pendingError) throw new Error(pendingError.message);

    let translated = 0;
    let reused = 0;
    let failed = 0;
    if (pending?.length) {
      const outcome = await translateEntries(context.supabase, {
        storeId: data.storeId,
        sourceLocale,
        targetLocale: locale,
        entries: pending,
        settings,
        userId: context.userId,
      });
      translated = outcome.translated;
      reused = outcome.reused;
      failed = outcome.failed;
    }

    const { data: preview, error: previewError } = await context.supabase
      .from("translation_entries")
      .select("field, content_type, source_value, translated_value, status, updated_at")
      .eq("store_id", data.storeId)
      .eq("locale", locale)
      .in("content_type", ["product", "seo"])
      .not("translated_value", "is", null)
      .neq("field", "slug")
      .order("updated_at", { ascending: false })
      .limit(20);
    if (previewError) throw new Error(previewError.message);

    const { count: remaining } = await context.supabase
      .from("translation_entries")
      .select("id", { count: "exact", head: true })
      .eq("store_id", data.storeId)
      .eq("locale", locale)
      .in("content_type", ["product", "seo"])
      .eq("status", "missing")
      .neq("field", "slug");

    return {
      locale,
      dir: isRtlLanguage(locale) ? ("rtl" as const) : ("ltr" as const),
      translated,
      reused,
      failed,
      remaining: remaining ?? 0,
      preview: (preview ?? []).map((row) => ({
        field: String((row as { field: string }).field),
        contentType: String((row as { content_type: string }).content_type),
        source: String((row as { source_value: string | null }).source_value ?? ""),
        target: String((row as { translated_value: string | null }).translated_value ?? ""),
        status: String((row as { status: string }).status),
      })),
    };
  });
