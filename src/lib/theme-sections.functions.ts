import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_SECTION_LAYOUT,
  SECTION_BY_TYPE,
  THEME_SECTIONS,
  type SectionSettings,
  type ThemeSectionType,
} from "@/lib/theme-sections";

/**
 * Modüler tema bileşenleri için yazma katmanı.
 * Tenant izolasyonu ve yetki RLS ile zorlanır (app_private.can_manage_store).
 */

const sectionTypes = THEME_SECTIONS.map((section) => section.type) as [ThemeSectionType, ...ThemeSectionType[]];

const settingsSchema = z.record(z.string(), z.union([z.string().max(20000), z.number(), z.boolean()]));

/** Yalnızca bileşenin tanımlı alanlarını, tanımlı tipleriyle kabul eder. */
function normalizeSettings(type: ThemeSectionType, input: Record<string, string | number | boolean>) {
  const definition = SECTION_BY_TYPE.get(type)!;
  const out: SectionSettings = { ...definition.defaults };
  for (const [key, value] of Object.entries(input)) {
    if (!(key in definition.defaults)) continue;
    const fallback = definition.defaults[key];
    if (typeof fallback === "number") out[key] = Number.isFinite(Number(value)) ? Number(value) : fallback;
    else if (typeof fallback === "boolean") out[key] = Boolean(value);
    else out[key] = String(value ?? "");
  }
  return out;
}

export const addThemeSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), type: z.enum(sectionTypes) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const definition = SECTION_BY_TYPE.get(data.type)!;

    const { data: existing, error: readError } = await context.supabase
      .from("store_theme_sections")
      .select("id, type, position")
      .eq("store_id", data.storeId);
    if (readError) throw new Error(readError.message);

    if (!definition.repeatable && (existing ?? []).some((row) => row.type === data.type)) {
      throw new Error(`${definition.label} bileşeni yalnızca bir kez eklenebilir.`);
    }

    const nextPosition = (existing ?? []).reduce((max, row) => Math.max(max, row.position), -1) + 1;

    const { data: inserted, error } = await context.supabase
      .from("store_theme_sections")
      .insert({
        store_id: data.storeId,
        type: data.type,
        position: nextPosition,
        is_enabled: true,
        settings: definition.defaults,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

export const updateThemeSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        sectionId: z.guid(),
        type: z.enum(sectionTypes),
        isEnabled: z.boolean(),
        settings: settingsSchema,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("store_theme_sections")
      .update({
        is_enabled: data.isEnabled,
        settings: normalizeSettings(data.type, data.settings),
      })
      .eq("id", data.sectionId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeThemeSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), sectionId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("store_theme_sections")
      .delete()
      .eq("id", data.sectionId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderThemeSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ storeId: z.guid(), sectionIds: z.array(z.guid()).min(1).max(60) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    for (const [index, sectionId] of data.sectionIds.entries()) {
      const { error } = await context.supabase
        .from("store_theme_sections")
        .update({ position: index })
        .eq("id", sectionId)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Bileşen listesini varsayılan modüler düzenle sıfırlar. */
export const resetThemeSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error: deleteError } = await context.supabase
      .from("store_theme_sections")
      .delete()
      .eq("store_id", data.storeId);
    if (deleteError) throw new Error(deleteError.message);

    const rows = DEFAULT_SECTION_LAYOUT.map((type, index) => ({
      store_id: data.storeId,
      type,
      position: index,
      is_enabled: true,
      settings: SECTION_BY_TYPE.get(type)!.defaults,
    }));

    const { error } = await context.supabase.from("store_theme_sections").insert(rows);
    if (error) throw new Error(error.message);
    return { count: rows.length };
  });

/** Tema düzeyinde özel CSS / JavaScript. */
export const saveThemeCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        customCss: z.string().max(40000).nullish(),
        customJs: z.string().max(40000).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("store_themes")
      .update({ custom_css: data.customCss || null, custom_js: data.customJs || null })
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
