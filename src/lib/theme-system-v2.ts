import { z } from "zod";

import { V2_BLOCK_TYPES, V2_GLOBAL_GROUPS, V2_PAGE_TYPES, V2_SECTION_TYPES, type V2Section, type V2Settings } from "@/lib/theme-v2";

/**
 * Tema Sistemi v2 — paylaşılan (tarayıcı + sunucu) şema ve yardımcılar.
 * Zip içeriği (`theme.json`) ve tam tema anlık görüntüsü burada tanımlanır.
 */

export const TEMPLATE_CATEGORIES = [
  { value: "all", label: "Tümü" },
  { value: "fashion", label: "Moda" },
  { value: "electronics", label: "Elektronik" },
  { value: "food", label: "Yiyecek" },
  { value: "jewelry", label: "Mücevher & Saat" },
  { value: "beauty", label: "Güzellik" },
  { value: "home", label: "Ev & Dekor" },
  { value: "general", label: "Genel" },
  { value: "featured", label: "Öne Çıkan" },
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]["value"];
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(TEMPLATE_CATEGORIES.map((c) => [c.value, c.label]));

export const THEME_ZIP_LIMITS = { maxBytes: 5 * 1024 * 1024, maxFiles: 60, maxAssetChars: 200_000 } as const;
export const THEME_FORMAT = "mefticaret-theme@1";

const value = z.union([z.string().max(20000), z.number(), z.boolean()]);
const settings = z.record(z.string().max(60), value);
const block = z.object({ id: z.string().max(64), type: z.enum(V2_BLOCK_TYPES), visible: z.boolean(), settings });
const section = z.object({ id: z.string().max(64), type: z.enum(V2_SECTION_TYPES), visible: z.boolean(), settings, blocks: z.array(block).max(16) });
const pageKeyRe = /^(home|product|collection|cart|checkout|blog|article|custom:[a-z0-9-]{1,80})$/;

export const themeSnapshotSchema = z.object({
  settings,
  pages: z.record(z.string().regex(pageKeyRe), z.array(section).max(40)),
});
export type ThemeSnapshot = { settings: V2Settings; pages: Record<string, V2Section[]> };

export const themeAssetSchema = z.object({
  key: z.string().regex(/^[A-Za-z0-9._/-]{1,120}$/),
  type: z.enum(["css", "js", "image", "font"]),
  value: z.string().max(THEME_ZIP_LIMITS.maxAssetChars).nullish(),
  url: z.string().url().max(2000).nullish(),
});
export type ThemeAsset = z.infer<typeof themeAssetSchema>;

export const themeManifestSchema = z.object({
  format: z.literal(THEME_FORMAT),
  name: z.string().trim().min(1).max(120),
  version: z.string().max(20).default("1.0.0"),
  template_slug: z.string().max(80).nullish(),
  exported_at: z.string().max(40).optional(),
  snapshot: themeSnapshotSchema,
});
export type ThemeManifest = z.infer<typeof themeManifestSchema>;

export const pageKeyToParts = (key: string): { type: (typeof V2_PAGE_TYPES)[number]; handle: string | null } =>
  key.startsWith("custom:") ? { type: "custom", handle: key.slice(7) } : { type: key as (typeof V2_PAGE_TYPES)[number], handle: null };

export const assetTypeFor = (key: string): ThemeAsset["type"] | null => {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "css") return "css";
  if (ext === "js") return "js";
  if (["png", "jpg", "jpeg", "webp", "svg", "gif", "ico"].includes(ext)) return "image";
  if (["woff", "woff2", "ttf", "otf"].includes(ext)) return "font";
  return null;
};

const FIELD_LABELS: Record<string, string> = Object.fromEntries(V2_GLOBAL_GROUPS.flatMap((g) => g.fields.map((f) => [f.key, f.label])));

/** İki anlık görüntü arasındaki farkı insan okunur tek cümleye çevirir. */
export function summarizeChange(prev: ThemeSnapshot | null, next: ThemeSnapshot): string {
  if (!prev) return "İlk kayıt";
  const changed = Object.keys(next.settings).filter((k) => prev.settings[k] !== next.settings[k]).map((k) => FIELD_LABELS[k] ?? k);
  const parts: string[] = [];
  if (changed.length) parts.push(`${changed.slice(0, 3).join(", ")}${changed.length > 3 ? ` +${changed.length - 3}` : ""} değişti`);
  for (const key of new Set([...Object.keys(prev.pages), ...Object.keys(next.pages)])) {
    const a = prev.pages[key] ?? [];
    const b = next.pages[key] ?? [];
    if (b.length > a.length) parts.push(`${key} sayfasına ${b.length - a.length} bölüm eklendi`);
    else if (b.length < a.length) parts.push(`${key} sayfasından ${a.length - b.length} bölüm kaldırıldı`);
    else if (JSON.stringify(a) !== JSON.stringify(b)) parts.push(`${key} sayfası düzenlendi`);
  }
  return parts.join(" · ").slice(0, 300) || "Değişiklik yok";
}

/** CSS varlıklarında tehlikeli yapıları temizler (dış @import, expression, javascript:). */
export function sanitizeThemeCss(css: string): string {
  return css
    .replace(/<\/?style[^>]*>/gi, "")
    .replace(/@import[^;]*;?/gi, "")
    .replace(/expression\s*\(/gi, "(")
    .replace(/javascript:/gi, "")
    .replace(/behavior\s*:/gi, "")
    .slice(0, THEME_ZIP_LIMITS.maxAssetChars);
}

export const themeReadme = (name: string) => `# ${name}

Mefticaret tema paketi (${THEME_FORMAT}).

- \`theme.json\` — global tema ayarları ve tüm sayfaların bölüm/blok yapısı
- \`assets/\` — CSS, JS ve görsel dosyaları

## Kurulum
Mağaza paneli → Vitrin & Tema → Tema Kütüphanesi → "Zip yükle" ile bu dosyayı sürükleyip bırakın.
Tema taslak olarak eklenir; önizleyip onayladıktan sonra yayınlayabilirsiniz.
JS dosyaları güvenlik nedeniyle vitrine otomatik eklenmez.
`;
