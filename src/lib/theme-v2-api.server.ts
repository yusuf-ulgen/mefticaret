import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { V2_BLOCK_TYPES, V2_PAGE_TYPES, V2_SECTION_TYPES, type V2PageType } from "@/lib/theme-v2";
import * as svc from "@/lib/theme-v2.server";

/**
 * /api/v2/themes, /api/v2/sections, /api/v2/blocks, /api/v2/theme-presets.
 * Yalnız `v2_theme_editor` açık mağazalarda; tüm sorgular store_id ile sınırlı.
 */
export const THEME_V2_RESOURCES = new Set(["themes", "sections", "blocks", "theme-presets", "theme-templates"]);

type Out = { status: number; body: unknown };
const ok = (body: unknown, status = 200): Out => ({ status, body: { data: body } });
const err = (error: string, status: number, message?: string): Out => ({ status, body: { error, ...(message ? { message } : {}) } });
const guid = z.guid();
const settings = z.record(z.string().max(60), z.union([z.string().max(20000), z.number(), z.boolean()]));
const reorderSchema = z.object({ items: z.array(z.object({ id: guid, position: z.number().int().min(0).max(999) })).min(1).max(100) });

export async function themeV2Flags(admin: SupabaseClient, storeId: string) {
  const { loadEntitlements } = await import("@/lib/entitlements.server");
  const ent = await loadEntitlements(admin as never, storeId);
  return {
    editor: ent.modules["v2_theme_editor"] === true,
    presets: ent.modules["v2_theme_presets"] === true,
    customHtml: ent.modules["v2_custom_html"] === true,
    system: ent.modules["v2_theme_system"] === true,
    marketplace: ent.modules["v2_theme_marketplace"] === true,
    versions: ent.modules["v2_theme_versions"] === true,
    exportZip: ent.modules["v2_theme_export"] === true,
    importZip: ent.modules["v2_theme_import"] === true,
  };
}

async function parse<T extends z.ZodTypeAny>(request: Request, schema: T): Promise<z.infer<T> | null> {
  const raw = await request.json().catch(() => null);
  const res = schema.safeParse(raw);
  return res.success ? res.data : null;
}

