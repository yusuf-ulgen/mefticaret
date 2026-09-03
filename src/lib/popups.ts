/** Animasyonlu popup + hikaye/akış paylaşım araçları için TR etiketler ve saf yardımcılar. */

export const POPUP_ANIMATIONS = ["fade", "slide-up", "zoom", "bounce", "shake"] as const;
export type PopupAnimation = (typeof POPUP_ANIMATIONS)[number];

export const POPUP_ANIMATION_LABELS: Record<PopupAnimation, string> = {
  fade: "Belirme (fade)",
  "slide-up": "Alttan kayma",
  zoom: "Yakınlaşma (zoom)",
  bounce: "Zıplama",
  shake: "Sallanma",
};

export const POPUP_POSITIONS = ["center", "bottom-right", "bottom-left", "bottom-bar", "top-bar"] as const;
export type PopupPosition = (typeof POPUP_POSITIONS)[number];

export const POPUP_POSITION_LABELS: Record<PopupPosition, string> = {
  center: "Ortada",
  "bottom-right": "Sağ alt",
  "bottom-left": "Sol alt",
  "bottom-bar": "Alt şerit",
  "top-bar": "Üst şerit",
};

export const POPUP_FREQUENCIES = ["always", "session", "once"] as const;
export type PopupFrequency = (typeof POPUP_FREQUENCIES)[number];

export const POPUP_FREQUENCY_LABELS: Record<PopupFrequency, string> = {
  always: "Her ziyarette",
  session: "Oturumda bir kez",
  once: "Yalnızca bir kez",
};

export const POPUP_PAGE_TARGETS = ["all", "home", "product", "collection", "cart"] as const;
export type PopupPageTarget = (typeof POPUP_PAGE_TARGETS)[number];

export const POPUP_PAGE_TARGET_LABELS: Record<PopupPageTarget, string> = {
  all: "Tüm sayfalar",
  home: "Yalnızca anasayfa",
  product: "Ürün sayfaları",
  collection: "Koleksiyon sayfaları",
  cart: "Sepet sayfası",
};

export type PopupDisplayRules = {
  delaySeconds: number;
  frequency: PopupFrequency;
  pages: PopupPageTarget[];
};

export const DEFAULT_DISPLAY_RULES: PopupDisplayRules = {
  delaySeconds: 3,
  frequency: "session",
  pages: ["all"],
};

export function parseDisplayRules(raw: unknown): PopupDisplayRules {
  const value = (raw ?? {}) as Partial<{ delaySeconds: number; frequency: PopupFrequency; pages: string[] }>;
  const pages = Array.isArray(value.pages)
    ? (value.pages.filter((page) => POPUP_PAGE_TARGETS.includes(page as PopupPageTarget)) as PopupPageTarget[])
    : DEFAULT_DISPLAY_RULES.pages;
  return {
    delaySeconds: Number.isFinite(value.delaySeconds) ? Number(value.delaySeconds) : DEFAULT_DISPLAY_RULES.delaySeconds,
    frequency: POPUP_FREQUENCIES.includes(value.frequency as PopupFrequency)
      ? (value.frequency as PopupFrequency)
      : DEFAULT_DISPLAY_RULES.frequency,
    pages: pages.length ? pages : DEFAULT_DISPLAY_RULES.pages,
  };
}

export function isPopupWithinSchedule(startsAt: string | null, endsAt: string | null, now = new Date()) {
  if (startsAt && new Date(startsAt).getTime() > now.getTime()) return false;
  if (endsAt && new Date(endsAt).getTime() < now.getTime()) return false;
  return true;
}

export function matchesPageTarget(pages: PopupPageTarget[], pathname: string) {
  if (!pages.length || pages.includes("all")) return true;
  return pages.some((target) => {
    switch (target) {
      case "home":
        return pathname.split("/").filter(Boolean).length <= 2;
      case "product":
        return pathname.includes("/p/");
      case "collection":
        return pathname.includes("/c/");
      case "cart":
        return pathname.includes("/cart");
      default:
        return true;
    }
  });
}

export const FEED_KINDS = ["google_shopping", "tiktok_shop", "instagram_shop", "facebook_catalog"] as const;
export type FeedKind = (typeof FEED_KINDS)[number];

export const FEED_KIND_LABELS: Record<FeedKind, string> = {
  google_shopping: "Google Shopping",
  tiktok_shop: "TikTok Shop",
  instagram_shop: "Instagram Shop",
  facebook_catalog: "Facebook Catalog",
};

export const FEED_KIND_FORMAT: Record<FeedKind, "xml" | "json" | "csv"> = {
  google_shopping: "xml",
  tiktok_shop: "csv",
  instagram_shop: "csv",
  facebook_catalog: "csv",
};

export const STORY_CHANNELS = ["instagram", "facebook", "whatsapp", "tiktok", "storefront"] as const;
export type StoryChannel = (typeof STORY_CHANNELS)[number];

export const STORY_CHANNEL_LABELS: Record<StoryChannel, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  storefront: "Vitrin",
};

export const STORY_STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  queued: "Sırada",
  published: "Yayınlandı",
  failed: "Başarısız",
};
