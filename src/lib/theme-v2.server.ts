import type { SupabaseClient } from "@supabase/supabase-js";

import {
  V2_BLOCK_TYPES,
  V2_SECTIONS,
  V2_SECTION_TYPES,
  blockSettings,
  globalSettings,
  pageKey,
  presetToPages,
  sectionSettings,
  stripDangerousHtml,
  type V2Block,
  type V2BlockType,
  type V2PageType,
  type V2Section,
  type V2SectionType,
  type V2Settings,
  type V2Snapshot,
} from "@/lib/theme-v2";

/**
 * Tema v2 servis katmanı. Hem panel sunucu fonksiyonları (RLS kullanıcı
 * istemcisi) hem de /api/v2 (servis istemcisi) tarafından kullanılır; her
 * sorgu açıkça `store_id` ile sınırlandırılır.
 */

// Tablo tipleri henüz üretilmediği için gevşek istemci.
type Db = SupabaseClient;
const t = (db: Db, table: string) => (db as unknown as { from: (n: string) => ReturnType<Db["from"]> }).from(table);

export class V2Error extends Error {
  constructor(public code: string, public status = 400, message?: string) {
    super(message ?? code);
  }
}
const must = <T>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new V2Error("db_error", 500, res.error.message);
  return res.data as T;
};

export const THEME_COLS = "id, store_id, name, status, settings, created_at, updated_at, published_at";

function cleanSection(type: V2SectionType, settings: Record<string, unknown> | null | undefined, allowHtml: boolean) {
  if (type === "custom_html" && !allowHtml) throw new V2Error("custom_html_disabled", 403, "Özel HTML bu pakette kapalı.");
  const out = sectionSettings(type, settings);
  if (type === "custom_html") out.html = stripDangerousHtml(String(out.html));
  return out;
}
function cleanBlock(type: V2BlockType, settings: Record<string, unknown> | null | undefined, allowHtml: boolean) {
  if (type === "custom_html" && !allowHtml) throw new V2Error("custom_html_disabled", 403, "Özel HTML bu pakette kapalı.");
  const out = blockSettings(type, settings);
  if (type === "custom_html") out.html = stripDangerousHtml(String(out.html));
  return out;
}

export async function invalidateV2Cache(storeId: string) {
  const { cacheInvalidate, CACHE_NAMESPACES } = await import("@/lib/cache.server");
  await cacheInvalidate({ namespace: CACHE_NAMESPACES.storeSettings, storeId });
}

export async function listThemes(db: Db, storeId: string) {
  return must(await t(db, "v2_themes").select(THEME_COLS).eq("store_id", storeId).order("created_at", { ascending: false })) as Array<Record<string, unknown>>;
}

export async function getTheme(db: Db, storeId: string, themeId: string) {
  const theme = must(await t(db, "v2_themes").select(THEME_COLS).eq("store_id", storeId).eq("id", themeId).maybeSingle());
  if (!theme) throw new V2Error("not_found", 404);
  return theme as { id: string; name: string; status: string; settings: V2Settings; published_at: string | null };
}

export async function createTheme(db: Db, storeId: string, name: string, settings?: Record<string, unknown>) {
  const theme = must(await t(db, "v2_themes").insert({ store_id: storeId, name, status: "draft", settings: globalSettings(settings) }).select(THEME_COLS).single()) as { id: string };
  await ensurePage(db, storeId, theme.id, "home", null);
  return theme;
}

export async function updateThemeSettings(db: Db, storeId: string, themeId: string, input: { name?: string | undefined; settings?: Record<string, unknown> | undefined }) {
  await getTheme(db, storeId, themeId);
  const patch: Record<string, unknown> = {};
  if (input.name) patch.name = input.name;
  if (input.settings) patch.settings = globalSettings(input.settings);
  must(await t(db, "v2_themes").update(patch).eq("id", themeId).eq("store_id", storeId));
  return getTheme(db, storeId, themeId);
}

