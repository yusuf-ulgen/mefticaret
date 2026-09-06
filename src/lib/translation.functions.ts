import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { CONTENT_TYPES, SWITCHER_STYLES, BRAND_VOICES, sanitizeTranslation, checkTranslation } from "@/lib/translation";
import { isValidLocale, isRtlLanguage } from "@/lib/languages";

/**
 * Dil ve Çeviri Merkezi server function'ları.
 * Yetki kontrolü RLS + `stores` erişim kontrolü ile iki katmanlı yapılır.
 */

type Client = SupabaseClient<Database>;

const storeScope = z.object({ storeId: z.guid() });
const localeSchema = z.string().trim().min(2).max(20).refine(isValidLocale, "Geçersiz dil kodu");
const contentTypeSchema = z.enum(CONTENT_TYPES);

async function assertStoreAccess(supabase: Client, storeId: string): Promise<void> {
  const { data, error } = await supabase.from("stores").select("id").eq("id", storeId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
}

async function writeAudit(
  supabase: Client,
  input: {
    storeId: string;
    userId: string;
    action: string;
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
  },
) {
  const { insertAuditRow } = await import("@/lib/audit.server");
  await insertAuditRow(supabase, {
    store_id: input.storeId,
    actor_id: input.userId,
    action: input.action,
    entity: "translation",
    entity_id: input.entityId ?? input.storeId,
    ...(input.oldValue !== undefined ? { old_value: input.oldValue as never } : {}),
    ...(input.newValue !== undefined ? { new_value: input.newValue as never } : {}),
  });
}

/* ------------------------------------------------------------------- diller */

export const initLanguageCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId);
    const { ensureDefaultLocale, loadTranslationSettings } = await import("@/lib/translation.server");
    const locale = await ensureDefaultLocale(context.supabase, data.storeId);
    const settings = await loadTranslationSettings(context.supabase, data.storeId);
    return { defaultLocale: locale, settings };
  });

export const upsertStoreLocale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        id: z.guid().optional(),
        locale: localeSchema,
        label: z.string().trim().min(1).max(60),
        nativeLabel: z.string().trim().max(60).optional(),
        currency: z.string().trim().length(3).optional(),
        isActive: z.boolean().default(true),
        isDefault: z.boolean().default(false),
        fallbackCode: z.string().trim().max(20).nullable().default(null),
        sortOrder: z.number().int().min(0).max(999).default(0),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStoreAccess(supabase, data.storeId);

    const payload = {
      store_id: data.storeId,
      code: data.locale.slice(0, 2).toLowerCase(),
      locale: data.locale,
      label: data.label,
      native_label: data.nativeLabel ?? data.label,
      currency: data.currency ?? null,
      dir: isRtlLanguage(data.locale) ? "rtl" : "ltr",
      is_active: data.isActive,
      is_default: data.isDefault,
      fallback_code: data.fallbackCode,
      sort_order: data.sortOrder,
    };

    const { data: row, error } = await supabase
      .from("store_locales")
      .upsert(payload, { onConflict: "store_id,locale" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (data.isDefault) {
      await supabase
        .from("store_locales")
        .update({ is_default: false, is_active: true })
        .eq("store_id", data.storeId)
        .neq("id", row.id);
    }

    await writeAudit(supabase, {
      storeId: data.storeId,
      userId,
      action: "translation.locale_saved",
      entityId: row.id,
      newValue: payload,
    });
    return row;
  });

export const deleteStoreLocale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.extend({ id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStoreAccess(supabase, data.storeId);

    const { data: locale, error: readError } = await supabase
      .from("store_locales")
      .select("locale, is_default")
      .eq("id", data.id)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!locale) throw new Error("Dil bulunamadı");
    if (locale.is_default) throw new Error("Varsayılan dil silinemez. Önce başka bir dili varsayılan yap.");

    await supabase
      .from("translation_entries")
      .delete()
      .eq("store_id", data.storeId)
      .eq("locale", locale.locale);
    const { error } = await supabase.from("store_locales").delete().eq("id", data.id).eq("store_id", data.storeId);
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      storeId: data.storeId,
      userId,
      action: "translation.locale_deleted",
      entityId: data.id,
      oldValue: locale,
    });
    return { ok: true };
  });

/* ------------------------------------------------------------------ ayarlar */

