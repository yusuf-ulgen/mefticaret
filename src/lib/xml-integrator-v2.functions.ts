/**
 * XML Entegratör v2 — alan kuralları, eşleştirme şablonları, çalışma kontrolü
 * (duraklat/devam/durdur) ve hatalı ürünler. Her çağrı mağaza yetkisini doğrular.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseFieldRules } from "@/lib/xml-field-rules";

const mappingSchema = z.record(z.string().max(100), z.string().max(300));
const rulesSchema = z.record(z.string().max(100), z.unknown());

function normalizeLegacyTemplateMapping(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  const allowed = new Set([
    "sku", "barcode", "title", "description", "brand", "category", "category_path",
    "cost_price", "price", "compare_at_price", "tax_rate", "currency", "stock",
    "variant_name", "variant_value", "color", "size", "material", "images", "videos",
    "weight", "hs_code", "shipping_days",
  ]);
  for (const [key, value] of Object.entries(source)) {
    if (allowed.has(key) && typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  // İlk sürüm şablonlarında hedefler image_1..5 ve option1/2 adıyla kaydedilmişti.
  if (!out.images) {
    const image = [1, 2, 3, 4, 5].map((index) => source[`image_${index}`]).find((value) => typeof value === "string" && value.trim());
    if (typeof image === "string") out.images = image.trim();
  }
  if (!out.size && typeof source["option1"] === "string") out.size = source["option1"].trim();
  if (!out.color && typeof source["option2"] === "string") out.color = source["option2"].trim();
  return out;
}

async function assertManager(supabase: unknown, storeId: string, userId: string) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(supabase as never, storeId, userId);
}

/* ---------------- Alan kuralları + hata eşiği ---------------- */

export const getXmlFeedV2Settings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), feedId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, data.storeId, context.userId);
    const { data: row, error } = await context.supabase
      .from("xml_feeds")
      .select("field_rules, max_errors_before_pause, error_notification_email, paused_reason, is_active")
      .eq("id", data.feedId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      fieldRules: parseFieldRules(r["field_rules"]),
      maxErrors: Number(r["max_errors_before_pause"] ?? 100),
      email: (r["error_notification_email"] as string | null) ?? "",
      pausedReason: (r["paused_reason"] as string | null) ?? null,
      isActive: r["is_active"] === true,
    };
  });

export const saveXmlFeedV2Settings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        feedId: z.guid(),
        fieldRules: rulesSchema.optional(),
        maxErrors: z.number().int().min(1).max(100000).optional(),
        email: z.union([z.literal(""), z.email().max(255)]).optional(),
        clearPause: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, data.storeId, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.fieldRules) patch["field_rules"] = parseFieldRules(data.fieldRules);
    if (data.maxErrors !== undefined) patch["max_errors_before_pause"] = data.maxErrors;
    if (data.email !== undefined) patch["error_notification_email"] = data.email || null;
    if (data.clearPause) {
      patch["paused_reason"] = null;
      patch["is_active"] = true;
    }
    const { error } = await context.supabase
      .from("xml_feeds")
      .update(patch as never)
      .eq("id", data.feedId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Eşleştirme şablonları ---------------- */

export const listXmlMappingTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, data.storeId, context.userId);
    const { data: rows, error } = await context.supabase
      .from("xml_mapping_templates")
      .select("id, store_id, name, description, provider_type, field_mapping, field_rules, usage_count, last_used_at, is_public, created_at")
      .or(`is_public.eq.true,store_id.eq.${data.storeId}`)
      .order("is_public", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => {
      const r = row as Record<string, unknown>;
       const mapping = normalizeLegacyTemplateMapping(r["field_mapping"]);
      return {
        id: String(r["id"]),
        name: String(r["name"]),
        description: (r["description"] as string | null) ?? null,
        isPublic: r["is_public"] === true,
        fieldCount: Object.keys(mapping).length,
        fieldMapping: mapping,
        fieldRules: parseFieldRules(r["field_rules"]),
        usageCount: Number(r["usage_count"] ?? 0),
        lastUsedAt: (r["last_used_at"] as string | null) ?? null,
        createdAt: String(r["created_at"]),
      };
    });
  });