export async function listPages(db: Db, storeId: string, themeId: string) {
  return must(await t(db, "v2_theme_pages").select("id, page_type, custom_handle, updated_at").eq("store_id", storeId).eq("theme_id", themeId).order("page_type")) as Array<{ id: string; page_type: V2PageType; custom_handle: string | null }>;
}

export async function ensurePage(db: Db, storeId: string, themeId: string, pageType: V2PageType, handle: string | null) {
  let q = t(db, "v2_theme_pages").select("id").eq("store_id", storeId).eq("theme_id", themeId).eq("page_type", pageType);
  q = handle ? q.eq("custom_handle", handle) : q.is("custom_handle", null);
  const found = must(await q.maybeSingle()) as { id: string } | null;
  if (found) return found.id;
  const created = must(await t(db, "v2_theme_pages").insert({ store_id: storeId, theme_id: themeId, page_type: pageType, custom_handle: handle }).select("id").single()) as { id: string };
  return created.id;
}

/** Sayfanın bölümlerini (blokları ile) sıralı döndürür. */
export async function getPageTree(db: Db, storeId: string, pageId: string): Promise<V2Section[]> {
  const sections = must(await t(db, "v2_sections").select("id, section_type, position, is_visible, settings").eq("store_id", storeId).eq("theme_page_id", pageId).order("position")) as Array<{ id: string; section_type: V2SectionType; is_visible: boolean; settings: V2Settings }>;
  if (!sections.length) return [];
  const blocks = must(await t(db, "v2_blocks").select("id, section_id, block_type, position, is_visible, settings").eq("store_id", storeId).in("section_id", sections.map((s) => s.id)).order("position")) as Array<{ id: string; section_id: string; block_type: V2BlockType; is_visible: boolean; settings: V2Settings }>;
  return sections.map((s) => ({
    id: s.id, type: s.section_type, visible: s.is_visible, settings: sectionSettings(s.section_type, s.settings),
    blocks: blocks.filter((b) => b.section_id === s.id).map((b) => ({ id: b.id, type: b.block_type, visible: b.is_visible, settings: blockSettings(b.block_type, b.settings) })),
  }));
}

export async function getPageByType(db: Db, storeId: string, themeId: string, pageType: V2PageType, handle: string | null) {
  await getTheme(db, storeId, themeId);
  const pageId = await ensurePage(db, storeId, themeId, pageType, handle);
  return { pageId, sections: await getPageTree(db, storeId, pageId) };
}

/** Editör kaydı: sayfanın tüm bölüm/bloklarını verilen ağaçla değiştirir. */
export async function replacePageTree(db: Db, storeId: string, pageId: string, tree: V2Section[], allowHtml: boolean) {
  const rows = tree.map((s, i) => {
    if (!V2_SECTION_TYPES.includes(s.type)) throw new V2Error("invalid_section_type");
    const def = V2_SECTIONS[s.type];
    if (s.blocks.length > Math.max(def.maxBlocks, 0)) throw new V2Error("too_many_blocks", 400, `${def.label} en fazla ${def.maxBlocks} blok alabilir.`);
    return {
      section: { store_id: storeId, theme_page_id: pageId, section_type: s.type, position: i, is_visible: s.visible, settings: cleanSection(s.type, s.settings, allowHtml) },
      blocks: s.blocks.map((b, j) => {
        if (!V2_BLOCK_TYPES.includes(b.type) || !def.blocks.includes(b.type)) throw new V2Error("invalid_block_type", 400, `${b.type} bu bölüme eklenemez.`);
        return { store_id: storeId, block_type: b.type, position: j, is_visible: b.visible, settings: cleanBlock(b.type, b.settings, allowHtml) };
      }),
    };
  });
  must(await t(db, "v2_sections").delete().eq("store_id", storeId).eq("theme_page_id", pageId));
  if (!rows.length) return;
  const inserted = must(await t(db, "v2_sections").insert(rows.map((r) => r.section)).select("id, position")) as Array<{ id: string; position: number }>;
  const byPos = new Map(inserted.map((r) => [r.position, r.id]));
  const blockRows = rows.flatMap((r, i) => r.blocks.map((b) => ({ ...b, section_id: byPos.get(i) })));
  if (blockRows.length) must(await t(db, "v2_blocks").insert(blockRows));
}

