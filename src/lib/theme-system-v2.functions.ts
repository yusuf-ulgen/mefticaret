import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { themeAssetSchema, themeManifestSchema, THEME_ZIP_LIMITS } from "@/lib/theme-system-v2";

/** Tema Sistemi v2 panel sunucu fonksiyonları. Her özellik kendi plan bayrağıyla korunur. */

const base = { storeId: z.guid() };
const themeInput = z.object({ ...base, themeId: z.guid() });

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type ThemeSystemFlags = { system: boolean; marketplace: boolean; versions: boolean; exportZip: boolean; importZip: boolean; darkMode: boolean; customHtml: boolean; editor: boolean };

async function flagsFor(db: SupabaseClient, storeId: string): Promise<ThemeSystemFlags> {
  const { loadEntitlements } = await import("@/lib/entitlements.server");
  const m = (await loadEntitlements(db as never, storeId)).modules;
  return {
    system: m["v2_theme_system"] === true, marketplace: m["v2_theme_marketplace"] === true, versions: m["v2_theme_versions"] === true,
    exportZip: m["v2_theme_export"] === true, importZip: m["v2_theme_import"] === true, darkMode: m["v2_dark_mode"] === true,
    customHtml: m["v2_custom_html"] === true, editor: m["v2_theme_editor"] === true,
  };
}

const LABELS: Record<string, string> = { system: "Tema Sistemi v2", marketplace: "Tema Marketi", versions: "Sürüm geçmişi", exportZip: "Tema indirme", importZip: "Tema yükleme" };

async function gate(db: SupabaseClient, storeId: string, ...need: Array<keyof ThemeSystemFlags>) {
  const flags = await flagsFor(db, storeId);
  for (const key of ["system", ...need] as Array<keyof ThemeSystemFlags>) {
    if (!flags[key]) throw new Error(`${LABELS[key] ?? key} özelliği paketinde kapalı.`);
  }
  return flags;
}

async function run<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (cause) {
    throw new Error(cause instanceof Error ? cause.message : "Beklenmeyen hata");
  }
}

const db = (ctx: { supabase: unknown }) => ctx.supabase as SupabaseClient;
const sys = () => import("@/lib/theme-system-v2.server");

export const tsFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object(base).parse(d))
  .handler(async ({ data, context }) => run(() => flagsFor(db(context), data.storeId)));

export const tsListTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ...base, q: z.string().max(80).optional(), category: z.string().max(20).optional(), price: z.enum(["all", "free", "paid"]).optional() }).parse(d))
  .handler(async ({ data, context }) => run(async () => {
    await gate(db(context), data.storeId, "marketplace");
    return (await sys()).listTemplates(db(context), data) as Promise<Array<{ id: string; name: string; slug: string; description: string; preview_image_url: string | null; price: number; currency: string; category: string; rating_avg: number; rating_count: number; downloads_count: number; is_featured: boolean; is_official: boolean; author: string; version: string; structure_json: Json }>>;
  }));

export const tsGetTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ...base, templateId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => run(async () => {
    await gate(db(context), data.storeId, "marketplace");
    const res = await (await sys()).getTemplate(db(context), data.templateId);
    const mine = res.reviews.find((r) => r["store_id"] === data.storeId) ?? null;
    return { ...res, myReview: mine as { rating: number; comment: string } | null } as {
      template: { id: string; name: string; description: string; price: number; currency: string; features: string[]; tags: string[]; structure_json: Json; preview_url: string | null; rating_avg: number; rating_count: number; downloads_count: number; author: string; version: string; category: string };
      screenshots: Array<{ id: string; url: string; device_type: string }>;
      reviews: Array<{ id: string; author_name: string; rating: number; comment: string; created_at: string }>;
      myReview: { rating: number; comment: string } | null;
    };
  }));

export const tsInstallTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ...base, templateId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => run(async () => {
    const flags = await gate(db(context), data.storeId, "marketplace");
    return (await sys()).installTemplate(db(context), data.storeId, data.templateId, context.userId, flags.customHtml);
  }));

export const tsReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ...base, templateId: z.guid(), rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000) }).parse(d))
  .handler(async ({ data, context }) => run(async () => {
    await gate(db(context), data.storeId, "marketplace");
    return (await sys()).upsertReview(db(context), data.storeId, data.templateId, context.userId, data.rating, data.comment);
  }));

export const tsLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object(base).parse(d))
  .handler(async ({ data, context }) => run(async () => {
    const flags = await gate(db(context), data.storeId);
    const themes = await (await sys()).listLibrary(db(context), data.storeId);
    return { flags, themes: themes as Array<{ id: string; name: string; status: "active" | "draft" | "archived"; version: string; installed_at: string; published_at: string | null; updated_at: string; settings: Record<string, string | number | boolean>; template: { id: string; name: string; preview_image_url: string | null } | null }> };
  }));