export const saveXmlMappingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        templateId: z.guid().optional(),
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().max(300).optional(),
        fieldMapping: mappingSchema.optional(),
        fieldRules: rulesSchema.optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, data.storeId, context.userId);
    const payload: Record<string, unknown> = {
      name: data.name,
      description: data.description ?? null,
    };
    if (data.fieldMapping) payload["field_mapping"] = data.fieldMapping;
    if (data.fieldRules) payload["field_rules"] = parseFieldRules(data.fieldRules);
    if (data.templateId) {
      const { error } = await context.supabase
        .from("xml_mapping_templates")
        .update(payload as never)
        .eq("id", data.templateId)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
      return { id: data.templateId };
    }
    const { data: row, error } = await context.supabase
      .from("xml_mapping_templates")
      .insert({ ...payload, store_id: data.storeId, is_public: false, created_by: context.userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteXmlMappingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), templateId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, data.storeId, context.userId);
    const { error } = await context.supabase
      .from("xml_mapping_templates")
      .delete()
      .eq("id", data.templateId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Şablonu okur ve kullanım sayacını artırır; eşleşmeyi tarayıcı forma uygular. */
export const applyXmlMappingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), templateId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, data.storeId, context.userId);
    const { data: row, error } = await context.supabase
      .from("xml_mapping_templates")
      .select("id, store_id, is_public, field_mapping, field_rules, usage_count")
      .eq("id", data.templateId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const r = row as Record<string, unknown> | null;
    if (!r || (r["is_public"] !== true && r["store_id"] !== data.storeId)) throw new Error("Şablon bulunamadı");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("xml_mapping_templates")
      .update({ usage_count: Number(r["usage_count"] ?? 0) + 1, last_used_at: new Date().toISOString() } as never)
      .eq("id", data.templateId);
    return {
       fieldMapping: normalizeLegacyTemplateMapping(r["field_mapping"]),
      fieldRules: parseFieldRules(r["field_rules"]),
    };
  });

/* ---------------- Çalışma kontrolü ---------------- */