/** Tüm sayfaların anlık görüntüsünü alır, temayı aktif yapar. */
export async function publishTheme(db: Db, storeId: string, themeId: string) {
  const theme = await getTheme(db, storeId, themeId);
  const pages = await listPages(db, storeId, themeId);
  const snapshot: V2Snapshot = { settings: globalSettings(theme.settings), pages: {} };
  for (const page of pages) {
    snapshot.pages[pageKey(page.page_type, page.custom_handle)] = (await getPageTree(db, storeId, page.id)).filter((s) => s.visible);
  }
  must(await t(db, "v2_themes").update({ status: "draft" }).eq("store_id", storeId).eq("status", "active").neq("id", themeId));
  must(await t(db, "v2_themes").update({ status: "active", published_snapshot: snapshot, published_at: new Date().toISOString() }).eq("id", themeId).eq("store_id", storeId));
  await invalidateV2Cache(storeId);
  return getTheme(db, storeId, themeId);
}

export async function duplicateTheme(db: Db, storeId: string, themeId: string, allowHtml: boolean) {
  const theme = await getTheme(db, storeId, themeId);
  const copy = must(await t(db, "v2_themes").insert({ store_id: storeId, name: `${theme.name} (kopya)`.slice(0, 120), status: "draft", settings: theme.settings }).select(THEME_COLS).single()) as { id: string };
  for (const page of await listPages(db, storeId, themeId)) {
    const tree = await getPageTree(db, storeId, page.id);
    const newPage = await ensurePage(db, storeId, copy.id, page.page_type, page.custom_handle);
    await replacePageTree(db, storeId, newPage, tree, allowHtml || !JSON.stringify(tree).includes("custom_html"));
  }
  return copy;
}

export async function applyPreset(db: Db, storeId: string, themeId: string, presetId: string, mode: "style" | "full", allowHtml: boolean) {
  const theme = await getTheme(db, storeId, themeId);
  const preset = must(await t(db, "v2_theme_presets").select("id, structure").eq("id", presetId).maybeSingle()) as { structure: unknown } | null;
  if (!preset) throw new V2Error("preset_not_found", 404);
  const parsed = presetToPages(preset.structure, () => crypto.randomUUID());
  // Yapı korunur, yalnız renk/font/buton/düzen değişir.
  must(await t(db, "v2_themes").update({ settings: { ...theme.settings, ...parsed.settings } }).eq("id", themeId).eq("store_id", storeId));
  if (mode === "full") {
    for (const [key, tree] of Object.entries(parsed.pages)) {
      const [type, handle] = key.startsWith("custom:") ? ["custom", key.slice(7)] : [key, null];
      const pageId = await ensurePage(db, storeId, themeId, type as V2PageType, handle);
      await replacePageTree(db, storeId, pageId, tree, allowHtml);
    }
  }
  return getTheme(db, storeId, themeId);
}

export async function listPresets(db: Db) {
  return must(await t(db, "v2_theme_presets").select("id, name, preview_image_url, structure, is_official, created_at").order("created_at")) as Array<{ id: string; name: string; structure: unknown }>;
}

// ── Tekil bölüm / blok işlemleri (API) ──────────────────────────────

async function sectionRow(db: Db, storeId: string, id: string) {
  const row = must(await t(db, "v2_sections").select("id, theme_page_id, section_type, settings, is_visible, position").eq("store_id", storeId).eq("id", id).maybeSingle()) as { id: string; theme_page_id: string; section_type: V2SectionType; settings: V2Settings } | null;
  if (!row) throw new V2Error("not_found", 404);
  return row;
}

