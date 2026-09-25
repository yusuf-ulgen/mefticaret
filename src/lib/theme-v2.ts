import type { SectionField } from "@/lib/theme-sections";

/**
 * Tema Editörü v2 — Shopify benzeri SAYFA → BÖLÜM → BLOK modeli.
 * Mevcut `store_theme_sections` sisteminden tamamen bağımsızdır.
 */

export type V2Value = string | number | boolean;
export type V2Settings = Record<string, V2Value>;

export const V2_PAGE_TYPES = ["home", "product", "collection", "cart", "checkout", "blog", "article", "custom"] as const;
export type V2PageType = (typeof V2_PAGE_TYPES)[number];
export const V2_PAGE_LABELS: Record<V2PageType, string> = {
  home: "Ana sayfa",
  product: "Ürün sayfası",
  collection: "Koleksiyon",
  cart: "Sepet",
  checkout: "Ödeme",
  blog: "Blog",
  article: "Makale",
  custom: "Özel sayfa",
};

export const V2_SECTION_TYPES = [
  "hero", "featured_products", "banner", "announcement", "testimonials", "blog_posts",
  "image_with_text", "video", "custom_html", "newsletter", "collection_list", "rich_text",
] as const;
export type V2SectionType = (typeof V2_SECTION_TYPES)[number];

export const V2_BLOCK_TYPES = [
  "heading", "paragraph", "button", "image", "video", "product_card", "collection_card",
  "icon", "divider", "spacer", "custom_html", "countdown", "badge", "review_stars",
] as const;
export type V2BlockType = (typeof V2_BLOCK_TYPES)[number];

export type V2Block = { id: string; type: V2BlockType; visible: boolean; settings: V2Settings };
export type V2Section = { id: string; type: V2SectionType; visible: boolean; settings: V2Settings; blocks: V2Block[] };
export type V2Snapshot = { settings: V2Settings; pages: Record<string, V2Section[]> };

export type V2Definition = {
  label: string;
  description: string;
  defaults: V2Settings;
  fields: SectionField[];
};
export type V2SectionDefinition = V2Definition & { blocks: V2BlockType[]; maxBlocks: number };

const opt = (...pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));
const ALIGN = opt(["left", "Sol"], ["center", "Orta"], ["right", "Sağ"]);
const COLS = opt(["2", "2"], ["3", "3"], ["4", "4"]);
const RATIO = opt(["square", "Kare"], ["portrait", "Dikey"], ["landscape", "Yatay"]);
const f = (key: string, label: string, kind: SectionField["kind"], extra: Partial<SectionField> = {}): SectionField => ({ key, label, kind, ...extra });

const CONTENT_BLOCKS: V2BlockType[] = ["heading", "paragraph", "button", "image", "badge", "countdown", "divider", "spacer", "icon", "review_stars", "custom_html"];

