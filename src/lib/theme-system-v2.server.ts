import type { SupabaseClient } from "@supabase/supabase-js";

import { globalSettings, presetToPages, v2RootCss, pageKey, type V2PageType, type V2Section } from "@/lib/theme-v2";
import * as svc from "@/lib/theme-v2.server";
import {
  THEME_FORMAT,
  pageKeyToParts,
  sanitizeThemeCss,
  summarizeChange,
  type ThemeAsset,
  type ThemeManifest,
  type ThemeSnapshot,
} from "@/lib/theme-system-v2";

/**
 * Tema Sistemi v2 servis katmanı: marketplace şablonları, kurulum, sürümler,
 * önizleme anahtarları, dışa/içe aktarma ve CSS üretimi. Her sorgu `store_id`
 * ile açıkça sınırlandırılır; RLS ayrıca mağaza üyeliğini doğrular.
 */

type Db = SupabaseClient;
const t = (db: Db, table: string) => (db as unknown as { from: (n: string) => ReturnType<Db["from"]> }).from(table);
const { V2Error } = svc;
const must = <T>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new V2Error("db_error", 500, res.error.message);
  return res.data as T;
};

const VERSION_KEEP = 50;
const TEMPLATE_COLS = "id, name, slug, description, preview_image_url, preview_url, author, version, price, currency, category, tags, features, is_official, is_featured, downloads_count, rating_avg, rating_count, created_at";
export const LIB_COLS = "id, store_id, name, status, template_id, version, installed_at, published_at, updated_at, settings";

// ── CSS ─────────────────────────────────────────────────────────────

const cssKey = (storeId: string, themeId: string) => `store-settings:${storeId}:v2css:${themeId}`;

export async function invalidateThemeCss(storeId: string, _themeId?: string) {
  await svc.invalidateV2Cache(storeId);
}

/** Temanın üretilmiş CSS'i (değişkenler + temizlenmiş CSS varlıkları); 1 saat önbellek. */
export async function getThemeCss(db: Db, storeId: string, themeId: string): Promise<string> {
  const { cacheGet, cacheSet, CACHE_NAMESPACES } = await import("@/lib/cache.server");
  const key = cssKey(storeId, themeId);
  const hit = await cacheGet<string>(key);
  if (typeof hit === "string") return hit;
  const theme = await svc.getTheme(db, storeId, themeId);
  const assets = must(await t(db, "v2_theme_assets").select("key, value").eq("store_id", storeId).eq("tenant_theme_id", themeId).eq("asset_type", "css").order("key")) as Array<{ key: string; value: string | null }>;
  const css = `/* ${theme.name} — Mefticaret v2 */\n${v2RootCss(theme.settings)}\n${assets.map((a) => `/* ${a.key} */\n${sanitizeThemeCss(a.value ?? "")}`).join("\n")}`;
  await cacheSet(key, CACHE_NAMESPACES.storeSettings, css, { ttlSeconds: 3600, storeId });
  return css;
}

// ── Anlık görüntü & sürümler ───────────────────────────────────────

export async function buildSnapshot(db: Db, storeId: string, themeId: string): Promise<ThemeSnapshot> {
  const theme = await svc.getTheme(db, storeId, themeId);
  const snap: ThemeSnapshot = { settings: globalSettings(theme.settings), pages: {} };
  for (const page of await svc.listPages(db, storeId, themeId)) {
    snap.pages[pageKey(page.page_type, page.custom_handle)] = await svc.getPageTree(db, storeId, page.id);
  }
  return snap;
}

async function userName(db: Db, userId: string | null) {
  if (!userId) return "";
  const { data } = await t(db, "profiles").select("full_name").eq("id", userId).maybeSingle();
  return String((data as { full_name?: string } | null)?.full_name ?? "").slice(0, 80);
}

export async function recordVersion(db: Db, storeId: string, themeId: string, userId: string | null, label = "", summary?: string) {
  const snapshot = await buildSnapshot(db, storeId, themeId);
  const prev = must(await t(db, "v2_theme_versions").select("snapshot").eq("store_id", storeId).eq("tenant_theme_id", themeId).order("created_at", { ascending: false }).limit(1).maybeSingle()) as { snapshot: ThemeSnapshot } | null;
  const text = summary ?? summarizeChange(prev?.snapshot ?? null, snapshot);
  if (!summary && prev && text === "Değişiklik yok") return null;
  const row = must(await t(db, "v2_theme_versions").insert({
    store_id: storeId, tenant_theme_id: themeId, snapshot, label: label.slice(0, 120), summary: text,
    created_by_user_id: userId, created_by_name: await userName(db, userId),
  }).select("id").single()) as { id: string };
  const old = must(await t(db, "v2_theme_versions").select("id").eq("store_id", storeId).eq("tenant_theme_id", themeId).order("created_at", { ascending: false }).range(VERSION_KEEP, VERSION_KEEP + 100)) as Array<{ id: string }>;
  if (old.length) await t(db, "v2_theme_versions").delete().eq("store_id", storeId).in("id", old.map((o) => o.id));
  return row;
}