export async function createSection(db: Db, storeId: string, input: { theme_page_id: string; section_type: V2SectionType; settings?: Record<string, unknown> | undefined; position?: number | undefined }, allowHtml: boolean) {
  const page = must(await t(db, "v2_theme_pages").select("id").eq("store_id", storeId).eq("id", input.theme_page_id).maybeSingle());
  if (!page) throw new V2Error("page_not_found", 404);
  const last = must(await t(db, "v2_sections").select("position").eq("theme_page_id", input.theme_page_id).order("position", { ascending: false }).limit(1)) as Array<{ position: number }>;
  return must(await t(db, "v2_sections").insert({
    store_id: storeId, theme_page_id: input.theme_page_id, section_type: input.section_type,
    position: input.position ?? (last[0]?.position ?? -1) + 1, settings: cleanSection(input.section_type, input.settings, allowHtml),
  }).select("*").single());
}

export async function updateSection(db: Db, storeId: string, id: string, input: { is_visible?: boolean | undefined; position?: number | undefined; settings?: Record<string, unknown> | undefined }, allowHtml: boolean) {
  const row = await sectionRow(db, storeId, id);
  const patch: Record<string, unknown> = {};
  if (input.is_visible !== undefined) patch.is_visible = input.is_visible;
  if (input.position !== undefined) patch.position = input.position;
  if (input.settings) patch.settings = cleanSection(row.section_type, { ...row.settings, ...input.settings }, allowHtml);
  return must(await t(db, "v2_sections").update(patch).eq("id", id).eq("store_id", storeId).select("*").single());
}

export async function reorder(db: Db, storeId: string, table: "v2_sections" | "v2_blocks", items: Array<{ id: string; position: number }>) {
  for (const item of items) must(await t(db, table).update({ position: item.position }).eq("id", item.id).eq("store_id", storeId));
  return { updated: items.length };
}

export async function deleteRow(db: Db, storeId: string, table: "v2_sections" | "v2_blocks", id: string) {
  const res = must(await t(db, table).delete().eq("id", id).eq("store_id", storeId).select("id")) as unknown[];
  if (!res.length) throw new V2Error("not_found", 404);
  return { deleted: id };
}

export async function createBlock(db: Db, storeId: string, input: { section_id: string; block_type: V2BlockType; settings?: Record<string, unknown> | undefined; position?: number | undefined }, allowHtml: boolean) {
  const section = await sectionRow(db, storeId, input.section_id);
  const def = V2_SECTIONS[section.section_type];
  if (!def.blocks.includes(input.block_type)) throw new V2Error("invalid_block_type", 400);
  const existing = must(await t(db, "v2_blocks").select("position").eq("section_id", input.section_id).order("position", { ascending: false })) as Array<{ position: number }>;
  if (existing.length >= def.maxBlocks) throw new V2Error("too_many_blocks", 400);
  return must(await t(db, "v2_blocks").insert({
    store_id: storeId, section_id: input.section_id, block_type: input.block_type,
    position: input.position ?? (existing[0]?.position ?? -1) + 1, settings: cleanBlock(input.block_type, input.settings, allowHtml),
  }).select("*").single());
}

export async function updateBlock(db: Db, storeId: string, id: string, input: { is_visible?: boolean | undefined; position?: number | undefined; settings?: Record<string, unknown> | undefined }, allowHtml: boolean) {
  const row = must(await t(db, "v2_blocks").select("id, block_type, settings").eq("store_id", storeId).eq("id", id).maybeSingle()) as { block_type: V2BlockType; settings: V2Settings } | null;
  if (!row) throw new V2Error("not_found", 404);
  const patch: Record<string, unknown> = {};
  if (input.is_visible !== undefined) patch.is_visible = input.is_visible;
  if (input.position !== undefined) patch.position = input.position;
  if (input.settings) patch.settings = cleanBlock(row.block_type, { ...row.settings, ...input.settings }, allowHtml);
  return must(await t(db, "v2_blocks").update(patch).eq("id", id).eq("store_id", storeId).select("*").single());
}

export type { V2Block, V2Section };
