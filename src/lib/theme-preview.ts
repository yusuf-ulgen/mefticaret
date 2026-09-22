/**
 * Canlı önizleme (customizer) için paylaşılan tema ayarı sözleşmesi.
 * Tarayıcı ve sunucu aynı anahtar listesini ve aynı doğrulamayı kullanır;
 * önizlemeye yalnızca burada tanımlı alanlar girebilir.
 */

export const PREVIEW_KEYS = [
  "primary_color",
  "accent_color",
  "background_color",
  "font_pair",
  "radius",
  "button_style",
  "card_style",
  "layout",
  "content_width",
  "section_spacing",
  "hero_title",
  "hero_subtitle",
  "hero_cta_label",
  "announcement",
  "show_announcement",
] as const;

export type PreviewKey = (typeof PREVIEW_KEYS)[number];
export type PreviewValue = string | number | boolean;
export type PreviewSettings = Partial<Record<PreviewKey, PreviewValue>>;

export const PREVIEW_MESSAGE_TYPE = "SETTING_CHANGE";

export type PreviewMessage = {
  type: typeof PREVIEW_MESSAGE_TYPE;
  token: string;
  key: PreviewKey;
  value: PreviewValue;
};

export const BUTTON_STYLES = [
  { value: "solid", label: "Dolu" },
  { value: "outline", label: "Çerçeveli" },
  { value: "pill", label: "Yuvarlak" },
  { value: "ghost", label: "Soluk" },
  { value: "square", label: "Köşeli" },
] as const;

export const CARD_STYLES = [
  { value: "soft", label: "Yumuşak" },
  { value: "bordered", label: "Çerçeveli" },
  { value: "flat", label: "Düz" },
  { value: "shadow", label: "Gölgeli" },
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const oneOf = (value: unknown, options: readonly { value: string }[]) => {
  const text = typeof value === "string" ? value.trim() : "";
  return options.some((option) => option.value === text) ? text : null;
};

const text = (value: unknown, max: number) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed;
};

/** Tek bir ayarı doğrular; geçersizse null döner (önizlemeye yazılmaz). */
export function sanitizePreviewValue(key: PreviewKey, value: unknown): PreviewValue | null {
  switch (key) {
    case "primary_color":
    case "accent_color":
    case "background_color":
      return typeof value === "string" && HEX.test(value.trim()) ? value.trim().toLowerCase() : null;
    case "font_pair":
      return text(value, 40) || null;
    case "layout":
      return text(value, 40) || null;
    case "button_style":
      return oneOf(value, BUTTON_STYLES);
    case "card_style":
      return oneOf(value, CARD_STYLES);
    case "radius": {
      const num = Number(value);
      return Number.isFinite(num) ? Number(clamp(num, 0, 2).toFixed(2)) : null;
    }
    case "content_width": {
      const num = Number(value);
      return Number.isFinite(num) ? Math.round(clamp(num, 900, 1600)) : null;
    }
    case "section_spacing": {
      const num = Number(value);
      return Number.isFinite(num) ? Math.round(clamp(num, 16, 120)) : null;
    }
    case "hero_title":
      return text(value, 120);
    case "hero_subtitle":
      return text(value, 240);
    case "hero_cta_label":
      return text(value, 60);
    case "announcement":
      return text(value, 200);
    case "show_announcement":
      return typeof value === "boolean" ? value : null;
    default:
      return null;
  }
}

export const isPreviewKey = (key: unknown): key is PreviewKey =>
  typeof key === "string" && (PREVIEW_KEYS as readonly string[]).includes(key);

/** Veritabanından/istekten gelen ham JSON'u güvenli ayar nesnesine çevirir. */
export function parsePreviewSettings(raw: unknown): PreviewSettings {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const result: PreviewSettings = {};
  for (const key of PREVIEW_KEYS) {
    if (!(key in source)) continue;
    const value = sanitizePreviewValue(key, source[key]);
    if (value !== null) result[key] = value;
  }
  return result;
}

/** Yayınlanmış tema nesnesine geçici önizleme ayarlarını bindirir. */
export function mergePreviewSettings<T extends Record<string, unknown>>(theme: T, settings: PreviewSettings): T {
  return { ...theme, ...settings } as T;
}
