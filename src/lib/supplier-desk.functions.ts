import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Tedarikçi portalı sunucu fonksiyonları: fulfillment masası, toplu ürün
 * yükleme, otomatik senkron, komisyon defteri ve ödeme talepleri.
 * Her çağrıda kullanıcının kendi tedarikçi kayıtları doğrulanır.
 */

const assertSupplier = async (supabase: any, userId: string, supplierId?: string) => {
  const { listPortalSuppliers } = await import("@/lib/supplier-portal.server");
  const suppliers = await listPortalSuppliers(supabase, userId);
  if (!suppliers.length) throw new Error("Tedarikçi portal erişiminiz bulunmuyor");
  if (!supplierId) return { suppliers, supplier: suppliers[0]! };
  const supplier = suppliers.find((row) => row.id === supplierId);
  if (!supplier) throw new Error("Bu tedarikçi kaydına erişiminiz yok");
  return { suppliers, supplier };
};

/** İçe aktarma tetikleyicileri: kullanıcı başına 10 istek/dakika. */
const assertImportRate = async (userId: string) => {
  const { consumeRateLimit, RATE_LIMITS } = await import("@/lib/rate-limit.server");
  const result = await consumeRateLimit(`supplier_import:${userId}`, RATE_LIMITS.import_trigger);
  if (!result.allowed) {
    throw new Error("Çok fazla içe aktarma denemesi. Lütfen bir dakika sonra tekrar deneyin.");
  }
};

const rowSchema = z.object({
  index: z.number(),
  sku: z.string().trim().min(1),
  barcode: z.string().nullable(),
  title: z.string().trim().min(1),
  description: z.string().nullable(),
  shortDescription: z.string().nullable().default(null),
  costPrice: z.number(),
  retailPrice: z.number().nullable(),
  discountPrice: z.number().nullable().default(null),
  taxRate: z.number().nullable().default(null),
  stock: z.number(),
  category: z.string().nullable(),
  categoryPath: z.array(z.string()).max(6).default([]),
  brand: z.string().nullable(),
  images: z.array(z.string()),
  videos: z
    .array(
      z.object({
        url: z.string(),
        source: z.string(),
        embedUrl: z.string(),
        thumbnailUrl: z.string().nullable(),
      }),
    )
    .max(6)
    .default([]),
  color: z.string().nullable(),
  size: z.string().nullable(),
  currency: z.string().nullable(),
  fabric: z.string().nullable().default(null),
  modelSize: z.string().nullable().default(null),
  hsCode: z.string().nullable().default(null),
  weight: z.number().nullable().default(null),
  variants: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
        barcode: z.string().nullable(),
        stock: z.number(),
        price: z.number().nullable(),
        image: z.string().nullable(),
      }),
    )
    .max(60)
    .default([]),
  warnings: z.array(z.string()).default([]),
  errors: z.array(z.string()),
});

export const supplierDeskOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { listPortalSuppliers } = await import("@/lib/supplier-portal.server");
    const suppliers = await listPortalSuppliers(supabase, userId);
    if (!suppliers.length) {
      // Erişim yoksa hata fırlatmak yerine boş panel durumu döndürülür.
      return {
        hasAccess: false as boolean,
        suppliers: [] as {
          id: string;
          name: string;
          storeId: string;
          currency: string;
          leadTimeDays: number | null;
        }[],
        orders: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierDeskOrders>
        >,
        ledger: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierLedger>
        >["ledger"],
        payouts: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierLedger>
        >["payouts"],
        feeds: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierFeeds>
        >["feeds"],
        importJobs: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierFeeds>
        >["jobs"],
        products: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierWorkspace>
        >["products"],
        rfqs: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierWorkspace>
        >["rfqs"],
        credit: null as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierWorkspace>
        >["credit"],
        transactions: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierWorkspace>
        >["transactions"],
        movements: [] as Awaited<
          ReturnType<typeof import("@/lib/supplier-desk.server").loadSupplierWorkspace>
        >["movements"],
      };
    }
    const supplierIds = suppliers.map((supplier) => supplier.id);

    const { loadSupplierDeskOrders, loadSupplierLedger, loadSupplierFeeds, loadSupplierWorkspace } = await import(
      "@/lib/supplier-desk.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [orders, ledger, feeds, workspace] = await Promise.all([
      loadSupplierDeskOrders(supabaseAdmin as never, supplierIds, 200),
      loadSupplierLedger(supabaseAdmin as never, suppliers as never),
      loadSupplierFeeds(supabaseAdmin as never, supplierIds),
      loadSupplierWorkspace(supabaseAdmin as never, suppliers as never),
    ]);

    return {
      hasAccess: true as boolean,
      suppliers: suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        storeId: supplier.store_id,
        currency: supplier.currency || "TRY",
        leadTimeDays: supplier.lead_time_days,
      })),
      orders,
      ledger: ledger.ledger,
      payouts: ledger.payouts,
      feeds: feeds.feeds,
      importJobs: feeds.jobs,
      ...workspace,
    };
  });