export async function listVersions(db: Db, storeId: string, themeId: string) {
  await svc.getTheme(db, storeId, themeId);
  return must(await t(db, "v2_theme_versions").select("id, label, summary, created_by_name, created_at").eq("store_id", storeId).eq("tenant_theme_id", themeId).order("created_at", { ascending: false }).limit(VERSION_KEEP)) as Array<{ id: string; label: string; summary: string; created_by_name: string; created_at: string }>;
}

export async function getVersion(db: Db, storeId: string, themeId: string, versionId: string) {
  const row = must(await t(db, "v2_theme_versions").select("id, snapshot, label, summary, created_at").eq("store_id", storeId).eq("tenant_theme_id", themeId).eq("id", versionId).maybeSingle()) as { id: string; snapshot: ThemeSnapshot } | null;
  if (!row) throw new V2Error("not_found", 404, "Sürüm bulunamadı.");
  return row;
}

/** Anlık görüntüyü temaya uygular (ayarlar + tüm sayfalar). */
export async function applySnapshot(db: Db, storeId: string, themeId: string, snapshot: ThemeSnapshot, allowHtml: boolean) {
  await svc.updateThemeSettings(db, storeId, themeId, { settings: snapshot.settings });
  const existing = await svc.listPages(db, storeId, themeId);
  const keys = new Set(Object.keys(snapshot.pages));
  for (const page of existing) {
    if (!keys.has(pageKey(page.page_type, page.custom_handle))) await svc.replacePageTree(db, storeId, page.id, [], allowHtml);
  }
  for (const [key, tree] of Object.entries(snapshot.pages)) {
    const { type, handle } = pageKeyToParts(key);
    const pageId = await svc.ensurePage(db, storeId, themeId, type as V2PageType, handle);
    await svc.replacePageTree(db, storeId, pageId, fresh(tree), allowHtml);
  }
}

const fresh = (tree: V2Section[]): V2Section[] =>
  tree.map((s) => ({ ...s, id: crypto.randomUUID(), blocks: s.blocks.map((b) => ({ ...b, id: crypto.randomUUID() })) }));

export async function restoreVersion(db: Db, storeId: string, themeId: string, versionId: string, userId: string, allowHtml: boolean) {
  const version = await getVersion(db, storeId, themeId, versionId);
  await recordVersion(db, storeId, themeId, userId, "Geri dönüş öncesi yedek", "Geri dönüş öncesi otomatik yedek");
  await applySnapshot(db, storeId, themeId, version.snapshot, allowHtml);
  await recordVersion(db, storeId, themeId, userId, "", `Sürüme geri dönüldü (${new Date((version as { created_at?: string }).created_at ?? Date.now()).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })})`);
  await invalidateThemeCss(storeId, themeId);
  return { ok: true };
}

// ── Marketplace ────────────────────────────────────────────────────

export async function listTemplates(db: Db, input: { q?: string | undefined; category?: string | undefined; price?: "free" | "paid" | "all" | undefined }) {
  let q = t(db, "v2_theme_templates").select(`${TEMPLATE_COLS}, structure_json`).eq("is_published", true);
  if (input.category === "featured") q = q.eq("is_featured", true);
  else if (input.category && input.category !== "all") q = q.eq("category", input.category);
  if (input.price === "free") q = q.eq("price", 0);
  if (input.price === "paid") q = q.gt("price", 0);
  if (input.q) q = q.ilike("name", `%${input.q.replace(/[%_,()]/g, " ").trim()}%`);
  return must(await q.order("is_featured", { ascending: false }).order("downloads_count", { ascending: false }).limit(60)) as Array<Record<string, unknown>>;
}

export async function getTemplate(db: Db, templateId: string) {
  const tpl = must(await t(db, "v2_theme_templates").select(`${TEMPLATE_COLS}, structure_json`).eq("id", templateId).eq("is_published", true).maybeSingle()) as Record<string, unknown> | null;
  if (!tpl) throw new V2Error("not_found", 404, "Tema bulunamadı.");
  const [shots, reviews] = await Promise.all([
    t(db, "v2_theme_template_screenshots").select("id, url, position, device_type").eq("template_id", templateId).order("position"),
    t(db, "v2_theme_template_reviews").select("id, store_id, author_name, rating, comment, created_at").eq("template_id", templateId).order("created_at", { ascending: false }).limit(50),
  ]);
  return { template: tpl, screenshots: (shots.data ?? []) as Array<{ id: string; url: string; device_type: string }>, reviews: (reviews.data ?? []) as Array<Record<string, unknown>> };
}

