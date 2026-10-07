import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { V2_BLOCK_TYPES, V2_PAGE_TYPES, V2_SECTION_TYPES, type V2Section, type V2Snapshot } from "@/lib/theme-v2";

const value = z.union([z.string().max(20000), z.number(), z.boolean()]);
const settings = z.record(z.string().max(60), value);
const block = z.object({ id: z.string().max(64), type: z.enum(V2_BLOCK_TYPES), visible: z.boolean(), settings });
const section = z.object({ id: z.string().max(64), type: z.enum(V2_SECTION_TYPES), visible: z.boolean(), settings, blocks: z.array(block).max(16) });
const handle = z.string().regex(/^[a-z0-9-]{1,80}$/).nullish();
const base = { storeId: z.guid() };

async function gate(db: SupabaseClient, storeId: string) {
  const { loadEntitlements, requirePlanModule } = await import("@/lib/entitlements.server");
  await requirePlanModule(db as never, storeId, "v2_theme_editor");
  const ent = await loadEntitlements(db as never, storeId);
  return { presets: ent.modules["v2_theme_presets"] === true, customHtml: ent.modules["v2_custom_html"] === true, darkMode: ent.modules["v2_dark_mode"] === true, versions: ent.modules["v2_theme_versions"] === true };
}

async function sys2Invalidate(storeId: string, themeId: string) {
  const sys = await import("@/lib/theme-system-v2.server");
  await sys.invalidateThemeCss(storeId, themeId).catch(() => undefined);
}

async function wrap<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    throw new Error(cause instanceof Error ? cause.message : "Beklenmeyen hata");
  }
}

/** Editör açılışı: yetki bayrakları + tema listesi (yoksa ilk tema oluşturulur). */
export const v2Bootstrap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object(base).parse(d))
  .handler(async ({ data, context }) => wrap(async () => {
    const db = context.supabase as unknown as SupabaseClient;
    const flags = await gate(db, data.storeId);
    const svc = await import("@/lib/theme-v2.server");
    let themes = await svc.listThemes(db, data.storeId);
    if (!themes.length) {
      await svc.createTheme(db, data.storeId, "Temam");
      themes = await svc.listThemes(db, data.storeId);
    }
    return { flags, themes: themes as Array<{ id: string; name: string; status: string; published_at: string | null }> };
  }));

export const v2LoadPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ...base, themeId: z.guid(), pageType: z.enum(V2_PAGE_TYPES), handle }).parse(d))
  .handler(async ({ data, context }) => wrap(async () => {
    const db = context.supabase as unknown as SupabaseClient;
    await gate(db, data.storeId);
    const svc = await import("@/lib/theme-v2.server");
    const theme = await svc.getTheme(db, data.storeId, data.themeId);
    const page = await svc.getPageByType(db, data.storeId, data.themeId, data.pageType, data.handle ?? null);
    return { theme: { id: theme.id, name: theme.name, status: theme.status, settings: theme.settings }, pageId: page.pageId, sections: page.sections as V2Section[] };
  }));

export const v2SavePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ...base, themeId: z.guid(), pageId: z.guid(), settings, sections: z.array(section).max(40) }).parse(d))
  .handler(async ({ data, context }) => wrap(async () => {
    const db = context.supabase as unknown as SupabaseClient;
    const flags = await gate(db, data.storeId);
    const svc = await import("@/lib/theme-v2.server");
    const nextSettings = flags.darkMode ? data.settings : { ...data.settings, dark_mode: "off" };
    await svc.updateThemeSettings(db, data.storeId, data.themeId, { settings: nextSettings });
    await svc.replacePageTree(db, data.storeId, data.pageId, data.sections as V2Section[], flags.customHtml);
    if (flags.versions) {
      const sys = await import("@/lib/theme-system-v2.server");
      await sys.recordVersion(db, data.storeId, data.themeId, context.userId, "Editör kaydı").catch(() => undefined);
    }
    await sys2Invalidate(data.storeId, data.themeId);
    return { ok: true };
  }));

