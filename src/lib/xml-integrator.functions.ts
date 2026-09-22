import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * XML Entegratör v2 sunucu katmanı: iki yönlü besleme yönetimi (import/export),
 * pano istatistikleri, kategori eşleme ve dışa aktarım çalıştırma.
 * Tenant izolasyonu RLS (is_store_member / can_manage_store) ile zorlanır.
 */

const storeGuard = async (supabase: any, storeId: string) => {
  const { data, error } = await supabase.from("stores").select("id, name, slug, currency").eq("id", storeId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
  return data as { id: string; name: string; slug: string; currency: string | null };
};

const transformRuleSchema = z.object({
  type: z.enum([
    "trim",
    "uppercase",
    "lowercase",
    "replace",
    "truncate",
    "multiply",
    "round",
    "add_vat",
    "remove_vat",
    "currency",
    "join",
    "split",
    "first",
    "last",
    "template",
    "conditional",
    "date_format",
    "custom_js",
  ]),
  search: z.string().max(200).optional(),
  replace: z.string().max(200).optional(),
  length: z.number().min(1).max(20000).optional(),
  factor: z.number().min(-10000).max(10000).optional(),
  decimals: z.number().min(0).max(6).optional(),
  rate: z.number().min(0).max(100).optional(),
  delimiter: z.string().max(10).optional(),
  template: z.string().max(300).optional(),
  operator: z.enum(["eq", "neq", "contains", "gt", "lt", "empty", "not_empty"]).optional(),
  then: z.string().max(300).optional(),
  else: z.string().max(300).optional(),
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  expression: z.string().max(500).optional(),
  flags: z.string().max(6).optional(),
});

const transformRulesSchema = z.record(z.string().max(60), z.array(transformRuleSchema).max(12)).default({});

const exportFilterSchema = z
  .object({
    only_in_stock: z.boolean().optional(),
    min_price: z.number().min(0).max(10_000_000).optional(),
    max_price: z.number().min(0).max(10_000_000).optional(),
    categories: z.array(z.string().max(60)).max(100).optional(),
  })
  .default({});

const originOf = (request: Request): string => {
  const url = new URL(request.url);
  const forwarded = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
  return forwarded ? `https://${forwarded}` : url.origin;
};

/** Pano: kart metrikleri, 14 günlük trend, platform dağılımı ve durum kırılımı. */
export const getXmlIntegratorOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await storeGuard(supabase, data.storeId);

    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const [{ data: feeds, error: feedsError }, { data: runs, error: runsError }] = await Promise.all([
      supabase
        .from("supplier_feeds")
        .select("id, name, direction, platform, is_active, schedule, last_status, last_run_at, next_run_at, last_error, stats")
        .eq("store_id", data.storeId)
        .order("created_at", { ascending: false }),
      supabase
        .from("supplier_feed_runs")
        .select("id, feed_id, direction, status, started_at, finished_at, totals, duration_seconds, file_size_bytes, output_url")
        .eq("store_id", data.storeId)
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(1000),
    ]);
    if (feedsError) throw new Error(feedsError.message);
    if (runsError) throw new Error(runsError.message);

    type FeedRow = {
      id: string;
      name: string;
      direction: string;
      platform: string;
      is_active: boolean;
      schedule: string;
      last_status: string | null;
      last_run_at: string | null;
      next_run_at: string | null;
      last_error: string | null;
      stats: Record<string, number> | null;
    };
    type RunRow = {
      id: string;
      feed_id: string;
      direction: string;
      status: string;
      started_at: string;
      finished_at: string | null;
      totals: Record<string, number> | null;
      duration_seconds: number | null;
      file_size_bytes: number | null;
      output_url: string | null;
    };

    const feedRows = (feeds ?? []) as FeedRow[];
    const runRows = (runs ?? []) as RunRow[];

    const dayKey = (iso: string) => iso.slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const last24h = Date.now() - 24 * 60 * 60 * 1000;

    const trendMap = new Map<string, { day: string; import: number; export: number }>();
    const productMap = new Map<string, { day: string; created: number; updated: number; failed: number }>();
    for (let index = 13; index >= 0; index -= 1) {
      const day = new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      trendMap.set(day, { day, import: 0, export: 0 });
      if (index < 7) productMap.set(day, { day, created: 0, updated: 0, failed: 0 });
    }

    let todayRuns = 0;
    let updatedProducts = 0;
    let exportFiles = 0;
    let recent = 0;
    let recentSuccess = 0;

    for (const run of runRows) {
      const day = dayKey(run.started_at);
      const trend = trendMap.get(day);
      if (trend) {
        if (run.direction === "export") trend.export += 1;
        else trend.import += 1;
      }
      const totals = run.totals ?? {};
      const product = productMap.get(day);
      if (product) {
        product.created += Number(totals["created"] ?? 0);
        product.updated += Number(totals["priceUpdated"] ?? 0) + Number(totals["stockUpdated"] ?? 0);
        product.failed += Number(totals["failed"] ?? 0);
      }
      if (day === today) todayRuns += 1;
      updatedProducts += Number(totals["priceUpdated"] ?? 0) + Number(totals["stockUpdated"] ?? 0);
      if (run.direction === "export" && run.status === "success") exportFiles += 1;
      if (new Date(run.started_at).getTime() >= last24h && run.status !== "running") {
        recent += 1;
        if (run.status === "success") recentSuccess += 1;
      }
    }

    const platformCounts = new Map<string, number>();
    for (const feed of feedRows) {
      const key = feed.platform || "generic";
      platformCounts.set(key, (platformCounts.get(key) ?? 0) + 1);
    }

    const nextRun = feedRows
      .filter((feed) => feed.is_active && feed.next_run_at)
      .map((feed) => ({ feedId: feed.id, name: feed.name, at: feed.next_run_at as string }))
      .sort((a, b) => a.at.localeCompare(b.at))[0] ?? null;

    return {
      cards: {
        activeImport: feedRows.filter((feed) => feed.direction === "import" && feed.is_active).length,
        activeExport: feedRows.filter((feed) => feed.direction === "export" && feed.is_active).length,
        todayRuns,
        updatedProducts,
        successRate: recent ? Math.round((recentSuccess / recent) * 100) : null,
        exportFiles,
        nextRun,
      },
      trend: [...trendMap.values()],
      products: [...productMap.values()],
      status: [
        { name: "Aktif", value: feedRows.filter((feed) => feed.is_active && feed.last_status !== "failed").length },
        { name: "Pasif", value: feedRows.filter((feed) => !feed.is_active).length },
        { name: "Hatalı", value: feedRows.filter((feed) => feed.last_status === "failed").length },
      ],
      platforms: [...platformCounts.entries()].map(([platform, count]) => ({ platform, count })),
      feeds: feedRows,
      runs: runRows.slice(0, 50),
    };
  });

