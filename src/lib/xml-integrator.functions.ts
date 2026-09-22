/**
 * XmlIntegrator — sunucu fonksiyonları (panel ↔ veritabanı köprüsü).
 *
 * Her çağrı, isteği yapan kullanıcının o mağazayı yönetme yetkisini doğrular.
 * Kaynak kimlik bilgileri tarayıcıya geri gönderilmez.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  XML_AUTH_TYPES,
  XML_DIRECTIONS,
  XML_PLATFORMS,
  XML_SCHEDULES,
  XML_SCHEDULE_HOURS,
  XML_SOURCE_FORMATS,
  type XmlSchedule,
} from "@/lib/xml-integrator";

const storeSchema = z.object({ storeId: z.guid() });

const authConfigSchema = z
  .object({
    username: z.string().trim().max(200).optional(),
    password: z.string().max(400).optional(),
    token: z.string().max(2000).optional(),
    headerName: z.string().trim().max(100).optional(),
    headerValue: z.string().max(2000).optional(),
    queryName: z.string().trim().max(100).optional(),
    queryValue: z.string().max(2000).optional(),
  })
  .default({});

const feedSchema = z.object({
  storeId: z.guid(),
  feedId: z.guid().optional(),
  name: z.string().trim().min(2).max(120),
  direction: z.enum(XML_DIRECTIONS),
  platform: z.enum(XML_PLATFORMS).default("generic"),
  sourceFormat: z.enum(XML_SOURCE_FORMATS).default("xml"),
  sourceUrl: z.string().trim().max(2000).optional(),
  itemPath: z.string().trim().max(200).optional(),
  authType: z.enum(XML_AUTH_TYPES).default("none"),
  authConfig: authConfigSchema,
  outputFilename: z.string().trim().max(120).optional(),
  schedule: z.enum(XML_SCHEDULES).default("manual"),
  fieldMapping: z.record(z.string(), z.string()).default({}),
  filterRules: z.record(z.string(), z.any()).default({}),
  transformRules: z.record(z.string(), z.any()).default({}),
  priceMarkup: z.number().min(-90).max(900).nullable().default(null),
  currency: z.string().trim().length(3).default("TRY"),
  isActive: z.boolean().default(true),
});

const nextRunFor = (schedule: XmlSchedule): string | null => {
  const hours = XML_SCHEDULE_HOURS[schedule];
  return hours === null ? null : new Date(Date.now() + hours * 3_600_000).toISOString();
};

/** Kimlik bilgilerinin dolu olup olmadığını gösterir; değerleri döndürmez. */
const authSummary = (authType: string, config: Record<string, unknown> | null) => ({
  authType,
  hasCredentials: Boolean(
    config && Object.entries(config).some(([, value]) => typeof value === "string" && value.length > 0),
  ),
});

/** Pano: beslemeler, son çalışmalar ve özet sayılar. */
export const getXmlIntegratorOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);

    const [{ data: feeds, error }, { data: importLogs }, { data: exportLogs }] = await Promise.all([
      context.supabase
        .from("xml_feeds")
        .select(
          "id, name, direction, platform, source_format, source_url, item_path, auth_type, auth_config, output_filename, export_token, schedule, field_mapping, filter_rules, transform_rules, price_markup, currency, is_active, last_run_at, next_run_at, last_status, last_error, total_runs, stats, created_at",
        )
        .eq("store_id", data.storeId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("xml_import_logs")
        .select("id, feed_id, status, trigger, total_rows, created_count, updated_count, skipped_count, error_count, error_message, duration_seconds, started_at, finished_at")
        .eq("store_id", data.storeId)
        .order("started_at", { ascending: false })
        .limit(25),
      context.supabase
        .from("xml_export_logs")
        .select("id, feed_id, status, trigger, exported_count, failed_count, file_size_bytes, output_url, error_message, duration_seconds, started_at, finished_at")
        .eq("store_id", data.storeId)
        .order("started_at", { ascending: false })
        .limit(25),
    ]);
    if (error) throw new Error(error.message);

    const rows = (feeds ?? []) as Array<Record<string, any>>;
    return {
      feeds: rows.map((row) => ({
        id: String(row["id"]),
        name: String(row["name"]),
        direction: String(row["direction"]) as "import" | "export",
        platform: String(row["platform"]),
        sourceFormat: String(row["source_format"]),
        sourceUrl: (row["source_url"] as string | null) ?? null,
        itemPath: (row["item_path"] as string | null) ?? null,
        outputFilename: (row["output_filename"] as string | null) ?? null,
        exportToken: String(row["export_token"] ?? ""),
        schedule: String(row["schedule"]),
        fieldMapping: (row["field_mapping"] ?? {}) as Record<string, string>,
        filterRules: (row["filter_rules"] ?? {}) as Record<string, Json>,
        transformRules: (row["transform_rules"] ?? {}) as Record<string, Json>,
        priceMarkup: row["price_markup"] === null ? null : Number(row["price_markup"]),
        currency: String(row["currency"] ?? "TRY"),
        isActive: Boolean(row["is_active"]),
        lastRunAt: (row["last_run_at"] as string | null) ?? null,
        nextRunAt: (row["next_run_at"] as string | null) ?? null,
        lastStatus: (row["last_status"] as string | null) ?? null,
        lastError: (row["last_error"] as string | null) ?? null,
        totalRuns: Number(row["total_runs"] ?? 0),
        stats: (row["stats"] ?? {}) as Record<string, Json>,
        createdAt: String(row["created_at"]),
        ...authSummary(String(row["auth_type"] ?? "none"), (row["auth_config"] ?? null) as Record<string, unknown>),
      })),
      importLogs: (importLogs ?? []) as Array<Record<string, Json>>,
      exportLogs: (exportLogs ?? []) as Array<Record<string, Json>>,
    };
  });

