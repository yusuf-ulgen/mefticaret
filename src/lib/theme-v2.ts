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

/** Global tema ayarları: renkler, tipografi, düzen, butonlar, görseller, koyu mod, logo. */
export const V2_FONTS = ["Inter", "Geist", "Manrope", "DM Sans", "Plus Jakarta Sans", "Outfit", "Sora", "Work Sans", "Poppins", "Playfair Display", "Cormorant Garamond", "Lora", "Libre Baskerville", "Space Grotesk", "Bebas Neue"] as const;
export const V2_MONO_FONTS = ["JetBrains Mono", "Space Mono", "IBM Plex Mono", "Fira Code"] as const;

export const V2_GLOBAL_DEFAULTS: V2Settings = {
  color_primary: "#111111", color_secondary: "#6b7280", color_background: "#ffffff", color_surface: "#f9fafb",
  color_text: "#111111", color_text_muted: "#6b7280", color_border: "#e5e7eb",
  color_error: "#dc2626", color_success: "#16a34a",
  font_heading: "Inter", font_body: "Inter", font_mono: "JetBrains Mono",
  font_size_base: 16, line_height_base: 1.5, font_weight_heading: "700",
  h1_size: 48, h2_size: 36, h3_size: 28, h4_size: 22, h5_size: 18, h6_size: 16, p_size: 16,
  max_width: 1200, content_padding: 16, section_padding: 64, grid_gap: 24, border_radius: 8,
  button_bg: "", button_text: "#ffffff", button_radius: 999, button_padding: 12, button_padding_y: 10,
  button_hover: "darken", button_transition: "150",
  image_ratio: "square", image_fit: "cover", image_placeholder: "color",
  dark_mode: "off", dark_color_background: "#0f172a", dark_color_surface: "#1e293b", dark_color_text: "#f1f5f9", dark_color_border: "#334155",
  logo_url: "", favicon_url: "", logo_width: 140, logo_position: "left",
};