export const V2_SECTIONS: Record<V2SectionType, V2SectionDefinition> = {
  hero: {
    label: "Hero", description: "Büyük karşılama alanı: görsel/video/renk arka plan.",
    defaults: { background_type: "color", background_url: "", bg_color: "", overlay_opacity: 30, height: "medium", content_position: "center", text_color: "", padding: 48 },
    fields: [
      f("background_type", "Arka plan", "select", { options: opt(["image", "Görsel"], ["video", "Video"], ["color", "Renk"]) }),
      f("background_url", "Arka plan görseli / video adresi", "text"),
      f("bg_color", "Arka plan rengi", "text"),
      f("overlay_opacity", "Karartma (%)", "number", { min: 0, max: 90 }),
      f("height", "Yükseklik", "select", { options: opt(["small", "Küçük"], ["medium", "Orta"], ["large", "Büyük"], ["full", "Tam ekran"]) }),
      f("content_position", "İçerik konumu", "select", { options: ALIGN }),
      f("text_color", "Metin rengi", "text"),
      f("padding", "İç boşluk (px)", "number", { min: 0, max: 160 }),
    ],
    blocks: CONTENT_BLOCKS, maxBlocks: 12,
  },
  featured_products: {
    label: "Öne çıkan ürünler", description: "Koleksiyondan ya da en yeni ürünlerden ızgara.",
    defaults: { title: "Öne çıkan ürünler", collection_id: "", products_count: 4, columns: "4", show_price: true, show_rating: false, show_add_to_cart: true },
    fields: [
      f("title", "Başlık", "text"),
      f("collection_id", "Koleksiyon", "text", { help: "Boşsa en yeni ürünler gösterilir." }),
      f("products_count", "Ürün sayısı", "number", { min: 2, max: 12 }),
      f("columns", "Sütun", "select", { options: COLS }),
      f("show_price", "Fiyatı göster", "boolean"),
      f("show_rating", "Puanı göster", "boolean"),
      f("show_add_to_cart", "Sepete ekle düğmesi", "boolean"),
    ],
    blocks: ["product_card", "heading"], maxBlocks: 12,
  },
  banner: {
    label: "Banner", description: "Görsel üzerine kısa metin ve buton.",
    defaults: { image_url: "", bg_color: "", text_color: "", height: "medium", content_position: "center" },
    fields: [
      f("image_url", "Görsel", "text"),
      f("bg_color", "Arka plan rengi", "text"),
      f("text_color", "Metin rengi", "text"),
      f("height", "Yükseklik", "select", { options: opt(["small", "Küçük"], ["medium", "Orta"], ["large", "Büyük"]) }),
      f("content_position", "İçerik konumu", "select", { options: ALIGN }),
    ],
    blocks: CONTENT_BLOCKS, maxBlocks: 8,
  },
  announcement: {
    label: "Duyuru çubuğu", description: "Sayfa üstünde ince duyuru şeridi.",
    defaults: { text: "Tüm siparişlerde ücretsiz kargo", text_color: "", bg_color: "", link_url: "", is_dismissible: true, show_on: "all" },
    fields: [
      f("text", "Metin", "text"),
      f("text_color", "Metin rengi", "text"),
      f("bg_color", "Arka plan rengi", "text"),
      f("link_url", "Bağlantı", "text"),
      f("is_dismissible", "Kapatılabilir", "boolean"),
      f("show_on", "Gösterim", "select", { options: opt(["all", "Tümü"], ["mobile", "Mobil"], ["desktop", "Masaüstü"]) }),
    ],
    blocks: [], maxBlocks: 0,
  },
  testimonials: {
    label: "Müşteri yorumları", description: "Yorum kartları ızgara ya da kaydırmalı.",
    defaults: { title: "Müşterilerimiz ne diyor", layout: "grid", show_stars: true, show_avatar: true, bg_color: "", items: "Harika ürünler, hızlı kargo.|Ayşe K.\nÇok memnun kaldım.|Mehmet T.\nKalite mükemmel.|Zeynep A." },
    fields: [
      f("title", "Başlık", "text"),
      f("layout", "Düzen", "select", { options: opt(["grid", "Izgara"], ["carousel", "Kaydırmalı"]) }),
      f("show_stars", "Yıldızları göster", "boolean"),
      f("show_avatar", "Avatar göster", "boolean"),
      f("bg_color", "Arka plan rengi", "text"),
      f("items", "Yorumlar", "lines", { help: "Her satır: yorum|isim" }),
    ],
    blocks: [], maxBlocks: 0,
  },
  blog_posts: {
    label: "Blog yazıları", description: "Son blog yazıları.",
    defaults: { title: "Blogdan", count: 3 },
    fields: [f("title", "Başlık", "text"), f("count", "Yazı sayısı", "number", { min: 1, max: 6 })],
    blocks: [], maxBlocks: 0,
  },
  image_with_text: {
    label: "Görsel ve metin", description: "Yan yana görsel ve içerik.",
    defaults: { image_url: "", image_position: "left", image_ratio: "square", content_width: "medium" },
    fields: [
      f("image_url", "Görsel", "text"),
      f("image_position", "Görsel konumu", "select", { options: opt(["left", "Sol"], ["right", "Sağ"]) }),
      f("image_ratio", "Görsel oranı", "select", { options: RATIO }),
      f("content_width", "İçerik genişliği", "select", { options: opt(["narrow", "Dar"], ["medium", "Orta"], ["wide", "Geniş"]) }),
    ],
    blocks: CONTENT_BLOCKS, maxBlocks: 8,
  },
  video: {
    label: "Video", description: "YouTube/Vimeo veya mp4 video.",
    defaults: { title: "", video_url: "", autoplay: false },
    fields: [f("title", "Başlık", "text"), f("video_url", "Video adresi", "text"), f("autoplay", "Otomatik oynat (sessiz)", "boolean")],
    blocks: [], maxBlocks: 0,
  },
  custom_html: {
    label: "Özel HTML", description: "Temizlenmiş özel HTML (yalnız izinli mağazalar).",
    defaults: { html: "<p>Özel içerik</p>" },
    fields: [f("html", "HTML", "code", { help: "Script ve olay öznitelikleri otomatik temizlenir." })],
    blocks: [], maxBlocks: 0,
  },
  newsletter: {
    label: "Bülten", description: "E-posta kayıt formu.",
    defaults: { title: "Bültene katılın", description: "Kampanyalardan ilk siz haberdar olun.", placeholder_text: "E-posta adresiniz", button_text: "Kaydol", bg_color: "", layout: "inline" },
    fields: [
      f("title", "Başlık", "text"), f("description", "Açıklama", "textarea"),
      f("placeholder_text", "Alan yazısı", "text"), f("button_text", "Düğme metni", "text"),
      f("bg_color", "Arka plan rengi", "text"),
      f("layout", "Düzen", "select", { options: opt(["inline", "Yan yana"], ["stacked", "Alt alta"]) }),
    ],
    blocks: [], maxBlocks: 0,
  },
  collection_list: {
    label: "Koleksiyon listesi", description: "Seçili koleksiyon kartları.",
    defaults: { title: "Koleksiyonlar", collections: "", columns: "3", image_ratio: "square" },
    fields: [
      f("title", "Başlık", "text"),
      f("collections", "Koleksiyonlar", "text", { help: "Boşsa ilk koleksiyonlar gösterilir." }),
      f("columns", "Sütun", "select", { options: COLS }),
      f("image_ratio", "Görsel oranı", "select", { options: RATIO }),
    ],
    blocks: ["collection_card"], maxBlocks: 12,
  },
  rich_text: {
    label: "Zengin metin", description: "Başlık, paragraf ve düğmelerden oluşan serbest alan.",
    defaults: { bg_color: "", content_position: "center", max_width: 720 },
    fields: [
      f("bg_color", "Arka plan rengi", "text"),
      f("content_position", "Hizalama", "select", { options: ALIGN }),
      f("max_width", "Maks. genişlik (px)", "number", { min: 320, max: 1400 }),
    ],
    blocks: CONTENT_BLOCKS, maxBlocks: 16,
  },
};