/** Seçili tedarikçi ürünlerini mağaza kataloğuna aktarır; sonraki senkronlar canlı fiyat/stoku günceller. */
export const supplierDeskPublishProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ supplierId: z.guid(), productIds: z.array(z.guid()).min(1).max(500) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supplier } = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("supplier_products")
      .select("id, feed_id").eq("supplier_id", supplier.id).eq("store_id", supplier.store_id).in("id", data.productIds);
    if (error) throw new Error(error.message);
    if ((rows ?? []).length !== data.productIds.length) throw new Error("Ürünlerden biri bu tedarikçiye ait değil");
    const { publishSupplierProducts } = await import("@/lib/xml-publish.server");
    const byFeed = new Map<string, string[]>();
    for (const row of (rows ?? []) as { id: string; feed_id: string }[]) {
      byFeed.set(row.feed_id, [...(byFeed.get(row.feed_id) ?? []), row.id]);
    }
    const totals = { processed: 0, productsCreated: 0, productsActivated: 0, skipped: 0 };
    for (const [feedId, supplierProductIds] of byFeed) {
      const result = await publishSupplierProducts(supabaseAdmin as never, {
        storeId: supplier.store_id, feedId, supplierProductIds, channelIds: [], activate: true, onlyInStock: false,
      });
      totals.processed += result.processed;
      totals.productsCreated += result.productsCreated;
      totals.productsActivated += result.productsActivated;
      totals.skipped += result.skipped;
    }
    return totals;
  });