export const tsThemeAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    ...base, themeId: z.guid(),
    action: z.enum(["publish", "duplicate", "rename", "archive", "unarchive", "delete"]),
    name: z.string().trim().min(1).max(120).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => run(async () => {
    const flags = await gate(db(context), data.storeId);
    const s = await sys();
    const svc = await import("@/lib/theme-v2.server");
    const d = db(context);
    switch (data.action) {
      case "publish": await s.publish(d, data.storeId, data.themeId, context.userId); break;
      case "duplicate": await svc.duplicateTheme(d, data.storeId, data.themeId, flags.customHtml); break;
      case "rename": if (!data.name) throw new Error("Ad gerekli."); await s.renameTheme(d, data.storeId, data.themeId, data.name); break;
      case "archive": await s.setArchived(d, data.storeId, data.themeId, true); break;
      case "unarchive": await s.setArchived(d, data.storeId, data.themeId, false); break;
      case "delete": await s.deleteTheme(d, data.storeId, data.themeId); break;
    }
    return { ok: true };
  }));

export const tsVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => themeInput.parse(d))
  .handler(async ({ data, context }) => run(async () => {
    await gate(db(context), data.storeId, "versions");
    const svc = await import("@/lib/theme-v2.server");
    const theme = await svc.getTheme(db(context), data.storeId, data.themeId);
    return { theme: { id: theme.id, name: theme.name, status: theme.status }, versions: await (await sys()).listVersions(db(context), data.storeId, data.themeId) };
  }));

export const tsVersionSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => themeInput.extend({ versionId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => run(async () => {
    await gate(db(context), data.storeId, "versions");
    const v = await (await sys()).getVersion(db(context), data.storeId, data.themeId, data.versionId);
    return v.snapshot as { settings: Record<string, string | number | boolean>; pages: Record<string, never[]> };
  }));

export const tsRestoreVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => themeInput.extend({ versionId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => run(async () => {
    const flags = await gate(db(context), data.storeId, "versions");
    return (await sys()).restoreVersion(db(context), data.storeId, data.themeId, data.versionId, context.userId, flags.customHtml);
  }));

export const tsPreviewToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => themeInput.parse(d))
  .handler(async ({ data, context }) => run(async () => {
    await gate(db(context), data.storeId);
    return (await sys()).createPreviewToken(db(context), data.storeId, data.themeId, context.userId);
  }));

export const tsExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => themeInput.parse(d))
  .handler(async ({ data, context }) => run(async () => {
    await gate(db(context), data.storeId, "exportZip");
    return (await sys()).exportTheme(db(context), data.storeId, data.themeId) as unknown as Promise<{ manifest: { [k: string]: Json } & { name: string }; assets: Array<{ key: string; type: string; value: string | null; url: string | null }>; css: string }>;
  }));

const importInput = z.object({
  ...base,
  manifest: themeManifestSchema,
  assets: z.array(themeAssetSchema).max(THEME_ZIP_LIMITS.maxFiles),
  rename: z.string().trim().min(1).max(120).optional(),
  dryRun: z.boolean().optional(),
});

export const tsImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => importInput.parse(d))
  .handler(async ({ data, context }) => run(async () => {
    const flags = await gate(db(context), data.storeId, "importZip");
    const s = await sys();
    const name = data.rename ?? data.manifest.name;
    const conflicts = await s.importConflicts(db(context), data.storeId, name);
    const usesHtml = JSON.stringify(data.manifest.snapshot).includes("custom_html");
    if (data.dryRun) return { dryRun: true as const, conflicts: conflicts.map((c) => c.name), blockedHtml: usesHtml && !flags.customHtml, id: null };
    if (usesHtml && !flags.customHtml) throw new Error("Bu tema Özel HTML bölümü içeriyor; paketinde kapalı.");
    const theme = await s.importTheme(db(context), data.storeId, data.manifest, data.assets, context.userId, flags.customHtml, data.rename);
    return { dryRun: false as const, conflicts: [], blockedHtml: false, id: theme.id };
  }));

/** Herkese açık, anahtar korumalı önizleme (paylaşılabilir bağlantı). */
export const tsResolvePreview = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ slug: z.string().regex(/^[a-z0-9-]{1,80}$/), themeId: z.guid(), token: z.string().regex(/^[A-Za-z0-9_-]{20,80}$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = await sys();
    try {
      const res = await s.resolvePreview(supabaseAdmin as unknown as SupabaseClient, data.slug, data.themeId, data.token);
      const { loadEntitlements } = await import("@/lib/entitlements.server");
      const ent = await loadEntitlements(supabaseAdmin as never, res.store.id);
      if (ent.modules["v2_theme_system"] !== true) return { ok: false as const, message: "Bu mağazada tema önizlemesi kapalı." };
      return { ok: true as const, ...res } as unknown as { ok: true; store: { id: string; name: string; slug: string }; theme: { id: string; name: string; status: string }; settings: Record<string, string | number | boolean>; pages: Record<string, never[]>; expires_at: string };
    } catch (cause) {
      return { ok: false as const, message: cause instanceof Error ? cause.message : "Önizleme açılamadı." };
    }
  });