export const V2_BLOCKS: Record<V2BlockType, V2Definition> = {
  heading: {
    label: "Başlık", description: "Başlık metni",
    defaults: { text: "Başlık", tag: "h2", font_size: 0, font_weight: "700", color: "", alignment: "inherit", margin_top: 0, margin_bottom: 12 },
    fields: [
      f("text", "Metin", "text"),
      f("tag", "Etiket", "select", { options: opt(["h1", "H1"], ["h2", "H2"], ["h3", "H3"], ["h4", "H4"]) }),
      f("font_size", "Yazı boyutu (0 = tema)", "number", { min: 0, max: 96 }),
      f("font_weight", "Kalınlık", "select", { options: opt(["400", "Normal"], ["600", "Yarı kalın"], ["700", "Kalın"], ["800", "Çok kalın"]) }),
      f("color", "Renk", "text"),
      f("alignment", "Hizalama", "select", { options: [{ value: "inherit", label: "Bölüm" }, ...ALIGN] }),
      f("margin_top", "Üst boşluk", "number", { min: 0, max: 80 }),
      f("margin_bottom", "Alt boşluk", "number", { min: 0, max: 80 }),
    ],
  },
  paragraph: {
    label: "Paragraf", description: "Zengin metin",
    defaults: { richtext: "<p>Metninizi buraya yazın.</p>", font_size: 16, color: "", alignment: "inherit", max_width: 0 },
    fields: [
      f("richtext", "Metin", "textarea"),
      f("font_size", "Yazı boyutu", "number", { min: 10, max: 32 }),
      f("color", "Renk", "text"),
      f("alignment", "Hizalama", "select", { options: [{ value: "inherit", label: "Bölüm" }, ...ALIGN] }),
      f("max_width", "Maks. genişlik (0 = sınırsız)", "number", { min: 0, max: 1200 }),
    ],
  },
  button: {
    label: "Düğme", description: "Bağlantı düğmesi",
    defaults: { text: "Alışverişe başla", link_url: "", style: "primary", size: "medium", full_width: false, icon: "" },
    fields: [
      f("text", "Metin", "text"), f("link_url", "Bağlantı", "text"),
      f("style", "Stil", "select", { options: opt(["primary", "Ana"], ["secondary", "İkincil"], ["outline", "Çerçeve"], ["ghost", "Sade"]) }),
      f("size", "Boyut", "select", { options: opt(["small", "Küçük"], ["medium", "Orta"], ["large", "Büyük"]) }),
      f("full_width", "Tam genişlik", "boolean"),
      f("icon", "Simge (emoji, isteğe bağlı)", "text"),
    ],
  },
  image: {
    label: "Görsel", description: "Tek görsel",
    defaults: { src_url: "", alt_text: "", width: "full", fixed_width: 320, border_radius: 8, link_url: "", lazy_load: true },
    fields: [
      f("src_url", "Görsel", "text"), f("alt_text", "Alternatif metin", "text"),
      f("width", "Genişlik", "select", { options: opt(["full", "Tam"], ["auto", "Otomatik"], ["fixed", "Sabit"]) }),
      f("fixed_width", "Sabit genişlik (px)", "number", { min: 40, max: 1600 }),
      f("border_radius", "Köşe yuvarlama", "number", { min: 0, max: 48 }),
      f("link_url", "Bağlantı", "text"), f("lazy_load", "Tembel yükleme", "boolean"),
    ],
  },
  video: {
    label: "Video", description: "Gömülü video",
    defaults: { video_url: "" },
    fields: [f("video_url", "Video adresi", "text")],
  },
  product_card: {
    label: "Ürün kartı", description: "Tek ürün kartı",
    defaults: { product_id: "", show_vendor: false, show_rating: false, show_compare_price: true, show_badge: true, image_ratio: "square" },
    fields: [
      f("product_id", "Ürün", "text", { help: "Boşsa bölümdeki sıradaki ürün kullanılır." }),
      f("show_vendor", "Markayı göster", "boolean"), f("show_rating", "Puanı göster", "boolean"),
      f("show_compare_price", "Eski fiyatı göster", "boolean"), f("show_badge", "İndirim rozeti", "boolean"),
      f("image_ratio", "Görsel oranı", "select", { options: opt(["square", "Kare"], ["portrait", "Dikey"]) }),
    ],
  },
  collection_card: {
    label: "Koleksiyon kartı", description: "Tek koleksiyon",
    defaults: { collection_id: "", image_url: "" },
    fields: [f("collection_id", "Koleksiyon", "text"), f("image_url", "Görsel", "text")],
  },
  icon: {
    label: "Simge", description: "Emoji ya da kısa simge + metin",
    defaults: { icon: "🚚", text: "Hızlı kargo", size: 32 },
    fields: [f("icon", "Simge", "text"), f("text", "Metin", "text"), f("size", "Boyut", "number", { min: 12, max: 96 })],
  },
  divider: {
    label: "Ayırıcı", description: "Yatay çizgi",
    defaults: { color: "", thickness: 1 },
    fields: [f("color", "Renk", "text"), f("thickness", "Kalınlık", "number", { min: 1, max: 8 })],
  },
  spacer: {
    label: "Boşluk", description: "Dikey boşluk",
    defaults: { height: 32 },
    fields: [f("height", "Yükseklik (px)", "number", { min: 4, max: 200 })],
  },
  custom_html: {
    label: "Özel HTML", description: "Temizlenmiş HTML",
    defaults: { html: "<p>Özel içerik</p>" },
    fields: [f("html", "HTML", "code")],
  },
  countdown: {
    label: "Geri sayım", description: "Kampanya sayacı",
    defaults: { end_date: "", end_time: "23:59", style: "box", label_days: "Gün", label_hours: "Saat", label_minutes: "Dakika", label_seconds: "Saniye", show_after_zero: "message", zero_message: "Kampanya sona erdi" },
    fields: [
      f("end_date", "Bitiş tarihi (YYYY-AA-GG)", "text", { placeholder: "2026-12-31" }),
      f("end_time", "Bitiş saati (SS:DD)", "text"),
      f("style", "Stil", "select", { options: opt(["minimal", "Minimal"], ["box", "Kutu"], ["banner", "Şerit"]) }),
      f("label_days", "Gün etiketi", "text"), f("label_hours", "Saat etiketi", "text"),
      f("label_minutes", "Dakika etiketi", "text"), f("label_seconds", "Saniye etiketi", "text"),
      f("show_after_zero", "Süre bitince", "select", { options: opt(["hide", "Gizle"], ["message", "Mesaj göster"]) }),
      f("zero_message", "Bitiş mesajı", "text"),
    ],
  },
  badge: {
    label: "Rozet", description: "Küçük etiket",
    defaults: { text: "YENİ", text_color: "", bg_color: "", position: "top-left", style: "pill" },
    fields: [
      f("text", "Metin", "text"), f("text_color", "Metin rengi", "text"), f("bg_color", "Arka plan rengi", "text"),
      f("position", "Konum", "select", { options: opt(["top-left", "Sol üst"], ["top-right", "Sağ üst"]) }),
      f("style", "Stil", "select", { options: opt(["rounded", "Yuvarlak"], ["square", "Kare"], ["pill", "Hap"]) }),
    ],
  },
  review_stars: {
    label: "Yıldız puanı", description: "Puan göstergesi",
    defaults: { rating: 5, count_text: "120+ değerlendirme" },
    fields: [f("rating", "Puan", "number", { min: 0, max: 5 }), f("count_text", "Metin", "text")],
  },
};

