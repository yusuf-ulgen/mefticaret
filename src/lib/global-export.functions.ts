import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EXPORT_LOCALES, exportDocumentNumber, isRtlLocale, localizeForCountry } from "@/lib/global-commerce";

/**
 * Global & e-ihracat sunucu uçları.
 *
 * Tüm yazma işlemleri kullanıcı oturumuyla (RLS) yürütülür; mağaza yöneticisi
 * olmayan kullanıcı kayıt oluşturamaz. Belge içerikleri veritabanındaki gerçek
 * sipariş, ürün ve gümrük bilgilerinden üretilir; istemciden tutar alınmaz.
 */

const storeSchema = z.object({ storeId: z.string().uuid() });

const settingsSchema = z.object({
  storeId: z.string().uuid(),
  geoDetectEnabled: z.boolean(),
  fxBufferPercent: z.number().min(0).max(25),
  defaultIncoterm: z.enum(["DDP", "DDU"]),
  iossEnabled: z.boolean(),
  iossNumber: z.string().trim().max(40).nullable().optional(),
  ossEnabled: z.boolean(),
  usNexusStates: z.array(z.string().trim().length(2)).max(60),
  rtlAuto: z.boolean(),
  exporterName: z.string().trim().max(200).nullable().optional(),
  exporterTaxId: z.string().trim().max(60).nullable().optional(),
  exporterAddress: z.string().trim().max(400).nullable().optional(),
  exporterCity: z.string().trim().max(120).nullable().optional(),
  exporterCountry: z.string().trim().max(2).nullable().optional(),
  exporterPhone: z.string().trim().max(40).nullable().optional(),
  exporterEmail: z.string().trim().max(200).nullable().optional(),
  defaultHsCode: z.string().trim().max(20).nullable().optional(),
  autoTranslateLocales: z.array(z.string().trim().max(5)).max(12),
  priceRoundingRule: z
    .enum(["none", "end_99", "end_90", "nearest_integer", "nearest_5"])
    .default("none"),
  settlementCurrencies: z.array(z.string().trim().length(3)).max(10).default([]),
});

/** Ziyaretçinin ülkesini kenar sunucu başlığından okur (sahte veri üretmez). */
export const detectVisitorLocale = createServerFn({ method: "GET" }).handler(async () => {
  const country =
    getRequestHeader("cf-ipcountry") ??
    getRequestHeader("x-vercel-ip-country") ??
    getRequestHeader("x-country-code") ??
    null;
  const detected = country && country !== "XX" && country !== "T1" ? country.toUpperCase() : null;
  return { detected, ...localizeForCountry(detected) };
});

export const getGlobalSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => storeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("store_global_settings")
      .select("*")
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ?? null;
  });

export const saveGlobalSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => settingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const payload = {
      store_id: data.storeId,
      geo_detect_enabled: data.geoDetectEnabled,
      fx_buffer_percent: data.fxBufferPercent,
      default_incoterm: data.defaultIncoterm,
      ioss_enabled: data.iossEnabled,
      ioss_number: data.iossNumber || null,
      oss_enabled: data.ossEnabled,
      us_nexus_states: data.usNexusStates.map((state) => state.toUpperCase()),
      rtl_auto: data.rtlAuto,
      exporter_name: data.exporterName || null,
      exporter_tax_id: data.exporterTaxId || null,
      exporter_address: data.exporterAddress || null,
      exporter_city: data.exporterCity || null,
      exporter_country: (data.exporterCountry || "TR").toUpperCase(),
      exporter_phone: data.exporterPhone || null,
      exporter_email: data.exporterEmail || null,
      default_hs_code: data.defaultHsCode || null,
      auto_translate_locales: data.autoTranslateLocales,
      price_rounding_rule: data.priceRoundingRule,
      settlement_currencies: data.settlementCurrencies.map((code) => code.toUpperCase()),
    };
    const { error } = await context.supabase
      .from("store_global_settings")
      .upsert(payload as never, { onConflict: "store_id" });
    if (error) throw new Error(error.message);
    return { saved: true };
  });

const countryPriceSchema = z.object({
  storeId: z.string().uuid(),
  productId: z.string().uuid(),
  countryCode: z.string().trim().length(2),
  currency: z.string().trim().length(3),
  price: z.number().min(0),
  compareAtPrice: z.number().min(0).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const upsertCountryPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => countryPriceSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("country_prices").upsert(
      {
        store_id: data.storeId,
        product_id: data.productId,
        country_code: data.countryCode.toUpperCase(),
        currency: data.currency.toUpperCase(),
        price: data.price,
        compare_at_price: data.compareAtPrice ?? null,
        is_active: data.isActive,
      } as never,
      { onConflict: "store_id,product_id,country_code" },
    );
    if (error) throw new Error(error.message);
    return { saved: true };
  });