/** Tedarikçinin kendi ürünlerinden gerçek RFQ teklifi oluşturur. */
export const supplierDeskCreateRfq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({
    supplierId: z.guid(), companyName: z.string().trim().min(2).max(200),
    validDays: z.number().int().min(1).max(180).default(30),
    items: z.array(z.object({ supplierProductId: z.guid(), quantity: z.number().int().min(1).max(100000) })).min(1).max(50),
  }).parse(data))
  .handler(async ({ data, context }) => {
    const { supplier } = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = data.items.map((item) => item.supplierProductId);
    const { data: products, error } = await supabaseAdmin.from("supplier_products")
      .select("id, title, sku, supplier_price, computed_price, currency").eq("supplier_id", supplier.id).eq("store_id", supplier.store_id).in("id", ids);
    if (error) throw new Error(error.message);
    if ((products ?? []).length !== ids.length) throw new Error("Teklif ürünlerinden biri bu tedarikçiye ait değil");
    const rows = (products ?? []) as any[];
    const items = data.items.map((item) => {
      const product = rows.find((row) => row.id === item.supplierProductId);
      const unitPrice = Number(product?.computed_price ?? product?.supplier_price ?? 0);
      return { supplierProductId: item.supplierProductId, title: String(product?.title ?? "Ürün"), sku: product?.sku ?? null, quantity: item.quantity, unitPrice, lineTotal: unitPrice * item.quantity };
    });
    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
    const reference = `RFQ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    const validUntil = new Date(Date.now() + data.validDays * 86_400_000).toISOString().slice(0, 10);
    const { data: created, error: insertError } = await supabaseAdmin.from("rfq_requests").insert({
      store_id: supplier.store_id, supplier_id: supplier.id, reference, company_name: data.companyName,
      currency: supplier.currency || "TRY", items, requested_total: total, quoted_total: total,
      status: "quoted", valid_until: validUntil,
    }).select("id").single();
    if (insertError) throw new Error(insertError.message);
    return { id: (created as { id: string }).id, reference, total };
  });

/** Teklifi onaylar ve bağlı gerçek satın alma siparişini üretir. */
export const supplierDeskApproveRfq = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ supplierId: z.guid(), rfqId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supplier } = await assertSupplier(context.supabase, context.userId, data.supplierId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rfq, error } = await supabaseAdmin.from("rfq_requests").select("*")
      .eq("id", data.rfqId).eq("supplier_id", supplier.id).eq("store_id", supplier.store_id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!rfq) throw new Error("Teklif bulunamadı veya yetkiniz yok");
    if (rfq.purchase_order_id) return { purchaseOrderId: rfq.purchase_order_id };
    const items = Array.isArray(rfq.items) ? rfq.items as any[] : [];
    if (!items.length) throw new Error("Teklifte sipariş kalemi bulunmuyor");
    const productIds = items.map((item) => item.supplierProductId).filter(Boolean);
    const { data: products } = await supabaseAdmin.from("supplier_products").select("id, product_id, variant_id, title, sku")
      .eq("supplier_id", supplier.id).in("id", productIds);
    if ((products ?? []).length !== productIds.length) throw new Error("Teklif ürünleri doğrulanamadı");
    const code = `SA-${String(rfq.reference).replace(/^RFQ-/, "")}`;
    const { data: order, error: orderError } = await supabaseAdmin.from("purchase_orders").insert({
      store_id: supplier.store_id, supplier_id: supplier.id, code, status: "ordered",
      currency: rfq.currency || supplier.currency || "TRY", expected_at: rfq.valid_until,
      note: `${rfq.reference} teklifinden oluşturuldu`, created_by: context.userId,
    }).select("id").single();
    if (orderError) throw new Error(orderError.message);
    const purchaseOrderId = (order as { id: string }).id;
    const details = items.map((item) => {
      const product = (products ?? []).find((row: any) => row.id === item.supplierProductId) as any;
      return { store_id: supplier.store_id, purchase_order_id: purchaseOrderId, product_id: product?.product_id ?? null,
        variant_id: product?.variant_id ?? null, title: item.title, sku: item.sku ?? product?.sku ?? null,
        quantity: Number(item.quantity), unit_cost: Number(item.unitPrice) };
    });
    const { error: itemError } = await supabaseAdmin.from("purchase_order_items").insert(details);
    if (itemError) {
      await supabaseAdmin.from("purchase_orders").delete().eq("id", purchaseOrderId);
      throw new Error(itemError.message);
    }
    const { error: updateError } = await supabaseAdmin.from("rfq_requests").update({ status: "won", purchase_order_id: purchaseOrderId }).eq("id", rfq.id);
    if (updateError) throw new Error(updateError.message);
    return { purchaseOrderId };
  });

/** Uzak bağlantıdaki dosyayı indirip ham satırları döndürür (alan eşleştirme için). */
export const supplierDeskFetchRemote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        supplierId: z.guid(),
        url: z.string().url().max(2000),
        itemPath: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSupplier(supabase, userId, data.supplierId);
    await assertImportRate(userId);

    const response = await fetch(data.url, { headers: { "user-agent": "MefticaretSupplierPortal/1.0" } });
    if (!response.ok) throw new Error(`Kaynak yanıtı ${response.status}`);
    const text = await response.text();
    if (text.length > 25_000_000) throw new Error("Dosya çok büyük (25 MB üstü)");

    const { detectFormat, parseTextFeed, suggestMapping } = await import("@/lib/supplier-import");
    const format = detectFormat(data.url, text);
    if (format === "xlsx") throw new Error("Excel bağlantıları desteklenmiyor; dosyayı yükleyin");
    const parsed = parseTextFeed(text, format, data.itemPath);
    return {
      format,
      columns: parsed.columns,
      rows: parsed.rows.slice(0, 2000),
      totalRows: parsed.rows.length,
      mapping: suggestMapping(parsed.columns),
    };
  });

/** Doğrulanmış satırları tedarikçi kataloğuna yazar ve yükleme kaydı oluşturur. */
export const supplierDeskImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        supplierId: z.guid(),
        source: z.enum(["file", "url"]),
        format: z.enum(["csv", "xml", "xlsx", "json"]),
        fileName: z.string().trim().max(240).optional(),
        sourceUrl: z.string().trim().max(2000).optional(),
        fieldMap: z.record(z.string(), z.string()).default({}),
        rows: z.array(rowSchema).max(5000),
        invalidCount: z.number().int().min(0).default(0),
        errorRows: z
          .array(z.object({ line: z.number(), sku: z.string(), errors: z.array(z.string()) }))
          .max(200)
          .default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supplier } = await assertSupplier(supabase, userId, data.supplierId);
    await assertImportRate(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Portal yüklemeleri için tedarikçiye ait bir besleme kaydı kullanılır.
    const { data: feeds } = await supabaseAdmin
      .from("supplier_feeds")
      .select("id")
      .eq("supplier_id", supplier.id)
      .eq("store_id", supplier.store_id)
      .limit(1);
    let feedId = (feeds ?? [])[0]?.id as string | undefined;
    if (!feedId) {
      const { data: created, error: feedError } = await supabaseAdmin
        .from("supplier_feeds")
        .insert({
          store_id: supplier.store_id,
          supplier_id: supplier.id,
          name: `${supplier.name} portal yüklemesi`,
          kind: data.format === "xml" ? "xml" : "csv",
          source_url: data.sourceUrl || "portal://upload",
          schedule: "manual",
          is_active: true,
          match_key: "sku",
        } as never)
        .select("id")
        .single();
      if (feedError) throw new Error(feedError.message);
      feedId = (created as { id: string }).id;
    }

    const rows = data.rows.filter((row) => row.errors.length === 0);
    const invalidCount = data.invalidCount;
    const totalRows = rows.length + invalidCount;

    // Ağır işleme (binlerce satır) istek içinde yapılmaz: kayıt "kuyrukta" açılır,
    // satırlar arka plan worker'ı tarafından işlenir (en fazla 3 deneme).
    const { data: job, error: jobError } = await supabaseAdmin
      .from("supplier_import_jobs")
      .insert({
        store_id: supplier.store_id,
        supplier_id: supplier.id,
        source: data.source,
        file_name: data.fileName ?? null,
        source_url: data.sourceUrl ?? null,
        format: data.format,
        row_count: totalRows,
        valid_count: 0,
        error_count: invalidCount,
        created_count: 0,
        updated_count: 0,
        field_map: data.fieldMap as never,
        errors: data.errorRows as never,
        status: "queued",
        created_by: userId,
      } as never)
      .select("id")
      .single();
    if (jobError) throw new Error(jobError.message);
    const importJobId = (job as { id: string }).id;

    const { enqueueJob } = await import("@/lib/queue.server");
    await enqueueJob(supabaseAdmin as never, {
      kind: "feed_sync",
      storeId: supplier.store_id,
      priority: 5,
      maxAttempts: 3,
      payload: {
        importJobId,
        storeId: supplier.store_id,
        supplierId: supplier.id,
        feedId,
        currency: supplier.currency || "TRY",
        rows,
        invalidCount,
      },
    });

    return { queued: true as boolean, importJobId, invalid: invalidCount, total: totalRows };
  });

/** Otomatik senkron ayarı: uzak XML/CSV bağlantısı ve saatlik/günlük plan. */
export const supplierDeskSaveFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        supplierId: z.guid(),
        feedId: z.guid().optional(),
        name: z.string().trim().min(2).max(120),
        kind: z.enum(["xml", "csv", "json"]),
        sourceUrl: z.string().url().max(2000),
        schedule: z.enum(["manual", "hourly", "daily"]),
        itemPath: z.string().trim().max(120).optional(),
        isActive: z.boolean().default(true),
        fieldMap: z.record(z.string(), z.string()).default({}),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supplier } = await assertSupplier(supabase, userId, data.supplierId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const next =
      data.schedule === "hourly"
        ? new Date(Date.now() + 3_600_000).toISOString()
        : data.schedule === "daily"
          ? new Date(Date.now() + 86_400_000).toISOString()
          : null;

    const payload = {
      store_id: supplier.store_id,
      supplier_id: supplier.id,
      name: data.name,
      kind: data.kind,
      source_url: data.sourceUrl,
      schedule: data.schedule,
      item_path: data.itemPath || null,
      is_active: data.isActive,
      match_key: "sku",
      field_map: data.fieldMap as never,
      next_run_at: next,
    };

    if (data.feedId) {
      const { data: existing } = await supabaseAdmin
        .from("supplier_feeds")
        .select("id, supplier_id")
        .eq("id", data.feedId)
        .maybeSingle();
      if (!existing || (existing as { supplier_id: string }).supplier_id !== supplier.id) {
        throw new Error("Besleme bulunamadı veya yetkiniz yok");
      }
      const { error } = await supabaseAdmin.from("supplier_feeds").update(payload as never).eq("id", data.feedId);
      if (error) throw new Error(error.message);
      return { id: data.feedId };
    }

    const { data: created, error } = await supabaseAdmin
      .from("supplier_feeds")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (created as { id: string }).id };
  });

/** Beslemeyi hemen çalıştırır (fiyat/stok güncellemesi). */
export const supplierDeskRunFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ supplierId: z.guid(), feedId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supplier } = await assertSupplier(supabase, userId, data.supplierId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: feed, error } = await supabaseAdmin
      .from("supplier_feeds")
      .select("*")
      .eq("id", data.feedId)
      .eq("supplier_id", supplier.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!feed) throw new Error("Besleme bulunamadı");

    const { runSupplierFeed } = await import("@/lib/dropshipping.server");
    return runSupplierFeed(supabaseAdmin as never, feed as never, "manual");
  });

/** Banka bilgisi (IBAN) kaydı. */
export const supplierDeskSaveBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        supplierId: z.guid(),
        iban: z.string().trim().min(15).max(40),
        accountName: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supplier } = await assertSupplier(supabase, userId, data.supplierId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const iban = data.iban.replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban)) throw new Error("IBAN biçimi geçersiz");
    const { error } = await supabaseAdmin
      .from("suppliers")
      .update({ iban, bank_account_name: data.accountName || null } as never)
      .eq("id", supplier.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Ödeme (havale) talebi oluşturur. */
export const supplierDeskRequestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        supplierId: z.guid(),
        amount: z.number().positive().max(10_000_000),
        note: z.string().trim().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supplier } = await assertSupplier(supabase, userId, data.supplierId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: detail } = await supabaseAdmin
      .from("suppliers")
      .select("iban, bank_account_name, currency")
      .eq("id", supplier.id)
      .maybeSingle();
    const iban = (detail as { iban?: string } | null)?.iban;
    if (!iban) throw new Error("Önce IBAN bilginizi kaydedin");

    const { data: entries } = await supabaseAdmin
      .from("supplier_commission_entries")
      .select("net_amount, status")
      .eq("supplier_id", supplier.id);
    const available = ((entries ?? []) as any[])
      .filter((entry) => entry.status !== "paid" && entry.status !== "cancelled")
      .reduce((total, entry) => total + (Number(entry.net_amount) || 0), 0);

    const { data: openRequests } = await supabaseAdmin
      .from("supplier_payout_requests")
      .select("amount, status")
      .eq("supplier_id", supplier.id)
      .in("status", ["requested", "approved"]);
    const reserved = ((openRequests ?? []) as any[]).reduce(
      (total, row) => total + (Number(row.amount) || 0),
      0,
    );

    if (data.amount > available - reserved + 0.01) {
      throw new Error("Talep edilen tutar ödenebilir bakiyenizi aşıyor");
    }

    const { error } = await supabaseAdmin.from("supplier_payout_requests").insert({
      store_id: supplier.store_id,
      supplier_id: supplier.id,
      amount: data.amount,
      currency: (detail as { currency?: string } | null)?.currency || supplier.currency || "TRY",
      iban,
      account_name: (detail as { bank_account_name?: string } | null)?.bank_account_name ?? null,
      status: "requested",
      note: data.note ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Mağaza yöneticisi: tedarikçi ödeme talebini işler (onay / ödendi / red). */
export const storeProcessSupplierPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        payoutId: z.guid(),
        status: z.enum(["approved", "paid", "rejected"]),
        adminNote: z.string().trim().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: request, error } = await supabase
      .from("supplier_payout_requests")
      .select("id, supplier_id, amount, status")
      .eq("id", data.payoutId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!request) throw new Error("Ödeme talebi bulunamadı");

    // RLS: yalnız mağaza yöneticisi güncelleyebilir.
    const { error: updateError } = await supabase
      .from("supplier_payout_requests")
      .update({
        status: data.status,
        admin_note: data.adminNote ?? null,
        processed_at: new Date().toISOString(),
      })
      .eq("id", data.payoutId);
    if (updateError) throw new Error(updateError.message);

    if (data.status !== "paid") return { ok: true, settled: 0 };

    const { data: entries } = await supabase
      .from("supplier_commission_entries")
      .select("id, net_amount, status")
      .eq("store_id", data.storeId)
      .eq("supplier_id", (request as { supplier_id: string }).supplier_id)
      .in("status", ["pending", "payable"])
      .order("created_at", { ascending: true });

    let remaining = Number((request as { amount: number }).amount) || 0;
    const settled: string[] = [];
    for (const entry of (entries ?? []) as any[]) {
      const net = Number(entry.net_amount) || 0;
      if (net > remaining + 0.01) break;
      remaining -= net;
      settled.push(entry.id as string);
    }
    if (settled.length) {
      const { error: settleError } = await supabase
        .from("supplier_commission_entries")
        .update({ status: "paid", payout_request_id: data.payoutId })
        .in("id", settled);
      if (settleError) throw new Error(settleError.message);
    }
    return { ok: true, settled: settled.length };
  });