async function hasLicense(db: Db, storeId: string, licenseThemeId: string | null) {
  void db; void storeId; void licenseThemeId;
  return false; // Tema Mağazası kaldırıldı; ücretli lisans satın alınamaz.
}

export async function installTemplate(db: Db, storeId: string, templateId: string, userId: string, allowHtml: boolean) {
  const tpl = must(await t(db, "v2_theme_templates").select("id, name, version, price, structure_json, license_theme_id").eq("id", templateId).eq("is_published", true).maybeSingle()) as { id: string; name: string; version: string; price: number; structure_json: unknown; license_theme_id: string | null } | null;
  if (!tpl) throw new V2Error("not_found", 404, "Tema bulunamadı.");
  if (Number(tpl.price) > 0 && !(await hasLicense(db, storeId, tpl.license_theme_id))) {
    throw new V2Error("license_required", 402, "Bu tema ücretli. Ücretli temalar şu an kullanılamıyor.");
  }
  const parsed = presetToPages(tpl.structure_json, () => crypto.randomUUID());
  const theme = must(await t(db, "v2_themes").insert({
    store_id: storeId, name: tpl.name, status: "draft", template_id: tpl.id, version: tpl.version, settings: globalSettings(parsed.settings),
  }).select("id").single()) as { id: string };
  for (const [key, tree] of Object.entries(parsed.pages)) {
    const { type, handle } = pageKeyToParts(key);
    const pageId = await svc.ensurePage(db, storeId, theme.id, type as V2PageType, handle);
    await svc.replacePageTree(db, storeId, pageId, tree, allowHtml);
  }
  await svc.ensurePage(db, storeId, theme.id, "home", null);
  await recordVersion(db, storeId, theme.id, userId, "İlk kurulum", "İlk kurulum").catch(() => undefined);
  return theme;
}

export async function upsertReview(db: Db, storeId: string, templateId: string, userId: string, rating: number, comment: string) {
  const author = (await userName(db, userId)) || "Mağaza";
  must(await t(db, "v2_theme_template_reviews").upsert({ template_id: templateId, store_id: storeId, user_id: userId, author_name: author, rating, comment }, { onConflict: "template_id,store_id" }));
  return { ok: true };
}

// ── Kütüphane ──────────────────────────────────────────────────────

export async function listLibrary(db: Db, storeId: string) {
  const rows = must(await t(db, "v2_themes").select(LIB_COLS).eq("store_id", storeId).order("status").order("updated_at", { ascending: false })) as Array<{ id: string; name: string; status: string; template_id: string | null; version: string; installed_at: string; published_at: string | null; updated_at: string; settings: Record<string, unknown> }>;
  const ids = [...new Set(rows.map((r) => r.template_id).filter(Boolean))] as string[];
  const tpls = ids.length ? (must(await t(db, "v2_theme_templates").select("id, name, preview_image_url").in("id", ids)) as Array<{ id: string; name: string; preview_image_url: string | null }>) : [];
  const byId = new Map(tpls.map((x) => [x.id, x]));
  return rows.map((r) => ({ ...r, template: r.template_id ? byId.get(r.template_id) ?? null : null }));
}

export async function renameTheme(db: Db, storeId: string, themeId: string, name: string) {
  return svc.updateThemeSettings(db, storeId, themeId, { name });
}

export async function setArchived(db: Db, storeId: string, themeId: string, archived: boolean) {
  const theme = await svc.getTheme(db, storeId, themeId);
  if (theme.status === "active") throw new V2Error("active_theme", 409, "Aktif tema arşivlenemez; önce başka bir temayı yayınla.");
  must(await t(db, "v2_themes").update({ status: archived ? "archived" : "draft" }).eq("id", themeId).eq("store_id", storeId));
  return { ok: true };
}

export async function deleteTheme(db: Db, storeId: string, themeId: string) {
  const theme = await svc.getTheme(db, storeId, themeId);
  if (theme.status === "active") throw new V2Error("active_theme", 409, "Aktif tema silinemez; önce başka bir temayı yayınla.");
  must(await t(db, "v2_themes").delete().eq("id", themeId).eq("store_id", storeId));
  return { ok: true };
}

export async function publish(db: Db, storeId: string, themeId: string, userId: string | null) {
  const theme = await svc.publishTheme(db, storeId, themeId);
  await recordVersion(db, storeId, themeId, userId, "Yayınlandı").catch(() => undefined);
  await invalidateThemeCss(storeId, themeId);
  return theme;
}