/** Global tema ayarları (renk/tipografi/buton/düzen). */
export const V2_GLOBAL_DEFAULTS: V2Settings = {
  color_primary: "#111111", color_secondary: "#6b7280", color_background: "#ffffff", color_text: "#111111",
  color_error: "#dc2626", color_success: "#16a34a",
  font_heading: "Inter", font_body: "Inter",
  h1_size: 48, h2_size: 36, h3_size: 28, h4_size: 22, h5_size: 18, h6_size: 16, p_size: 16,
  button_radius: 999, button_padding: 12, button_hover: "darken",
  max_width: 1200, grid_gap: 24, section_padding: 64,
};

export const V2_GLOBAL_GROUPS: { label: string; fields: SectionField[] }[] = [
  { label: "Renkler", fields: [
    f("color_primary", "Ana renk", "text"), f("color_secondary", "İkincil renk", "text"),
    f("color_background", "Arka plan", "text"), f("color_text", "Metin", "text"),
    f("color_error", "Hata rengi", "text"), f("color_success", "Başarı rengi", "text"),
  ] },
  { label: "Tipografi", fields: [
    f("font_heading", "Başlık fontu", "text"), f("font_body", "Gövde fontu", "text"),
    ...(["h1", "h2", "h3", "h4", "h5", "h6", "p"] as const).map((t) => f(`${t}_size`, `${t.toUpperCase()} boyutu`, "number", { min: 10, max: 96 })),
  ] },
  { label: "Butonlar", fields: [
    f("button_radius", "Köşe yuvarlama", "number", { min: 0, max: 999 }),
    f("button_padding", "İç boşluk", "number", { min: 4, max: 32 }),
    f("button_hover", "Hover efekti", "select", { options: opt(["darken", "Koyulaş"], ["lift", "Yüksel"], ["none", "Yok"]) }),
  ] },
  { label: "Düzen", fields: [
    f("max_width", "Maks. içerik genişliği", "number", { min: 720, max: 1920 }),
    f("grid_gap", "Izgara boşluğu", "number", { min: 0, max: 64 }),
    f("section_padding", "Bölüm dikey boşluğu", "number", { min: 0, max: 160 }),
  ] },
];