async function loadFeedRecord(admin: any, storeId: string, feedId: string) {
  const { data: feed } = await admin
    .from("xml_feeds")
    .select(
      "id, direction, source_url, source_format, item_path, auth_type, auth_config, field_mapping, transform_rules, price_markup, currency, variant_mode, variant_config, pricing_rules, delta_sync_config, last_full_sync_at, connection_type, ftp_config, guardrail_config",
    )
    .eq("id", feedId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (!feed || feed.direction !== "import") throw new Error("İçe aktarım beslemesi bulunamadı");
  const { parseConnectionType } = await import("@/lib/xml-connection");
  return {
    id: String(feed.id),
    storeId,
    direction: "import",
    sourceUrl: feed.source_url ?? null,
    connectionType: parseConnectionType(feed.connection_type),
    ftpConfig: feed.ftp_config ?? {},
    sourceFormat: feed.source_format ?? null,
    itemPath: feed.item_path ?? null,
    authType: String(feed.auth_type ?? "none") as never,
    authConfig: (feed.auth_config ?? {}) as Record<string, string>,
    fieldMapping: (feed.field_mapping ?? {}) as Record<string, string>,
    transformRules: feed.transform_rules ?? {},
    priceMarkup: feed.price_markup === null ? null : Number(feed.price_markup),
    currency: String(feed.currency ?? "TRY"),
    pricingRules: feed.pricing_rules ?? {},
    variantMode: feed.variant_mode ?? "none",
    variantConfig: feed.variant_config ?? {},
    deltaSyncConfig: feed.delta_sync_config ?? {},
    guardrailConfig: feed.guardrail_config ?? {},
    lastFullSyncAt: feed.last_full_sync_at ?? null,
  };
}

export const controlXmlRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ storeId: z.guid(), runId: z.guid(), action: z.enum(["pause", "stop", "resume"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, data.storeId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: log } = await supabaseAdmin
      .from("xml_import_logs")
      .select("id, feed_id, status, control_state, resume_cursor")
      .eq("id", data.runId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    const run = log as { id: string; feed_id: string; status: string; control_state: string; resume_cursor: number } | null;
    if (!run) throw new Error("Çalışma bulunamadı");

    if (data.action !== "resume") {
      if (run.status !== "running") throw new Error("Bu çalışma şu an çalışmıyor");
      await supabaseAdmin
        .from("xml_import_logs")
        .update({ control_state: data.action === "pause" ? "pause_requested" : "stop_requested" } as never)
        .eq("id", run.id);
      return { ok: true, resumed: false };
    }

    if (run.control_state !== "paused") throw new Error("Yalnız duraklatılan çalışma devam ettirilebilir");
    await supabaseAdmin.from("xml_import_logs").update({ control_state: "resumed" } as never).eq("id", run.id);
    const feed = await loadFeedRecord(supabaseAdmin, data.storeId, run.feed_id);
    const { runImportFeed } = await import("@/lib/xml-import-engine.server");
    const result = await runImportFeed(supabaseAdmin as never, { ...feed, forceFullSync: true } as never, {
      trigger: "manual",
      resumeFrom: Number(run.resume_cursor ?? 0),
    });
    return { ok: true, resumed: true, created: result.created, updated: result.updated, errorCount: result.errorCount };
  });

/* ---------------- Hatalı ürünler ---------------- */

export const listXmlFailedItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), feedId: z.guid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, data.storeId, context.userId);
    let query = context.supabase
      .from("xml_run_failed_items")
      .select("id, feed_id, run_id, sku, error_type, message, raw_data, status, created_at")
      .eq("store_id", data.storeId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.feedId) query = query.eq("feed_id", data.feedId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const { data: paused } = await context.supabase
      .from("xml_feeds")
      .select("id, name, paused_reason")
      .eq("store_id", data.storeId)
      .not("paused_reason", "is", null);
    return {
      items: (rows ?? []).map((row) => {
        const r = row as Record<string, unknown>;
        const raw = (r["raw_data"] ?? {}) as Record<string, unknown>;
        return {
          id: String(r["id"]),
          feedId: String(r["feed_id"]),
          sku: (r["sku"] as string | null) ?? null,
          errorType: String(r["error_type"]),
          message: (r["message"] as string | null) ?? "",
          sample: Object.entries(raw)
            .filter(([key]) => !key.startsWith("__rule__"))
            .slice(0, 6)
            .map(([key, value]) => `${key}: ${String(value).slice(0, 60)}`),
          createdAt: String(r["created_at"]),
        };
      }),
      pausedFeeds: (paused ?? []).map((row) => ({
        id: String((row as any).id),
        name: String((row as any).name),
        reason: String((row as any).paused_reason),
      })),
    };
  });

export const resolveXmlFailedItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ storeId: z.guid(), ids: z.array(z.guid()).min(1).max(500), action: z.enum(["retry", "skip"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, data.storeId, context.userId);
    const { data: rows, error } = await context.supabase
      .from("xml_run_failed_items")
      .update({ status: data.action === "retry" ? "retried" : "skipped" } as never)
      .in("id", data.ids)
      .eq("store_id", data.storeId)
      .select("feed_id");
    if (error) throw new Error(error.message);
    if (data.action === "skip") return { ok: true, runs: 0 };

    /* Yeniden dene: ilgili beslemeler delta atlanmadan yeniden çalıştırılır. */
    const feedIds = [...new Set((rows ?? []).map((row) => String((row as any).feed_id)))].slice(0, 3);
    const { consumeRateLimit, RATE_LIMITS } = await import("@/lib/rate-limit.server");
    const limit = await consumeRateLimit(`xml_run:${context.userId}`, RATE_LIMITS.import_trigger);
    if (!limit.allowed) throw new Error("Çok fazla çalıştırma denemesi, birkaç dakika sonra tekrar deneyin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { runImportFeed } = await import("@/lib/xml-import-engine.server");
    let errorCount = 0;
    for (const feedId of feedIds) {
      const feed = await loadFeedRecord(supabaseAdmin, data.storeId, feedId);
      const result = await runImportFeed(supabaseAdmin as never, { ...feed, forceFullSync: true } as never, { trigger: "manual" });
      errorCount += result.errorCount;
    }
    return { ok: true, runs: feedIds.length, errorCount };
  });