// ── Önizleme anahtarı ──────────────────────────────────────────────

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createPreviewToken(db: Db, storeId: string, themeId: string, userId: string) {
  await svc.getTheme(db, storeId, themeId);
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const expires = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  must(await t(db, "v2_theme_preview_tokens").insert({ store_id: storeId, tenant_theme_id: themeId, token_hash: await sha256(token), expires_at: expires, created_by: userId }));
  await t(db, "v2_theme_preview_tokens").delete().eq("store_id", storeId).lt("expires_at", new Date().toISOString());
  return { token, expires_at: expires };
}

/** Anahtarlı önizleme: servis istemcisiyle çalışır; anahtar, tema ve mağaza eşleşmeli. */
export async function resolvePreview(admin: Db, slug: string, themeId: string, token: string) {
  const store = must(await t(admin, "stores").select("id, name, slug").eq("slug", slug).maybeSingle()) as { id: string; name: string; slug: string } | null;
  if (!store) throw new V2Error("not_found", 404, "Mağaza bulunamadı.");
  const row = must(await t(admin, "v2_theme_preview_tokens").select("id, expires_at").eq("token_hash", await sha256(token)).eq("store_id", store.id).eq("tenant_theme_id", themeId).maybeSingle()) as { expires_at: string } | null;
  if (!row || new Date(row.expires_at).getTime() < Date.now()) throw new V2Error("preview_expired", 403, "Önizleme bağlantısı geçersiz ya da süresi dolmuş.");
  const snap = await buildSnapshot(admin, store.id, themeId);
  const theme = await svc.getTheme(admin, store.id, themeId);
  const pages = Object.fromEntries(Object.entries(snap.pages).map(([k, v]) => [k, v.filter((s) => s.visible)]));
  return { store, theme: { id: theme.id, name: theme.name, status: theme.status }, settings: snap.settings, pages, expires_at: row.expires_at };
}

// ── Dışa / içe aktarma ─────────────────────────────────────────────

export async function exportTheme(db: Db, storeId: string, themeId: string) {
  const theme = must(await t(db, "v2_themes").select("id, name, version, template_id").eq("store_id", storeId).eq("id", themeId).maybeSingle()) as { name: string; version: string; template_id: string | null } | null;
  if (!theme) throw new V2Error("not_found", 404);
  let slug: string | null = null;
  if (theme.template_id) {
    const tpl = (await t(db, "v2_theme_templates").select("slug").eq("id", theme.template_id).maybeSingle()).data as { slug?: string } | null;
    slug = tpl?.slug ?? null;
  }
  const manifest: ThemeManifest = { format: THEME_FORMAT, name: theme.name, version: theme.version, template_slug: slug, exported_at: new Date().toISOString(), snapshot: await buildSnapshot(db, storeId, themeId) };
  const assets = must(await t(db, "v2_theme_assets").select("key, asset_type, value, url").eq("store_id", storeId).eq("tenant_theme_id", themeId)) as Array<{ key: string; asset_type: ThemeAsset["type"]; value: string | null; url: string | null }>;
  return { manifest, assets: assets.map((a) => ({ key: a.key, type: a.asset_type, value: a.value, url: a.url })), css: await getThemeCss(db, storeId, themeId) };
}

export async function importConflicts(db: Db, storeId: string, name: string) {
  const rows = must(await t(db, "v2_themes").select("id, name").eq("store_id", storeId).ilike("name", name)) as Array<{ id: string; name: string }>;
  return rows;
}

export async function importTheme(db: Db, storeId: string, manifest: ThemeManifest, assets: ThemeAsset[], userId: string, allowHtml: boolean, rename?: string) {
  const name = (rename ?? manifest.name).slice(0, 120);
  const theme = must(await t(db, "v2_themes").insert({ store_id: storeId, name, status: "draft", version: manifest.version, settings: globalSettings(manifest.snapshot.settings) }).select("id").single()) as { id: string };
  try {
    await applySnapshot(db, storeId, theme.id, manifest.snapshot as ThemeSnapshot, allowHtml);
    await svc.ensurePage(db, storeId, theme.id, "home", null);
    const rows = assets.map((a) => ({
      store_id: storeId, tenant_theme_id: theme.id, asset_type: a.type, key: a.key,
      value: a.type === "css" ? sanitizeThemeCss(a.value ?? "") : a.type === "js" ? (a.value ?? "").slice(0, 200000) : null,
      url: a.type === "image" || a.type === "font" ? a.url ?? null : null,
    }));
    if (rows.length) must(await t(db, "v2_theme_assets").insert(rows));
  } catch (cause) {
    await t(db, "v2_themes").delete().eq("id", theme.id).eq("store_id", storeId);
    throw cause;
  }
  await recordVersion(db, storeId, theme.id, userId, "Zip ile içe aktarıldı", "Zip ile içe aktarıldı").catch(() => undefined);
  return theme;
}