export const deleteCountryPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ storeId: z.string().uuid(), id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("country_prices")
      .delete()
      .eq("store_id", data.storeId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  });

const paymentMethodSchema = z.object({
  storeId: z.string().uuid(),
  provider: z.enum(["stripe", "paypal", "klarna", "sepa", "sofort"]),
  label: z.string().trim().min(2).max(120),
  countries: z.array(z.string().trim().length(2)).max(60),
  currencies: z.array(z.string().trim().length(3)).max(20),
  mode: z.enum(["test", "live"]),
  isActive: z.boolean(),
});

export const saveGlobalPaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => paymentMethodSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Anahtarlar gizli değişkenlerde tutulur; yöntem yalnızca anahtar varsa canlıya alınabilir.
    const { PAYMENT_PROVIDER_CATALOG } = await import("@/lib/global-commerce");
    const meta = PAYMENT_PROVIDER_CATALOG.find((row) => row.provider === data.provider);
    const ready = (meta?.secretNames ?? []).every((name) => Boolean(process.env[name]));
    if (data.isActive && !ready) {
      throw new Error(
        `${meta?.label ?? data.provider} için gerekli hesap bilgileri henüz kaydedilmedi. Yöntem etkinleştirilemez.`,
      );
    }
    const { error } = await context.supabase.from("global_payment_methods").upsert(
      {
        store_id: data.storeId,
        provider: data.provider,
        label: data.label,
        countries: data.countries.map((code) => code.toUpperCase()),
        currencies: data.currencies.map((code) => code.toUpperCase()),
        mode: data.mode,
        is_active: data.isActive,
        credentials_ready: ready,
        last_status: ready ? "ready" : "missing_credentials",
        last_error: ready ? null : "Sağlayıcı anahtarları eksik",
      } as never,
      { onConflict: "store_id,provider" },
    );
    if (error) throw new Error(error.message);
    return { saved: true, credentialsReady: ready };
  });

const carrierSchema = z.object({
  storeId: z.string().uuid(),
  carrierCode: z.enum(["dhl", "fedex", "ups", "ptt", "navlungo", "shipentegra", "aramex"]),
  label: z.string().trim().min(2).max(120),
  accountNumber: z.string().trim().max(60).nullable().optional(),
  mode: z.enum(["test", "live"]),
  isActive: z.boolean(),
});

export const saveGlobalCarrier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => carrierSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { CARRIER_CATALOG } = await import("@/lib/global-commerce");
    const meta = CARRIER_CATALOG.find((row) => row.code === data.carrierCode);
    const ready = (meta?.secretNames ?? []).every((name) => Boolean(process.env[name]));
    if (data.isActive && !ready) {
      throw new Error(
        `${meta?.label ?? data.carrierCode} hesap bilgileri kaydedilmeden taşıyıcı etkinleştirilemez.`,
      );
    }
    const { error } = await context.supabase.from("global_carriers").upsert(
      {
        store_id: data.storeId,
        carrier_code: data.carrierCode,
        label: data.label,
        account_number: data.accountNumber || null,
        mode: data.mode,
        is_active: data.isActive,
        credentials_ready: ready,
        supports_micro_export: meta?.microExport ?? true,
        last_status: ready ? "ready" : "missing_credentials",
        last_error: ready ? null : "Taşıyıcı API bilgileri eksik",
      } as never,
      { onConflict: "store_id,carrier_code" },
    );
    if (error) throw new Error(error.message);
    return { saved: true, credentialsReady: ready };
  });

const customsSchema = z.object({
  storeId: z.string().uuid(),
  productId: z.string().uuid(),
  hsCode: z.string().trim().max(20).nullable().optional(),
  originCountry: z.string().trim().length(2).default("TR"),
  weightGrams: z.number().int().min(0).nullable().optional(),
  descriptionEn: z.string().trim().max(400).nullable().optional(),
  material: z.string().trim().max(200).nullable().optional(),
});