/** Besleme oluşturur veya günceller. */
export const saveXmlFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => feedSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);

    if (data.direction === "import" && !data.sourceUrl) {
      throw new Error("İçe aktarım beslemesi için kaynak bağlantısı zorunludur");
    }
    if (data.sourceUrl) {
      const { assertPublicUrl } = await import("@/lib/safe-fetch.server");
      assertPublicUrl(data.sourceUrl);
    }

    const payload = {
      store_id: data.storeId,
      name: data.name,
      direction: data.direction,
      platform: data.platform,
      source_format: data.sourceFormat,
      source_url: data.sourceUrl ?? null,
      item_path: data.itemPath || null,
      auth_type: data.authType,
      auth_config: data.authConfig,
      output_filename: data.outputFilename || null,
      schedule: data.schedule,
      field_mapping: data.fieldMapping,
      filter_rules: data.filterRules,
      transform_rules: data.transformRules,
      price_markup: data.priceMarkup,
      currency: data.currency.toUpperCase(),
      is_active: data.isActive,
      next_run_at: data.isActive ? nextRunFor(data.schedule) : null,
      created_by: context.userId,
    };

    if (data.feedId) {
      // Kimlik bilgisi alanları boş gönderildiyse mevcut değer korunur.
      const { data: existing } = await context.supabase
        .from("xml_feeds")
        .select("auth_config")
        .eq("id", data.feedId)
        .eq("store_id", data.storeId)
        .maybeSingle();
      const previous = ((existing as { auth_config?: Record<string, string> } | null)?.auth_config ?? {}) as Record<string, string>;
      const merged: Record<string, string> = { ...previous };
      for (const [key, value] of Object.entries(data.authConfig)) {
        if (typeof value === "string" && value.length > 0) merged[key] = value;
      }

      const { error } = await context.supabase
        .from("xml_feeds")
        .update({ ...payload, auth_config: merged } as never)
        .eq("id", data.feedId)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      return { id: data.feedId };
    }

    const { data: created, error } = await context.supabase
      .from("xml_feeds")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: String((created as { id: string }).id) };
  });

/** Beslemeyi ve bağlı kayıtlarını siler. */
export const deleteXmlFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), feedId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("xml_feeds")
      .delete()
      .eq("id", data.feedId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true as boolean };
  });

/** Beslemeyi açar/kapatır. */
export const toggleXmlFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), feedId: z.guid(), isActive: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { data: feed, error: readError } = await context.supabase
      .from("xml_feeds")
      .select("schedule")
      .eq("id", data.feedId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!feed) throw new Error("Besleme bulunamadı");

    const schedule = String((feed as { schedule: string }).schedule) as XmlSchedule;
    const { error } = await context.supabase
      .from("xml_feeds")
      .update({ is_active: data.isActive, next_run_at: data.isActive ? nextRunFor(schedule) : null } as never)
      .eq("id", data.feedId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true as boolean };
  });

/**
 * Kaynağı indirir, ürün düğümünü bulur, ilk satırları ve alan envanterini
 * döndürür. Besleme kimliği verilirse alan envanteri kaydedilir.
 */