/** Dışa aktarım beslemesi oluşturur veya güncellemek için kaydeder. */
export const saveXmlExportFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.guid().optional(),
        storeId: z.guid(),
        name: z.string().trim().min(2).max(120),
        platform: z.enum(["trendyol", "hepsiburada", "n11", "amazon", "xml_generic"]),
        outputFilename: z.string().trim().max(120).nullish(),
        outputTarget: z.enum(["url", "storage", "webhook"]).default("url"),
        schedule: z.enum(["manual", "hourly", "three_hourly", "six_hourly", "twelve_hourly", "daily"]).default("daily"),
        timezone: z.string().trim().max(60).default("Europe/Istanbul"),
        maxRuntimeSeconds: z.number().min(30).max(3600).default(600),
        isActive: z.boolean().default(true),
        filters: exportFilterSchema.optional(),
        transformRules: transformRulesSchema.optional(),
        categoryMap: z.record(z.string().max(60), z.string().max(120)).default({}),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await storeGuard(supabase, data.storeId);
    const { requirePlanModule } = await import("@/lib/entitlements.server");
    await requirePlanModule(supabase as never, data.storeId, "module_xml_feed");
    const { nextRunAt } = await import("@/lib/dropshipping");

    const payload = {
      store_id: data.storeId,
      name: data.name,
      direction: "export",
      platform: data.platform,
      kind: "xml" as const,
      source_url: null,
      output_filename: data.outputFilename || null,
      output_target: data.outputTarget,
      schedule: data.schedule,
      timezone: data.timezone,
      max_runtime_seconds: data.maxRuntimeSeconds,
      is_active: data.isActive,
      filter_rules: (data.filters ?? {}) as never,
      transform_rules: (data.transformRules ?? {}) as never,
      category_map: data.categoryMap as never,
      next_run_at: data.isActive ? nextRunAt(data.schedule as never) : null,
    };

    if (data.id) {
      const { error } = await supabase
        .from("supplier_feeds")
        .update(payload as never)
        .eq("id", data.id)
        .eq("store_id", data.storeId)
        .eq("direction", "export");
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: inserted, error } = await supabase
      .from("supplier_feeds")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

/** Dışa aktarımı hemen çalıştırır; çıktı adresini ve doğrulama hatalarını döner. */
export const runXmlExportNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), feedId: z.guid() }).parse(data))
  .handler(async ({ data, context, request }) => {
    const { supabase } = context;
    const store = await storeGuard(supabase, data.storeId);

    const { data: feed, error } = await supabase
      .from("supplier_feeds")
      .select("*")
      .eq("id", data.feedId)
      .eq("store_id", data.storeId)
      .eq("direction", "export")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!feed) throw new Error("Dışa aktarım beslemesi bulunamadı");

    const { runExportFeed } = await import("@/lib/xml-export.server");
    const result = await runExportFeed(
      supabase as never,
      feed as never,
      {
        storeName: store.name,
        storeSlug: store.slug,
        storeCurrency: store.currency ?? "TRY",
        origin: originOf(request),
      },
      "manual",
    );
    return { runId: result.runId, exported: result.exported, failed: result.failed, outputUrl: result.outputUrl };
  });