export const saveTranslationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        enabled: z.boolean(),
        provider: z.enum(["lovable-ai"]),
        model: z.string().trim().min(2).max(80),
        brandVoice: z.enum(BRAND_VOICES),
        detectBrowserLanguage: z.boolean(),
        urlStrategy: z.enum(["subdirectory", "subdomain", "domain"]),
        showMissing: z.boolean(),
        translateSlugs: z.boolean(),
        switcherEnabled: z.boolean(),
        switcherStyle: z.enum(SWITCHER_STYLES),
        doNotTranslate: z.array(z.string().trim().min(1).max(60)).max(200),
        fallbackChain: z.array(localeSchema).max(10),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStoreAccess(supabase, data.storeId);

    const payload = {
      store_id: data.storeId,
      enabled: data.enabled,
      provider: data.provider,
      model: data.model,
      brand_voice: data.brandVoice,
      detect_browser_language: data.detectBrowserLanguage,
      url_strategy: data.urlStrategy,
      show_missing: data.showMissing,
      translate_slugs: data.translateSlugs,
      switcher_enabled: data.switcherEnabled,
      switcher_style: data.switcherStyle,
      do_not_translate: data.doNotTranslate,
      fallback_chain: data.fallbackChain,
    };
    const { data: row, error } = await supabase
      .from("translation_settings")
      .upsert(payload, { onConflict: "store_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit(supabase, {
      storeId: data.storeId,
      userId,
      action: "translation.settings_saved",
      newValue: payload,
    });
    return row;
  });

/* ---------------------------------------------------------- kaynak eşitleme */

export const syncTranslationSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        locales: z.array(localeSchema).min(1).max(30),
        contentTypes: z.array(contentTypeSchema).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId);
    const { collectSourceItems, syncSourceEntries } = await import("@/lib/translation.server");
    const items = await collectSourceItems(context.supabase, data.storeId, data.contentTypes);
    let created = 0;
    let stale = 0;
    for (const locale of data.locales) {
      const outcome = await syncSourceEntries(context.supabase, data.storeId, locale, items);
      created += outcome.created;
      stale += outcome.stale;
    }
    return { scanned: items.length, created, stale };
  });

/* -------------------------------------------------------- çeviri düzenleme */

export const saveTranslationEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        entryId: z.guid(),
        value: z.string().max(20000),
        approve: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStoreAccess(supabase, data.storeId);

    const { data: entry, error: readError } = await supabase
      .from("translation_entries")
      .select("*")
      .eq("id", data.entryId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!entry) throw new Error("Çeviri kaydı bulunamadı");

    const clean = sanitizeTranslation(data.value).trim();
    const issues = checkTranslation(entry.source_value ?? "", clean);
    const blocking = issues.filter((issue) => issue === "unsafe_html" || issue === "missing_placeholder");
    if (blocking.length > 0 && data.approve) {
      throw new Error("Çeviri onaylanamaz: değişkenler veya HTML yapısı bozulmuş.");
    }

    const status = !clean ? "missing" : data.approve ? "approved" : "translated";
    const { data: row, error } = await supabase
      .from("translation_entries")
      .update({ translated_value: clean || null, status, provider: "human", updated_by: userId })
      .eq("id", data.entryId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (data.approve && clean && entry.source_value) {
      const { rememberTranslation, ensureDefaultLocale } = await import("@/lib/translation.server");
      const sourceLocale = await ensureDefaultLocale(supabase, data.storeId);
      await rememberTranslation(supabase, {
        storeId: data.storeId,
        sourceLocale,
        targetLocale: entry.locale,
        sourceText: entry.source_value,
        targetText: clean,
      });
    }

    await writeAudit(supabase, {
      storeId: data.storeId,
      userId,
      action: "translation.entry_saved",
      entityId: data.entryId,
      oldValue: { key: entry.translation_key, locale: entry.locale, value: entry.translated_value },
      newValue: { key: entry.translation_key, locale: entry.locale, value: clean, status },
    });

    return { entry: row, issues };
  });

/* ---------------------------------------------------------- AI ile çevirme */

export const translateSelection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope.extend({ entryIds: z.array(z.guid()).min(1).max(50) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStoreAccess(supabase, data.storeId);

    const { data: entries, error } = await supabase
      .from("translation_entries")
      .select("id, translation_key, source_value, field, locale")
      .eq("store_id", data.storeId)
      .in("id", data.entryIds);
    if (error) throw new Error(error.message);
    if (!entries || entries.length === 0) throw new Error("Çevrilecek kayıt bulunamadı");

    const { translateEntries, ensureDefaultLocale, loadTranslationSettings } = await import(
      "@/lib/translation.server"
    );
    const sourceLocale = await ensureDefaultLocale(supabase, data.storeId);
    const settings = await loadTranslationSettings(supabase, data.storeId);

    const byLocale = new Map<string, typeof entries>();
    for (const entry of entries) {
      const list = byLocale.get(entry.locale) ?? [];
      list.push(entry);
      byLocale.set(entry.locale, list);
    }

    let translated = 0;
    let reused = 0;
    let failed = 0;
    for (const [locale, list] of byLocale) {
      const outcome = await translateEntries(supabase, {
        storeId: data.storeId,
        sourceLocale,
        targetLocale: locale,
        entries: list,
        settings,
        userId,
      });
      translated += outcome.translated;
      reused += outcome.reused;
      failed += outcome.failed;
    }
    return { translated, reused, failed };
  });