export const analyzeXmlSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        feedId: z.guid().optional(),
        sourceUrl: z.string().trim().min(8).max(2000),
        sourceFormat: z.enum(XML_SOURCE_FORMATS).optional(),
        itemPath: z.string().trim().max(200).optional(),
        authType: z.enum(XML_AUTH_TYPES).default("none"),
        authConfig: authConfigSchema,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);

    const { consumeRateLimit, RATE_LIMITS } = await import("@/lib/rate-limit.server");
    const limit = await consumeRateLimit(`xml_analyze:${context.userId}`, RATE_LIMITS.import_trigger);
    if (!limit.allowed) throw new Error("Çok fazla deneme yapıldı, birkaç dakika sonra tekrar deneyin");

    // Kayıtlı beslemede kimlik bilgileri sunucudan okunur.
    let authType = data.authType;
    let authConfig: Record<string, string> = Object.fromEntries(
      Object.entries(data.authConfig).filter(([, value]) => typeof value === "string" && value.length > 0),
    ) as Record<string, string>;
    if (data.feedId) {
      const { data: feed } = await context.supabase
        .from("xml_feeds")
        .select("auth_type, auth_config")
        .eq("id", data.feedId)
        .eq("store_id", data.storeId)
        .maybeSingle();
      const row = feed as { auth_type?: string; auth_config?: Record<string, string> } | null;
      if (row) {
        authType = (row.auth_type as typeof authType) ?? authType;
        authConfig = { ...(row.auth_config ?? {}), ...authConfig };
      }
    }

    const { analyzeSource, saveFieldSchema } = await import("@/lib/xml-integrator.server");
    const analysis = await analyzeSource({
      url: data.sourceUrl,
      authType,
      authConfig,
      format: data.sourceFormat ?? null,
      itemPath: data.itemPath ?? null,
      limit: 100,
    });

    if (data.feedId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await saveFieldSchema(supabaseAdmin as never, {
        storeId: data.storeId,
        feedId: data.feedId,
        parsed: analysis,
      });
    }

    return {
      format: analysis.format,
      rootPath: analysis.rootPath,
      rootCandidates: analysis.rootCandidates,
      columns: analysis.columns,
      sampleRows: analysis.rows.slice(0, 10),
      totalRows: analysis.totalRows,
      bytes: analysis.bytes,
      suggestedMapping: analysis.suggestedMapping,
    };
  });

/** Bir beslemenin kayıtlı alan envanteri (eşleştirme ekranı için). */
export const listXmlFieldSchema = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), feedId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { data: rows, error } = await context.supabase
      .from("xml_field_schemas")
      .select("field_path, label, sample_values, occurrence, detected_type")
      .eq("store_id", data.storeId)
      .eq("feed_id", data.feedId)
      .order("field_path");
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      field_path: string;
      label: string | null;
      sample_values: string[];
      occurrence: number;
      detected_type: string | null;
    }>;
  });

/** Pano grafikleri: son 14 günün içe/dışa aktarım çalışmaları ve ürün sonuçları. */
export const getXmlIntegratorStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);

    const days = 14;
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const sinceIso = since.toISOString();

    const [{ data: importRows, error: importError }, { data: exportRows, error: exportError }] = await Promise.all([
      context.supabase
        .from("xml_import_logs")
        .select("status, started_at, total_rows, created_count, updated_count, skipped_count, error_count")
        .eq("store_id", data.storeId)
        .gte("started_at", sinceIso),
      context.supabase
        .from("xml_export_logs")
        .select("status, started_at, exported_count, failed_count")
        .eq("store_id", data.storeId)
        .gte("started_at", sinceIso),
    ]);
    if (importError) throw new Error(importError.message);
    if (exportError) throw new Error(exportError.message);

    const dayKey = (value: unknown) => String(value ?? "").slice(0, 10);
    const series: Array<{
      date: string;
      importRuns: number;
      exportRuns: number;
      successItems: number;
      failedItems: number;
    }> = [];
    const index = new Map<string, number>();
    for (let i = 0; i < days; i += 1) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      index.set(key, series.length);
      series.push({ date: key, importRuns: 0, exportRuns: 0, successItems: 0, failedItems: 0 });
    }

    let importRuns = 0;
    let importSuccessRuns = 0;
    let exportRuns = 0;
    let exportSuccessRuns = 0;
    let todayRuns = 0;
    const today = new Date().toISOString().slice(0, 10);

    for (const row of (importRows ?? []) as Array<Record<string, unknown>>) {
      const key = dayKey(row["started_at"]);
      const bucket = index.has(key) ? series[index.get(key)!]! : null;
      importRuns += 1;
      if (String(row["status"]) === "success") importSuccessRuns += 1;
      if (key === today) todayRuns += 1;
      if (!bucket) continue;
      bucket.importRuns += 1;
      bucket.successItems += Number(row["created_count"] ?? 0) + Number(row["updated_count"] ?? 0);
      bucket.failedItems += Number(row["error_count"] ?? 0);
    }
    for (const row of (exportRows ?? []) as Array<Record<string, unknown>>) {
      const key = dayKey(row["started_at"]);
      const bucket = index.has(key) ? series[index.get(key)!]! : null;
      exportRuns += 1;
      if (String(row["status"]) === "success") exportSuccessRuns += 1;
      if (key === today) todayRuns += 1;
      if (!bucket) continue;
      bucket.exportRuns += 1;
      bucket.successItems += Number(row["exported_count"] ?? 0);
      bucket.failedItems += Number(row["failed_count"] ?? 0);
    }

    const totalRuns = importRuns + exportRuns;
    const successRuns = importSuccessRuns + exportSuccessRuns;

    return {
      series,
      totals: {
        importRuns,
        exportRuns,
        todayRuns,
        totalRuns,
        successRuns,
        successRate: totalRuns ? Math.round((successRuns / totalRuns) * 100) : null,
      },
    };
  });