/** Dışa aktarım önizlemesi: ilk N ürünün XML çıktısı ve doğrulama sonuçları. */
export const previewXmlExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), feedId: z.guid(), limit: z.number().min(1).max(50).default(10) }).parse(data),
  )
  .handler(async ({ data, context, request }) => {
    const { supabase } = context;
    const store = await storeGuard(supabase, data.storeId);

    const { data: feed, error } = await supabase
      .from("supplier_feeds")
      .select("*")
      .eq("id", data.feedId)
      .eq("store_id", data.storeId)
      .eq("direction", "export")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!feed) throw new Error("Dışa aktarım beslemesi bulunamadı");

    const { generateExportXml } = await import("@/lib/xml-export.server");
    const result = await generateExportXml(supabase as never, feed as never, {
      storeName: store.name,
      storeSlug: store.slug,
      storeCurrency: store.currency ?? "TRY",
      origin: originOf(request),
      limit: data.limit,
    });
    return {
      filename: result.filename,
      exported: result.exported,
      failed: result.failed,
      issues: result.issues.slice(0, 50),
      xml: result.xml.slice(0, 20000),
    };
  });

/** Beslemenin genel XML adresini döner (token dahil). */
export const getXmlExportUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), feedId: z.guid() }).parse(data))
  .handler(async ({ data, context, request }) => {
    const { supabase } = context;
    const store = await storeGuard(supabase, data.storeId);
    const { data: feed, error } = await supabase
      .from("supplier_feeds")
      .select("id, export_token, output_filename, platform")
      .eq("id", data.feedId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!feed) throw new Error("Besleme bulunamadı");
    const row = feed as { export_token: string };
    return {
      url: `${originOf(request)}/api/public/xml-export/${store.slug}/${data.feedId}?token=${row.export_token}`,
    };
  });

/** Besleme kategorilerini listeler (kaynak → hedef eşleşmesi). */
export const listXmlCategoryMappings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), feedId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("xml_category_mappings")
      .select("id, source_category, target_category_id, target_category_name, platform")
      .eq("store_id", data.storeId)
      .eq("feed_id", data.feedId)
      .order("source_category");
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string;
      source_category: string;
      target_category_id: string | null;
      target_category_name: string | null;
      platform: string;
    }>;
  });

/** Kategori eşleşmelerini toplu kaydeder (CSV içe aktarımı da bunu kullanır). */
export const saveXmlCategoryMappings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        feedId: z.guid(),
        platform: z.string().trim().max(40).default("generic"),
        rows: z
          .array(
            z.object({
              sourceCategory: z.string().trim().min(1).max(300),
              targetCategoryId: z.string().trim().max(120).nullish(),
              targetCategoryName: z.string().trim().max(300).nullish(),
            }),
          )
          .min(1)
          .max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await storeGuard(supabase, data.storeId);
    const payload = data.rows.map((row) => ({
      store_id: data.storeId,
      feed_id: data.feedId,
      platform: data.platform,
      source_category: row.sourceCategory,
      target_category_id: row.targetCategoryId || null,
      target_category_name: row.targetCategoryName || null,
    }));
    const { error } = await supabase
      .from("xml_category_mappings")
      .upsert(payload as never, { onConflict: "feed_id,source_category" });
    if (error) throw new Error(error.message);

    // Besleme üzerindeki hızlı erişim haritası da güncellenir.
    const map: Record<string, string> = {};
    for (const row of data.rows) {
      if (row.targetCategoryId) map[row.sourceCategory] = row.targetCategoryId;
    }
    const { error: feedError } = await supabase
      .from("supplier_feeds")
      .update({ category_map: map as never })
      .eq("id", data.feedId)
      .eq("store_id", data.storeId);
    if (feedError) throw new Error(feedError.message);
    return { saved: data.rows.length };
  });

/** Bir çalıştırmanın hata/uyarı kayıtlarını döner. */
export const getXmlRunDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), runId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("supplier_feed_runs")
      .select("id, feed_id, direction, status, trigger, started_at, finished_at, totals, errors, warnings, error, output_url, file_size_bytes, duration_seconds")
      .eq("store_id", data.storeId)
      .eq("id", data.runId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Çalıştırma kaydı bulunamadı");
    return row as Record<string, unknown>;
  });