export const saveCustomsProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => customsSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("customs_profiles").upsert(
      {
        store_id: data.storeId,
        product_id: data.productId,
        hs_code: data.hsCode || null,
        origin_country: data.originCountry.toUpperCase(),
        weight_grams: data.weightGrams ?? null,
        description_en: data.descriptionEn || null,
        material: data.material || null,
      } as never,
      { onConflict: "store_id,product_id" },
    );
    if (error) throw new Error(error.message);
    return { saved: true };
  });

const documentSchema = z.object({
  storeId: z.string().uuid(),
  orderId: z.string().uuid(),
  kind: z.enum(["commercial_invoice", "packing_list", "etgb"]),
  incoterm: z.enum(["DDP", "DDU"]),
});

/**
 * İngilizce ticari fatura / paket listesi / ETGB beyan verisini gerçek siparişten üretir.
 * Tutarlar siparişin kendi para biriminde ve veritabanındaki değerlerle yazılır.
 */
export const createExportDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => documentSchema.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, order_number, placed_at, currency, subtotal, shipping_total, tax_total, grand_total, customer_email, customer_name, shipping_address",
      )
      .eq("store_id", data.storeId)
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Sipariş bulunamadı veya yetkiniz yok");

    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("id, product_id, title, quantity, unit_price, line_total")
      .eq("order_id", data.orderId);
    if (itemsError) throw new Error(itemsError.message);

    const productIds = (items ?? []).map((item) => item.product_id).filter(Boolean) as string[];
    const { data: customs } = productIds.length
      ? await supabase
          .from("customs_profiles")
          .select("product_id, hs_code, origin_country, weight_grams, description_en, material")
          .eq("store_id", data.storeId)
          .in("product_id", productIds)
      : { data: [] as never[] };

    const { data: settings } = await supabase
      .from("store_global_settings")
      .select("*")
      .eq("store_id", data.storeId)
      .maybeSingle();

    const { count } = await supabase
      .from("export_documents")
      .select("id", { count: "exact", head: true })
      .eq("store_id", data.storeId)
      .eq("kind", data.kind);

    const prefixes: Record<string, string> = {
      commercial_invoice: "CI",
      packing_list: "PL",
      etgb: "ETGB",
    };
    const documentNumber = exportDocumentNumber(prefixes[data.kind] ?? "DOC", (count ?? 0) + 1);

    const customsByProduct = new Map(
      (customs ?? []).map((row: Record<string, unknown>) => [String(row["product_id"]), row]),
    );

    const lines = (items ?? []).map((item) => {
      const profile = item.product_id ? customsByProduct.get(String(item.product_id)) : undefined;
      return {
        description:
          (profile?.["description_en"] as string | undefined) || String(item.title ?? "Item"),
        hsCode: (profile?.["hs_code"] as string | undefined) || settings?.default_hs_code || null,
        originCountry: (profile?.["origin_country"] as string | undefined) || "TR",
        quantity: Number(item.quantity ?? 0),
        unitPrice: Number(item.unit_price ?? 0),
        total: Number(item.line_total ?? 0),
        weightGrams: (profile?.["weight_grams"] as number | undefined) ?? null,
        material: (profile?.["material"] as string | undefined) ?? null,
      };
    });

    const payload = {
      documentKind: data.kind,
      incoterm: data.incoterm,
      issuedAt: new Date().toISOString(),
      order: {
        number: order.order_number,
        placedAt: order.placed_at,
        currency: order.currency,
        subtotal: Number(order.subtotal ?? 0),
        shipping: Number(order.shipping_total ?? 0),
        tax: Number(order.tax_total ?? 0),
        total: Number(order.grand_total ?? 0),
      },
      exporter: {
        name: settings?.exporter_name ?? null,
        taxId: settings?.exporter_tax_id ?? null,
        address: settings?.exporter_address ?? null,
        city: settings?.exporter_city ?? null,
        country: settings?.exporter_country ?? "TR",
        phone: settings?.exporter_phone ?? null,
        email: settings?.exporter_email ?? null,
        iossNumber: settings?.ioss_number ?? null,
      },
      consignee: {
        name: order.customer_name ?? null,
        email: order.customer_email ?? null,
        address: order.shipping_address ?? null,
      },
      lines,
      totals: {
        pieces: lines.reduce((sum, line) => sum + line.quantity, 0),
        weightGrams: lines.reduce(
          (sum, line) => sum + (line.weightGrams ?? 0) * line.quantity,
          0,
        ),
        goodsValue: lines.reduce((sum, line) => sum + line.total, 0),
      },
      declaration:
        "We declare that the information contained in this invoice is true and correct and that the contents of this shipment are as stated above.",
    };

    const { data: inserted, error } = await supabase
      .from("export_documents")
      .insert({
        store_id: data.storeId,
        order_id: data.orderId,
        kind: data.kind,
        document_number: documentNumber,
        incoterm: data.incoterm,
        currency: String(order.currency ?? "USD"),
        total_value: payload.totals.goodsValue,
        payload: payload as never,
        created_by: context.userId,
      } as never)
      .select("id, document_number")
      .maybeSingle();
    if (error) throw new Error(error.message);

    return { id: inserted?.id ?? null, documentNumber };
  });