export const startBulkTranslation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        targetLocales: z.array(localeSchema).min(1).max(20),
        contentTypes: z.array(contentTypeSchema).default([]),
        onlyMissing: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStoreAccess(supabase, data.storeId);
    const { createTranslationJob, ensureDefaultLocale } = await import("@/lib/translation.server");
    const sourceLocale = await ensureDefaultLocale(supabase, data.storeId);
    const job = await createTranslationJob(supabase, {
      storeId: data.storeId,
      sourceLocale,
      targetLocales: data.targetLocales,
      contentTypes: data.contentTypes,
      userId,
      onlyMissing: data.onlyMissing,
    });
    await writeAudit(supabase, {
      storeId: data.storeId,
      userId,
      action: "translation.bulk_started",
      entityId: job.jobId,
      newValue: { ...data },
    });
    return job;
  });

export const retryTranslationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.extend({ jobId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertStoreAccess(supabase, data.storeId);
    const { error } = await supabase
      .from("translation_job_items")
      .update({ status: "queued" })
      .eq("job_id", data.jobId)
      .eq("store_id", data.storeId)
      .eq("status", "failed");
    if (error) throw new Error(error.message);
    await supabase
      .from("translation_jobs")
      .update({ status: "queued", failed_items: 0, error: null })
      .eq("id", data.jobId)
      .eq("store_id", data.storeId);

    const { enqueueJob } = await import("@/lib/queue.server");
    await enqueueJob(supabase, {
      kind: "ai",
      storeId: data.storeId,
      payload: { translationJobId: data.jobId },
      dedupeKey: `translation:${data.jobId}:retry:${Date.now()}`,
    });
    return { ok: true };
  });

/** Kuyruk worker'ını beklemeden işi bir tur ilerletir (panelden "şimdi çalıştır"). */
export const advanceTranslationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.extend({ jobId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId);
    const { runTranslationJob } = await import("@/lib/translation.server");
    return runTranslationJob(context.supabase, data.jobId, 50);
  });

/* -------------------------------------------------------------- sözlük */

export const saveGlossaryTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        id: z.guid().optional(),
        term: z.string().trim().min(1).max(80),
        locale: localeSchema.nullable().default(null),
        translation: z.string().trim().max(200).nullable().default(null),
        doNotTranslate: z.boolean().default(false),
        notes: z.string().trim().max(500).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertStoreAccess(supabase, data.storeId);
    const payload = {
      store_id: data.storeId,
      term: data.term,
      locale: data.locale,
      translation: data.doNotTranslate ? null : data.translation,
      do_not_translate: data.doNotTranslate,
      notes: data.notes,
    };
    const query = data.id
      ? supabase.from("translation_glossary").update(payload).eq("id", data.id).eq("store_id", data.storeId)
      : supabase.from("translation_glossary").insert(payload);
    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteGlossaryTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.extend({ id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId);
    const { error } = await context.supabase
      .from("translation_glossary")
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------- içe / dışa aktarma */

export const exportTranslations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({ locale: localeSchema, format: z.enum(["csv", "json"]).default("csv") })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId);
    const { data: rows, error } = await context.supabase
      .from("translation_entries")
      .select("translation_key, locale, source_value, translated_value, status")
      .eq("store_id", data.storeId)
      .eq("locale", data.locale)
      .order("translation_key")
      .limit(20000);
    if (error) throw new Error(error.message);

    if (data.format === "json") {
      return { format: "json" as const, content: JSON.stringify(rows ?? [], null, 2) };
    }
    const { toCsv } = await import("@/lib/translation");
    return { format: "csv" as const, content: toCsv(rows ?? []) };
  });

export const importTranslations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        locale: localeSchema,
        rows: z
          .array(z.object({ key: z.string().trim().min(1).max(300), value: z.string().max(20000) }))
          .min(1)
          .max(5000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertStoreAccess(supabase, data.storeId);

    let updated = 0;
    let skipped = 0;
    for (const row of data.rows) {
      const clean = sanitizeTranslation(row.value).trim();
      const { data: entry } = await supabase
        .from("translation_entries")
        .select("id")
        .eq("store_id", data.storeId)
        .eq("locale", data.locale)
        .eq("translation_key", row.key)
        .maybeSingle();
      if (!entry) {
        skipped += 1;
        continue;
      }
      await supabase
        .from("translation_entries")
        .update({
          translated_value: clean || null,
          status: clean ? "translated" : "missing",
          provider: "import",
          updated_by: userId,
        })
        .eq("id", entry.id);
      updated += 1;
    }

    await writeAudit(supabase, {
      storeId: data.storeId,
      userId,
      action: "translation.imported",
      newValue: { locale: data.locale, updated, skipped },
    });
    return { updated, skipped };
  });