export const v2Publish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ...base, themeId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => wrap(async () => {
    const db = context.supabase as unknown as SupabaseClient;
    await gate(db, data.storeId);
    const svc = await import("@/lib/theme-v2.server");
    const theme = await svc.publishTheme(db, data.storeId, data.themeId);
    return { published_at: theme.published_at };
  }));

export const v2ThemeAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ...base, action: z.enum(["create", "duplicate", "rename", "archive"]), themeId: z.guid().optional(), name: z.string().trim().min(1).max(120).optional() }).parse(d))
  .handler(async ({ data, context }) => wrap(async () => {
    const db = context.supabase as unknown as SupabaseClient;
    const flags = await gate(db, data.storeId);
    const svc = await import("@/lib/theme-v2.server");
    if (data.action === "create") return svc.createTheme(db, data.storeId, data.name ?? "Yeni tema") as Promise<{ id: string }>;
    if (!data.themeId) throw new Error("Tema seçilmedi.");
    if (data.action === "duplicate") return svc.duplicateTheme(db, data.storeId, data.themeId, flags.customHtml) as Promise<{ id: string }>;
    if (data.action === "rename") return svc.updateThemeSettings(db, data.storeId, data.themeId, { name: data.name }) as unknown as Promise<{ id: string }>;
    const theme = await svc.getTheme(db, data.storeId, data.themeId);
    if (theme.status === "active") throw new Error("Yayındaki tema arşivlenemez.");
    await (db as unknown as { from: (n: string) => { update: (p: object) => { eq: (a: string, b: string) => { eq: (a: string, b: string) => Promise<unknown> } } } })
      .from("v2_themes").update({ status: "archived" }).eq("id", data.themeId).eq("store_id", data.storeId);
    return { id: data.themeId };
  }));

export const v2ListPresets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object(base).parse(d))
  .handler(async ({ data, context }) => wrap(async () => {
    const db = context.supabase as unknown as SupabaseClient;
    const flags = await gate(db, data.storeId);
    if (!flags.presets) return [];
    const svc = await import("@/lib/theme-v2.server");
    return (await svc.listPresets(db)) as unknown as Array<{ id: string; name: string; structure: import("@/integrations/supabase/types").Json }>;
  }));

export const v2ApplyPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ...base, themeId: z.guid(), presetId: z.guid(), mode: z.enum(["style", "full"]) }).parse(d))
  .handler(async ({ data, context }) => wrap(async () => {
    const db = context.supabase as unknown as SupabaseClient;
    const flags = await gate(db, data.storeId);
    if (!flags.presets) throw new Error("Tema presetleri bu pakette kapalı.");
    const svc = await import("@/lib/theme-v2.server");
    await svc.applyPreset(db, data.storeId, data.themeId, data.presetId, data.mode, flags.customHtml);
    return { ok: true };
  }));

/**
 * Vitrin: mağazanın yayınlanmış v2 teması (özellik açıksa). Herkese açık;
 * yalnız yayınlanmış görüntü döner, 10 dk önbellek.
 */
export const getPublishedV2Theme = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ storeId: z.guid() }).parse(d))
  .handler(async ({ data }): Promise<V2Snapshot | null> => {
    try {
      const { cached, CACHE_NAMESPACES } = await import("@/lib/cache.server");
      return await cached(`v2theme:${data.storeId}`, CACHE_NAMESPACES.storeSettings, async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { loadEntitlements } = await import("@/lib/entitlements.server");
        const ent = await loadEntitlements(supabaseAdmin as never, data.storeId);
        if (ent.modules["v2_theme_editor"] !== true) return null;
        const { data: row } = await (supabaseAdmin as unknown as SupabaseClient)
          .from("v2_themes").select("published_snapshot").eq("store_id", data.storeId).eq("status", "active").maybeSingle();
        return ((row as { published_snapshot?: V2Snapshot } | null)?.published_snapshot ?? null);
      }, { ttlSeconds: 15, storeId: data.storeId });
    } catch {
      return null;
    }
  });