const shipmentLabelSchema = z.object({
  storeId: z.string().uuid(),
  orderId: z.string().uuid(),
  carrierCode: z.enum(["dhl", "fedex", "ups", "ptt", "navlungo", "shipentegra", "aramex"]),
  service: z.string().trim().max(120).nullable().optional(),
  incoterm: z.enum(["DDP", "DDU"]),
});

/** Gerçek sipariş ve ETGB kaydından yazdırılabilir taslak kargo etiketi oluşturur. */
export const createGlobalShipmentLabel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => shipmentLabelSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_number, customer_name, customer_email, customer_phone, shipping_address, currency")
      .eq("store_id", data.storeId)
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Sipariş bulunamadı veya yetkiniz yok");

    const [{ data: settings }, { data: items }, { data: declaration }] = await Promise.all([
      supabase.from("store_global_settings").select("exporter_name, exporter_address, exporter_city, exporter_country, exporter_phone").eq("store_id", data.storeId).maybeSingle(),
      supabase.from("order_items").select("product_id, quantity").eq("order_id", data.orderId),
      supabase.from("export_documents").select("id, document_number").eq("store_id", data.storeId).eq("order_id", data.orderId).eq("kind", "etgb").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!declaration) throw new Error("Önce bu sipariş için mikro ihracat beyannamesi oluşturun");

    const productIds = (items ?? []).map((item) => item.product_id).filter(Boolean) as string[];
    const { data: customs } = productIds.length
      ? await supabase.from("customs_profiles").select("product_id, weight_grams").eq("store_id", data.storeId).in("product_id", productIds)
      : { data: [] as { product_id: string; weight_grams: number | null }[] };
    const weights = new Map((customs ?? []).map((row) => [row.product_id, Number(row.weight_grams ?? 0)]));
    const pieces = (items ?? []).reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
    const weightGrams = (items ?? []).reduce((sum, item) => sum + (weights.get(String(item.product_id)) ?? 0) * Number(item.quantity ?? 0), 0);
    const address = (order.shipping_address ?? {}) as Record<string, unknown>;
    const rawCountry = String(address["country_code"] ?? address["country"] ?? "").toUpperCase();
    const destinationCountry = rawCountry === "TÜRKİYE" ? "TR" : rawCountry.slice(0, 2) || null;
    const labelPayload = {
      orderNumber: order.order_number,
      exporter: { name: settings?.exporter_name ?? null, address: settings?.exporter_address ?? null, city: settings?.exporter_city ?? null, country: settings?.exporter_country ?? "TR", phone: settings?.exporter_phone ?? null },
      consignee: { name: order.customer_name, email: order.customer_email, phone: order.customer_phone, address: order.shipping_address },
      pieces,
      documentNumber: declaration.document_number,
    };

    const { data: shipment, error } = await supabase.from("global_shipments").insert({
      store_id: data.storeId, order_id: data.orderId, carrier_code: data.carrierCode,
      service: data.service || null, tracking_number: null, label_url: null,
      export_document_id: declaration.id, label_payload: labelPayload, incoterm: data.incoterm,
      destination_country: destinationCountry, weight_grams: weightGrams || null,
      currency: order.currency, status: "draft", last_event: "Sipariş ve ETGB verilerinden taslak etiket oluşturuldu",
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: shipment.id };
  });

/* ------------------------------------------------- otomatik ihracat çevirisi */

/**
 * Mağazayı ihracat dillerine hazırlar: seçili dilleri vitrine ekler,
 * çevrilecek içerikleri (ürün, kategori, sayfa, blog, SEO, sistem metinleri)
 * tarar ve toplu AI çeviri işini başlatıp ilk turlarını çalıştırır.
 */