/** Tanımlı alanlar dışındaki anahtarları atar, tipleri varsayılana göre zorlar. */
export function normalizeV2Settings(defaults: V2Settings, input: Record<string, unknown> | null | undefined): V2Settings {
  const out: V2Settings = { ...defaults };
  for (const [key, value] of Object.entries(input ?? {})) {
    if (!(key in defaults)) continue;
    const fallback = defaults[key];
    if (typeof fallback === "number") {
      const n = Number(value);
      out[key] = Number.isFinite(n) ? n : fallback;
    } else if (typeof fallback === "boolean") out[key] = value === true || value === "true";
    else out[key] = String(value ?? "").slice(0, 20000);
  }
  return out;
}

export const sectionSettings = (type: V2SectionType, input?: Record<string, unknown> | null) =>
  normalizeV2Settings(V2_SECTIONS[type].defaults, input);
export const blockSettings = (type: V2BlockType, input?: Record<string, unknown> | null) =>
  normalizeV2Settings(V2_BLOCKS[type].defaults, input);
export const globalSettings = (input?: Record<string, unknown> | null) => normalizeV2Settings(V2_GLOBAL_DEFAULTS, input);

const HEX = /^#[0-9a-f]{3,8}$/i;
const safeColor = (v: V2Value | undefined, fallback: string) => (typeof v === "string" && HEX.test(v) ? v : fallback);
const safeFont = (v: V2Value | undefined) => String(v ?? "Inter").replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 60) || "Inter";