/**
 * Beslemeyi elle çalıştırır. Şu aşamada içe aktarım beslemesinde kaynak
 * indirilir, satırlar sayılır ve çalışma kaydı yazılır; ürün yazımı içe
 * aktarım motoru adımında devreye girer.
 */
export const runXmlFeedNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), feedId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);

    const { consumeRateLimit, RATE_LIMITS } = await import("@/lib/rate-limit.server");
    const limit = await consumeRateLimit(`xml_run:${context.userId}`, RATE_LIMITS.import_trigger);
    if (!limit.allowed) throw new Error("Çok fazla çalıştırma denemesi, birkaç dakika sonra tekrar deneyin");

    const { data: feedRow, error: readError } = await context.supabase
      .from("xml_feeds")
      .select("id, direction, schedule, source_url, source_format, item_path, auth_type, auth_config")
      .eq("id", data.feedId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!feedRow) throw new Error("Besleme bulunamadı");
    const feed = feedRow as Record<string, any>;

    if (String(feed["direction"]) !== "import") {
      throw new Error("Dışa aktarım beslemeleri çıktı bağlantısı üzerinden servis edilir, elle çalıştırılmaz");
    }
    const sourceUrl = (feed["source_url"] as string | null) ?? "";
    if (!sourceUrl) throw new Error("Bu beslemede kaynak bağlantısı tanımlı değil");

    const startedAt = new Date();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { analyzeSource, saveFieldSchema } = await import("@/lib/xml-integrator.server");

    try {
      const analysis = await analyzeSource({
        url: sourceUrl,
        authType: String(feed["auth_type"] ?? "none") as never,
        authConfig: (feed["auth_config"] ?? {}) as Record<string, string>,
        format: (feed["source_format"] as never) ?? null,
        itemPath: (feed["item_path"] as string | null) ?? null,
        limit: 500,
      });
      await saveFieldSchema(supabaseAdmin as never, {
        storeId: data.storeId,
        feedId: data.feedId,
        parsed: analysis,
      });

      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 1000));
      await supabaseAdmin.from("xml_import_logs").insert({
        store_id: data.storeId,
        feed_id: data.feedId,
        status: "success",
        trigger: "manual",
        total_rows: analysis.totalRows,
        skipped_count: analysis.totalRows,
        duration_seconds: durationSeconds,
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
      } as never);

      await supabaseAdmin
        .from("xml_feeds")
        .update({
          last_run_at: startedAt.toISOString(),
          last_status: "success",
          last_error: null,
          next_run_at: nextRunFor(String(feed["schedule"]) as XmlSchedule),
        } as never)
        .eq("id", data.feedId)
        .eq("store_id", data.storeId);

      return { ok: true as boolean, totalRows: analysis.totalRows, format: analysis.format };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bilinmeyen hata";
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 1000));
      await supabaseAdmin.from("xml_import_logs").insert({
        store_id: data.storeId,
        feed_id: data.feedId,
        status: "failed",
        trigger: "manual",
        error_count: 1,
        error_message: message,
        duration_seconds: durationSeconds,
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
      } as never);
      await supabaseAdmin
        .from("xml_feeds")
        .update({ last_run_at: startedAt.toISOString(), last_status: "failed", last_error: message } as never)
        .eq("id", data.feedId)
        .eq("store_id", data.storeId);
      throw new Error(message);
    }
  });