const FONT_OPTS = V2_FONTS.map((x) => ({ value: x, label: x }));
export const V2_GLOBAL_GROUPS: { id: string; label: string; flag?: string; fields: SectionField[] }[] = [
  { id: "colors", label: "Renkler", fields: [
    f("color_primary", "Ana renk", "text"), f("color_secondary", "İkincil renk", "text"),
    f("color_background", "Arka plan", "text"), f("color_surface", "Yüzey", "text"),
    f("color_text", "Metin", "text"), f("color_text_muted", "Soluk metin", "text"),
    f("color_error", "Hata", "text"), f("color_success", "Başarı", "text"), f("color_border", "Kenarlık", "text"),
  ] },
  { id: "typography", label: "Tipografi", fields: [
    f("font_heading", "Başlık fontu", "select", { options: FONT_OPTS }), f("font_body", "Gövde fontu", "select", { options: FONT_OPTS }),
    f("font_mono", "Mono font", "select", { options: V2_MONO_FONTS.map((x) => ({ value: x, label: x })) }),
    f("font_size_base", "Temel boyut (px)", "number", { min: 12, max: 22 }),
    f("line_height_base", "Satır yüksekliği", "number", { min: 1, max: 2.2 }),
    f("font_weight_heading", "Başlık ağırlığı", "select", { options: opt(["400", "400"], ["500", "500"], ["600", "600"], ["700", "700"], ["800", "800"]) }),
    ...(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((t) => f(`${t}_size`, `${t.toUpperCase()} boyutu`, "number", { min: 10, max: 96 })),
  ] },
  { id: "layout", label: "Düzen", fields: [
    f("max_width", "Maks. genişlik (px)", "number", { min: 720, max: 1920 }),
    f("content_padding", "İçerik boşluğu (px)", "number", { min: 0, max: 64 }),
    f("section_padding", "Bölüm aralığı (px)", "number", { min: 0, max: 160 }),
    f("grid_gap", "Izgara boşluğu (px)", "number", { min: 0, max: 64 }),
    f("border_radius", "Köşe yuvarlama (px)", "number", { min: 0, max: 32 }),
  ] },
  { id: "buttons", label: "Butonlar", fields: [
    f("button_bg", "Buton rengi (boşsa ana renk)", "text"), f("button_text", "Buton yazı rengi", "text"),
    f("button_radius", "Köşe yuvarlama", "number", { min: 0, max: 999 }),
    f("button_padding", "Yatay boşluk", "number", { min: 4, max: 40 }),
    f("button_padding_y", "Dikey boşluk", "number", { min: 4, max: 24 }),
    f("button_hover", "Hover efekti", "select", { options: opt(["darken", "Koyulaş"], ["lighten", "Açıl"], ["scale", "Büyü"], ["lift", "Yüksel"], ["none", "Yok"]) }),
    f("button_transition", "Geçiş süresi", "select", { options: opt(["150", "150 ms"], ["300", "300 ms"], ["500", "500 ms"]) }),
  ] },
  { id: "images", label: "Görseller", fields: [
    f("image_ratio", "En-boy oranı", "select", { options: RATIO }),
    f("image_fit", "Sığdırma", "select", { options: opt(["cover", "Kapla"], ["contain", "İçine sığdır"], ["fill", "Doldur"]) }),
    f("image_placeholder", "Yer tutucu", "select", { options: opt(["blur", "Bulanık"], ["color", "Renk"], ["skeleton", "İskelet"]) }),
  ] },
  { id: "dark", label: "Koyu mod", flag: "v2_dark_mode", fields: [
    f("dark_mode", "Koyu mod", "select", { options: opt(["off", "Kapalı"], ["on", "Her zaman açık"], ["auto", "Sistem tercihine göre"]) }),
    f("dark_color_background", "Koyu arka plan", "text"), f("dark_color_surface", "Koyu yüzey", "text"),
    f("dark_color_text", "Koyu metin", "text"), f("dark_color_border", "Koyu kenarlık", "text"),
  ] },
  { id: "brand", label: "Logo & Favicon", fields: [
    f("logo_url", "Logo (SVG/PNG)", "text"), f("favicon_url", "Favicon", "text"),
    f("logo_width", "Logo genişliği (px)", "number", { min: 40, max: 400 }),
    f("logo_position", "Logo konumu", "select", { options: opt(["left", "Sol"], ["center", "Orta"]) }),
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
export const isHexColor = (v: unknown) => typeof v === "string" && HEX.test(v);
const safeColor = (v: V2Value | undefined, fallback: string) => (typeof v === "string" && HEX.test(v) ? v : fallback);
const safeFont = (v: V2Value | undefined, fallback = "Inter") => String(v ?? fallback).replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 60) || fallback;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** #rrggbb rengini yüzde kadar koyulaştırır (negatif = açar). */
export function shadeHex(hex: string, pct: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return hex;
  const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const out = ch.map((c) => clamp(Math.round(pct >= 0 ? c * (1 - pct / 100) : c + (255 - c) * (-pct / 100)), 0, 255));
  return `#${out.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Koyu mod ayarının plan bayrağına göre etkin değeri. */
export const darkModeOf = (s: V2Settings): "off" | "on" | "auto" => (s["dark_mode"] === "on" || s["dark_mode"] === "auto" ? s["dark_mode"] : "off");

/** Global ayarlardan CSS değişkenleri üretir (değerler doğrulanır). */
export function v2CssVars(settings: V2Settings, scope = ".v2-theme"): string {
  const s = globalSettings(settings);
  const n = (k: string) => Number(s[k]) || 0;
  const primary = safeColor(s["color_primary"], "#111111");
  const radius = clamp(n("border_radius"), 0, 32);
  const btnBg = safeColor(s["button_bg"], primary);
  const transition = ["150", "300", "500"].includes(String(s["button_transition"])) ? String(s["button_transition"]) : "150";
  const vars = [
    `--color-primary:${primary}`,
    `--color-primary-hover:${shadeHex(primary, 12)}`,
    `--color-secondary:${safeColor(s["color_secondary"], "#6b7280")}`,
    `--color-background:${safeColor(s["color_background"], "#ffffff")}`,
    `--color-surface:${safeColor(s["color_surface"], "#f9fafb")}`,
    `--color-text:${safeColor(s["color_text"], "#111111")}`,
    `--color-text-muted:${safeColor(s["color_text_muted"], "#6b7280")}`,
    `--color-border:${safeColor(s["color_border"], "#e5e7eb")}`,
    `--color-error:${safeColor(s["color_error"], "#dc2626")}`,
    `--color-success:${safeColor(s["color_success"], "#16a34a")}`,
    `--font-heading:'${safeFont(s["font_heading"])}',system-ui,sans-serif`,
    `--font-body:'${safeFont(s["font_body"])}',system-ui,sans-serif`,
    `--font-mono:'${safeFont(s["font_mono"], "JetBrains Mono")}',ui-monospace,monospace`,
    `--font-size-base:${clamp(n("font_size_base"), 12, 22)}px`,
    `--line-height-base:${clamp(Number(s["line_height_base"]) || 1.5, 1, 2.2)}`,
    `--font-weight-heading:${/^[4-8]00$/.test(String(s["font_weight_heading"])) ? s["font_weight_heading"] : "700"}`,
    ...["h1", "h2", "h3", "h4", "h5", "h6", "p"].map((t) => `--size-${t}:${n(`${t}_size`)}px`),
    `--max-width:${n("max_width")}px`,
    `--content-padding:${clamp(n("content_padding"), 0, 64)}px`,
    `--section-spacing:${n("section_padding")}px`,
    `--section-padding:${n("section_padding")}px`,
    `--grid-gap:${n("grid_gap")}px`,
    `--border-radius:${radius}px`,
    `--border-radius-sm:${Math.round(radius / 2)}px`,
    `--border-radius-lg:${radius * 2}px`,
    `--btn-bg:${btnBg}`,
    `--btn-text:${safeColor(s["button_text"], "#ffffff")}`,
    `--btn-border-radius:${n("button_radius")}px`,
    `--btn-padding-x:${n("button_padding")}px`,
    `--btn-padding-y:${n("button_padding_y")}px`,
    `--btn-transition:${transition}ms ease`,
    `--button-padding:${n("button_padding")}px`,
    `--image-fit:${["cover", "contain", "fill"].includes(String(s["image_fit"])) ? s["image_fit"] : "cover"}`,
    `--image-ratio:${s["image_ratio"] === "portrait" ? "3/4" : s["image_ratio"] === "landscape" ? "4/3" : "1/1"}`,
    `--logo-width:${clamp(n("logo_width"), 40, 400)}px`,
  ];
  const dark = [
    `--color-background:${safeColor(s["dark_color_background"], "#0f172a")}`,
    `--color-surface:${safeColor(s["dark_color_surface"], "#1e293b")}`,
    `--color-text:${safeColor(s["dark_color_text"], "#f1f5f9")}`,
    `--color-border:${safeColor(s["dark_color_border"], "#334155")}`,
  ].join(";");
  const mode = darkModeOf(s);
  const darkCss = mode === "on"
    ? `${scope}[data-theme="dark"],${scope}{${dark}}`
    : mode === "auto" ? `${scope}[data-theme="dark"]{${dark}}@media (prefers-color-scheme:dark){${scope}{${dark}}}` : "";
  const hover = s["button_hover"] === "lift" ? "transform:translateY(-2px);"
    : s["button_hover"] === "scale" ? "transform:scale(1.03);"
    : s["button_hover"] === "lighten" ? "filter:brightness(1.1);"
    : s["button_hover"] === "darken" ? "filter:brightness(.9);" : "";
  return `${scope}{${vars.join(";")};background:var(--color-background);color:var(--color-text);font-family:var(--font-body);font-size:var(--font-size-base);line-height:var(--line-height-base)}` +
    darkCss +
    `${scope} h1,${scope} h2,${scope} h3,${scope} h4,${scope} h5,${scope} h6{font-family:var(--font-heading);font-weight:var(--font-weight-heading);margin:0;line-height:1.15}` +
    ["h1", "h2", "h3", "h4", "h5", "h6"].map((t) => `${scope} ${t}{font-size:var(--size-${t})}`).join("") +
    `${scope} code,${scope} pre{font-family:var(--font-mono)}` +
    `${scope} .v2-btn{transition:all var(--btn-transition)}${scope} .v2-btn:hover{${hover}}`;
}

/** Bağımsız `:root` stil dosyası (API `/css` ucu ve dışa aktarma için). */
export function v2RootCss(settings: V2Settings): string {
  return v2CssVars(settings, ":root").replace(/:root\[data-theme="dark"\]/g, '[data-theme="dark"]');
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