/** Global ayarlardan CSS değişkenleri üretir (değerler doğrulanır). */
export function v2CssVars(settings: V2Settings, scope = ".v2-theme"): string {
  const s = globalSettings(settings);
  const n = (k: string) => Number(s[k]) || 0;
  const vars = [
    `--color-primary:${safeColor(s.color_primary, "#111111")}`,
    `--color-secondary:${safeColor(s.color_secondary, "#6b7280")}`,
    `--color-background:${safeColor(s.color_background, "#ffffff")}`,
    `--color-text:${safeColor(s.color_text, "#111111")}`,
    `--color-error:${safeColor(s.color_error, "#dc2626")}`,
    `--color-success:${safeColor(s.color_success, "#16a34a")}`,
    `--font-heading:'${safeFont(s.font_heading)}',system-ui,sans-serif`,
    `--font-body:'${safeFont(s.font_body)}',system-ui,sans-serif`,
    ...["h1", "h2", "h3", "h4", "h5", "h6", "p"].map((t) => `--size-${t}:${n(`${t}_size`)}px`),
    `--border-radius:${n("button_radius")}px`,
    `--button-padding:${n("button_padding")}px`,
    `--max-width:${n("max_width")}px`,
    `--grid-gap:${n("grid_gap")}px`,
    `--section-padding:${n("section_padding")}px`,
  ];
  const hover = s.button_hover === "lift" ? "transform:translateY(-2px);" : s.button_hover === "darken" ? "filter:brightness(.9);" : "";
  return `${scope}{${vars.join(";")};background:var(--color-background);color:var(--color-text);font-family:var(--font-body);font-size:var(--size-p)}` +
    `${scope} h1,${scope} h2,${scope} h3,${scope} h4,${scope} h5,${scope} h6{font-family:var(--font-heading);margin:0;line-height:1.15}` +
    ["h1", "h2", "h3", "h4", "h5", "h6"].map((t) => `${scope} ${t}{font-size:var(--size-${t})}`).join("") +
    `${scope} .v2-btn{transition:all .15s}${scope} .v2-btn:hover{${hover}}`;
}

/** Güvenilir olmayan HTML için sunucu tarafı ön temizlik (render'da ayrıca DOMPurify çalışır). */
export function stripDangerousHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, "")
    .replace(/<\s*(script|iframe|object|embed|link|meta|base)[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')?\s*(javascript|vbscript|data):/gi, "$1=$2#")
    .slice(0, 20000);
}

/** Preset yapısını editör düğümlerine çevirir. */
export function presetToPages(structure: unknown, newId: () => string): { settings: V2Settings; pages: Record<string, V2Section[]> } {
  const root = (structure ?? {}) as { settings?: Record<string, unknown>; pages?: Record<string, unknown[]> };
  const pages: Record<string, V2Section[]> = {};
  for (const [key, list] of Object.entries(root.pages ?? {})) {
    pages[key] = (Array.isArray(list) ? list : []).flatMap((raw) => {
      const node = raw as { type?: string; settings?: Record<string, unknown>; blocks?: unknown[] };
      if (!V2_SECTION_TYPES.includes(node.type as V2SectionType)) return [];
      const type = node.type as V2SectionType;
      return [{
        id: newId(), type, visible: true, settings: sectionSettings(type, node.settings),
        blocks: (node.blocks ?? []).flatMap((b) => {
          const block = b as { type?: string; settings?: Record<string, unknown> };
          if (!V2_BLOCK_TYPES.includes(block.type as V2BlockType)) return [];
          const bt = block.type as V2BlockType;
          return [{ id: newId(), type: bt, visible: true, settings: blockSettings(bt, block.settings) }];
        }),
      }];
    });
  }
  return { settings: globalSettings(root.settings), pages };
}

/** Sayfa anahtarı: tip + (özel sayfa için) handle. */
export const pageKey = (type: V2PageType, handle?: string | null) => (type === "custom" && handle ? `custom:${handle}` : type);

/** Geri al / yinele — en fazla 50 adım. */
export type History<T> = { past: T[]; present: T; future: T[] };
export const HISTORY_LIMIT = 50;
export function historyInit<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}
export function historyPush<T>(h: History<T>, next: T): History<T> {
  if (Object.is(next, h.present)) return h;
  const past = [...h.past, h.present];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { past, present: next, future: [] };
}
export function historyUndo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  const past = h.past.slice(0, -1);
  return { past, present: h.past[h.past.length - 1] as T, future: [h.present, ...h.future] };
}
export function historyRedo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  const [next, ...future] = h.future;
  return { past: [...h.past, h.present], present: next as T, future };
}
