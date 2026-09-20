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

const rowSchema = z.object({
  index: z.number(),
  sku: z.string().trim().min(1),
  barcode: z.string().nullable(),
  title: z.string().trim().min(1),
  description: z.string().nullable(),
  costPrice: z.number(),
  retailPrice: z.number().nullable(),
  stock: z.number(),
  category: z.string().nullable(),
  brand: z.string().nullable(),
  images: z.array(z.string()),
  color: z.string().nullable(),
  size: z.string().nullable(),
  currency: z.string().nullable(),
  errors: z.array(z.string()),
});

export const supplierDeskOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { suppliers } = await assertSupplier(supabase, userId);
    const supplierIds = suppliers.map((supplier) => supplier.id);

    const { loadSupplierDeskOrders, loadSupplierLedger, loadSupplierFeeds } = await import(
      "@/lib/supplier-desk.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [orders, ledger, feeds] = await Promise.all([
      loadSupplierDeskOrders(supabaseAdmin as never, supplierIds, 200),
      loadSupplierLedger(supabaseAdmin as never, suppliers as never),
      loadSupplierFeeds(supabaseAdmin as never, supplierIds),
    ]);

    return {
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
    };
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
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supplier } = await assertSupplier(supabase, userId, data.supplierId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { applySupplierImport } = await import("@/lib/supplier-desk.server");

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
          schedule: "manual",
          is_active: true,
          match_key: "sku",
        } as never)
        .select("id")
        .single();
      if (feedError) throw new Error(feedError.message);
      feedId = (created as { id: string }).id;
    }

    const rows = data.rows;
    const invalid = rows.filter((row) => row.errors.length > 0);
    const result = await applySupplierImport(supabaseAdmin as never, {
      storeId: supplier.store_id,
      supplierId: supplier.id,
      feedId,
      rows: rows as never,
      currency: supplier.currency || "TRY",
    });

    const { error: jobError } = await supabaseAdmin.from("supplier_import_jobs").insert({
      store_id: supplier.store_id,
      supplier_id: supplier.id,
      source: data.source,
      file_name: data.fileName ?? null,
      source_url: data.sourceUrl ?? null,
      format: data.format,
      row_count: rows.length,
      valid_count: rows.length - invalid.length,
      error_count: invalid.length,
      created_count: result.created,
      updated_count: result.updated,
      field_map: data.fieldMap as never,
      errors: invalid.slice(0, 100).map((row) => ({ line: row.index + 2, sku: row.sku, errors: row.errors })) as never,
      status: invalid.length === 0 ? "completed" : rows.length === invalid.length ? "failed" : "partial",
      created_by: userId,
    } as never);
    if (jobError) throw new Error(jobError.message);

    return { ...result, invalid: invalid.length, total: rows.length };
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