export async function handleThemeV2(
  admin: SupabaseClient,
  storeId: string,
  method: string,
  segments: string[],
  request: Request,
): Promise<Out> {
  const flags = await themeV2Flags(admin, storeId);
  const [resource, id, sub, subId] = segments;
  const html = flags.customHtml;
  const sys = await import("@/lib/theme-system-v2.server");
  const { themeManifestSchema, themeAssetSchema, THEME_ZIP_LIMITS } = await import("@/lib/theme-system-v2");

  try {
    // ── Tema Sistemi v2 (marketplace + kütüphane uçları) ──
    if (resource === "theme-templates") {
      if (!flags.system || !flags.marketplace) return err("feature_disabled", 403);
      if (!id && method === "GET") {
        const u = new URL(request.url).searchParams;
        const price = u.get("price");
        return ok(await sys.listTemplates(admin, { q: u.get("q")?.slice(0, 80) ?? undefined, category: u.get("category")?.slice(0, 20) ?? undefined, price: price === "free" || price === "paid" ? price : "all" }));
      }
      if (!id || !guid.safeParse(id).success) return err("invalid_id", 400);
      if (!sub && method === "GET") return ok(await sys.getTemplate(admin, id));
      if (sub === "install" && method === "POST") return ok(await sys.installTemplate(admin, storeId, id, null as unknown as string, html), 201);
      return err("not_found", 404);
    }
    if (resource === "themes" && flags.system) {
      if (id === "import" && method === "POST") {
        if (!flags.importZip) return err("feature_disabled", 403);
        const b = await parse(request, z.object({ manifest: themeManifestSchema, assets: z.array(themeAssetSchema).max(THEME_ZIP_LIMITS.maxFiles).default([]), rename: z.string().trim().min(1).max(120).optional() }));
        if (!b) return err("invalid_body", 400);
        if (!html && JSON.stringify(b.manifest.snapshot).includes("custom_html")) return err("custom_html_disabled", 403);
        return ok(await sys.importTheme(admin, storeId, b.manifest, b.assets, null as unknown as string, html, b.rename), 201);
      }
      if (id && guid.safeParse(id).success) {
        if (!sub && method === "PUT") {
          const b = await parse(request, z.object({ name: z.string().trim().min(1).max(120).optional(), settings: settings.optional() }));
          if (!b) return err("invalid_body", 400);
          const r = await svc.updateThemeSettings(admin, storeId, id, b);
          if (flags.versions) await sys.recordVersion(admin, storeId, id, null, "API").catch(() => undefined);
          await sys.invalidateThemeCss(storeId, id);
          return ok(r);
        }
        if (!sub && method === "DELETE") return ok(await sys.deleteTheme(admin, storeId, id));
        if (sub === "publish" && method === "POST") return ok(await sys.publish(admin, storeId, id, null));
        if (sub === "settings" && method === "GET") return ok((await svc.getTheme(admin, storeId, id)).settings);
        if (sub === "css" && method === "GET") return { status: 200, body: { data: { css: await sys.getThemeCss(admin, storeId, id) } } };
        if (sub === "versions" && method === "GET") {
          if (!flags.versions) return err("feature_disabled", 403);
          return ok(await sys.listVersions(admin, storeId, id));
        }
        if (sub === "restore" && method === "POST" && subId) {
          if (!flags.versions) return err("feature_disabled", 403);
          if (!guid.safeParse(subId).success) return err("invalid_id", 400);
          await sys.recordVersion(admin, storeId, id, null, "Geri dönüş öncesi yedek", "Geri dönüş öncesi otomatik yedek");
          const v = await sys.getVersion(admin, storeId, id, subId);
          await sys.applySnapshot(admin, storeId, id, v.snapshot, html);
          await sys.invalidateThemeCss(storeId, id);
          return ok({ restored: subId });
        }
        if (sub === "preview-token" && method === "GET") return ok(await sys.createPreviewToken(admin, storeId, id, null as unknown as string));
        if (sub === "export" && method === "POST") {
          if (!flags.exportZip) return err("feature_disabled", 403);
          return ok(await sys.exportTheme(admin, storeId, id));
        }
      }
    }

    if (!flags.editor) return err("feature_disabled", 403);
    if (resource === "theme-presets") {
      if (method !== "GET") return err("method_not_allowed", 405);
      if (!flags.presets) return err("feature_disabled", 403);
      return ok(await svc.listPresets(admin));
    }

    if (resource === "themes") {
      if (!id) {
        if (method === "GET") return ok(await svc.listThemes(admin, storeId));
        if (method === "POST") {
          const b = await parse(request, z.object({ name: z.string().trim().min(1).max(120), settings: settings.optional() }));
          if (!b) return err("invalid_body", 400);
          return ok(await svc.createTheme(admin, storeId, b.name, b.settings), 201);
        }
        return err("method_not_allowed", 405);
      }
      if (!guid.safeParse(id).success) return err("invalid_id", 400);
      if (!sub && method === "GET") {
        const theme = await svc.getTheme(admin, storeId, id);
        return ok({ ...theme, pages: await svc.listPages(admin, storeId, id) });
      }
      if (sub === "settings" && method === "PUT") {
        const b = await parse(request, z.object({ name: z.string().trim().min(1).max(120).optional(), settings: settings.optional() }));
        if (!b) return err("invalid_body", 400);
        return ok(await svc.updateThemeSettings(admin, storeId, id, b));
      }
      if (sub === "publish" && method === "POST") return ok(await svc.publishTheme(admin, storeId, id));
      if (sub === "duplicate" && method === "POST") return ok(await svc.duplicateTheme(admin, storeId, id, html), 201);
      if (sub === "pages" && method === "GET") {
        if (!subId) return ok(await svc.listPages(admin, storeId, id));
        if (!V2_PAGE_TYPES.includes(subId as V2PageType)) return err("invalid_page_type", 400);
        const handle = new URL(request.url).searchParams.get("handle");
        return ok(await svc.getPageByType(admin, storeId, id, subId as V2PageType, handle && /^[a-z0-9-]{1,80}$/.test(handle) ? handle : null));
      }
      if (sub === "apply-preset" && method === "POST" && subId) {
        if (!flags.presets) return err("feature_disabled", 403);
        if (!guid.safeParse(subId).success) return err("invalid_id", 400);
        const mode = new URL(request.url).searchParams.get("mode") === "full" ? "full" : "style";
        return ok(await svc.applyPreset(admin, storeId, id, subId, mode, html));
      }
      return err("not_found", 404);
    }

    const table = resource === "sections" ? "v2_sections" : "v2_blocks";
    if (id === "reorder" && method === "PUT") {
      const b = await parse(request, reorderSchema);
      if (!b) return err("invalid_body", 400);
      const res = await svc.reorder(admin, storeId, table, b.items);
      await svc.invalidateV2Cache(storeId);
      return ok(res);
    }
    if (!id) {
      if (method !== "POST") return err("method_not_allowed", 405);
      if (resource === "sections") {
        const b = await parse(request, z.object({ theme_page_id: guid, section_type: z.enum(V2_SECTION_TYPES), settings: settings.optional(), position: z.number().int().min(0).optional() }));
        if (!b) return err("invalid_body", 400);
        return ok(await svc.createSection(admin, storeId, b, html), 201);
      }
      const b = await parse(request, z.object({ section_id: guid, block_type: z.enum(V2_BLOCK_TYPES), settings: settings.optional(), position: z.number().int().min(0).optional() }));
      if (!b) return err("invalid_body", 400);
      return ok(await svc.createBlock(admin, storeId, b, html), 201);
    }
    if (!guid.safeParse(id).success) return err("invalid_id", 400);
    if (method === "DELETE" && !sub) return ok(await svc.deleteRow(admin, storeId, table, id));
    if (method === "PUT") {
      const schema = sub === "settings"
        ? z.object({ settings })
        : z.object({ is_visible: z.boolean().optional(), position: z.number().int().min(0).optional(), settings: settings.optional() });
      const b = await parse(request, schema);
      if (!b) return err("invalid_body", 400);
      return ok(resource === "sections" ? await svc.updateSection(admin, storeId, id, b, html) : await svc.updateBlock(admin, storeId, id, b, html));
    }
    return err("method_not_allowed", 405);
  } catch (cause) {
    if (cause instanceof svc.V2Error) return err(cause.code, cause.status, cause.message !== cause.code ? cause.message : undefined);
    throw cause;
  }
}