export const runGlobalAutoTranslate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        locales: z.array(z.string().trim().min(2).max(5)).min(1).max(10).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(supabase, data.storeId, userId);

    const { data: settings } = await supabase
      .from("store_global_settings")
      .select("auto_translate_locales")
      .eq("store_id", data.storeId)
      .maybeSingle();

    const chosen = data.locales?.length ? data.locales : (settings?.auto_translate_locales ?? []);
    const requested = (chosen.length ? chosen : ["en"])
      .map((code) => String(code).slice(0, 2).toLowerCase())
      .filter((code) => EXPORT_LOCALES.some((entry) => entry.code === code));
    const targets = [...new Set(requested)];
    if (targets.length === 0) throw new Error("Çevrilecek dil seçilmedi");

    const { ensureDefaultLocale, createTranslationJob, runTranslationJob } = await import(
      "@/lib/translation.server"
    );
    // Kaynak dil hedeflerden önce sabitlenir; aksi hâlde ilk eklenen dil
    // yanlışlıkla varsayılan olur ve çeviri yönü ters döner.
    const sourceLocale = await ensureDefaultLocale(supabase, data.storeId);

    const { languageNative } = await import("@/lib/languages");
    for (const code of targets.filter((code) => code !== sourceLocale.slice(0, 2).toLowerCase())) {
      const label = EXPORT_LOCALES.find((entry) => entry.code === code)?.label ?? code;
      const { error } = await supabase.from("store_locales").upsert(
        {
          store_id: data.storeId,
          code,
          locale: code,
          label,
          native_label: languageNative(code),
          dir: isRtlLocale(code) ? "rtl" : "ltr",
          is_active: true,
          is_default: false,
        },
        { onConflict: "store_id,locale" },
      );
      if (error) throw new Error(error.message);
    }

    const job = await createTranslationJob(supabase, {
      storeId: data.storeId,
      sourceLocale,
      targetLocales: targets,
      // Vitrin ve siparişlerde görünen tüm metinler.
      contentTypes: ["product", "variant", "category", "collection", "page", "blog", "seo", "system", "email"],
      userId,
      onlyMissing: true,
    });

    // İlk turları hemen çalıştır; kalanı kuyruk worker'ı tamamlar.
    let processed = 0;
    let remaining = job.total;
    for (let round = 0; round < 3 && remaining > 0; round += 1) {
      const outcome = await runTranslationJob(supabase, job.jobId, 50);
      processed += outcome.processed;
      remaining = outcome.remaining;
      if (outcome.processed === 0) break;
    }

    return { jobId: job.jobId, locales: targets, total: job.total, processed, remaining };
  });

/** Yayındaki ürünlerin vitrin ve SEO alanlarını hedef dillerde öncelikli tamamlar. */
export const translatePublishedProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.string().uuid(), locales: z.array(z.enum(["en", "de", "ar"])).min(1).max(3) }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { data: products, error: productError } = await context.supabase.from("products").select("id").eq("store_id", data.storeId).eq("status", "active").limit(100);
    if (productError) throw new Error(productError.message);
    const ids = (products ?? []).map((row) => row.id);
    if (ids.length === 0) return { translated: 0, reused: 0, failed: 0 };

    const { collectSourceItems, syncSourceEntries, translateEntries, ensureDefaultLocale, loadTranslationSettings } = await import("@/lib/translation.server");
    const sourceLocale = await ensureDefaultLocale(context.supabase, data.storeId);
    const settings = await loadTranslationSettings(context.supabase, data.storeId);
    const sourceItems = (await collectSourceItems(context.supabase, data.storeId, ["product", "seo"])).filter((item) => item.entityId && ids.includes(item.entityId));
    let translated = 0;
    let reused = 0;
    let failed = 0;
    for (const locale of data.locales) {
      await syncSourceEntries(context.supabase, data.storeId, locale, sourceItems);
      const { data: entries, error } = await context.supabase.from("translation_entries")
        .select("id, translation_key, source_value, field")
        .eq("store_id", data.storeId).eq("locale", locale).in("entity_id", ids)
        .in("content_type", ["product", "seo"]).in("status", ["missing", "needs_review"])
        .limit(500);
      if (error) throw new Error(error.message);
      if (!entries?.length) continue;
      const outcome = await translateEntries(context.supabase, { storeId: data.storeId, sourceLocale, targetLocale: locale, entries, settings, userId: context.userId });
      translated += outcome.translated;
      reused += outcome.reused;
      failed += outcome.failed;
    }
    return { translated, reused, failed };
  });
