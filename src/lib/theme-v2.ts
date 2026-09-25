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
  "marquee", "flash_sale", "trust_badges", "stats_counter", "icon_features", "faq",
  "comparison_table", "logo_strip", "instagram_grid", "lookbook", "featured_product",
  "hero_slider", "before_after", "skin_quiz", "routine_builder", "video_testimonials", "product_tabs", "community",
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
    defaults: { background_type: "color", background_url: "", bg_color: "", overlay_opacity: 30, height: "medium", content_position: "center", text_color: "", padding: 48, layout: "overlay", side_image_url: "", organic_shape: false, bg_style: "solid" },
    fields: [
      f("layout", "Düzen", "select", { options: opt(["overlay", "Tam genişlik"], ["split", "Metin + yan görsel"]) }),
      f("side_image_url", "Yan görsel / mockup", "text"),
      f("organic_shape", "Organik (blob) görsel şekli", "boolean"),
      f("bg_style", "Arka plan stili", "select", { options: opt(["solid", "Düz"], ["gradient", "Geçişli (tema)"]) }),
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
    defaults: { title: "Öne çıkan ürünler", collection_id: "", products_count: 4, columns: "4", show_price: true, show_rating: false, show_add_to_cart: true,
      card_style: "minimal", layout: "grid", hover_image: true, quick_view: false, stock_bar: false, wishlist: false, swatches: false, origin_tag: false, ingredients: false, badges: true },
    fields: [
      f("card_style", "Kart stili", "select", { options: opt(["minimal", "Sade"], ["bold", "Cesur (koyu)"], ["organic", "Doğa (krem)"], ["boutique", "Butik"], ["tech", "Tech"]) }),
      f("layout", "Düzen", "select", { options: opt(["grid", "Izgara"], ["scroll", "Yatay kaydırma"]) }),
      f("hover_image", "Üzerine gelince 2. görsel", "boolean"),
      f("quick_view", "Hızlı bakış", "boolean"),
      f("stock_bar", "Az stok göstergesi", "boolean"),
      f("wishlist", "Favori kalbi", "boolean"),
      f("swatches", "Renk seçenekleri (etiket: renk:#hex)", "boolean"),
      f("origin_tag", "Üretim yeri (etiket: köken:Ege)", "boolean"),
      f("ingredients", "Malzemeler / sertifikalar (etiket: malzeme:…, sertifika:…)", "boolean"),
      f("badges", "Rozetler (İndirim/Yeni/Çok Satan)", "boolean"),
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
    defaults: { image_url: "", bg_color: "", text_color: "", height: "medium", content_position: "center", bg_style: "solid" },
    fields: [
      f("bg_style", "Arka plan stili", "select", { options: opt(["solid", "Düz"], ["gradient", "Geçişli (tema)"]) }),
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
    defaults: { image_url: "", image_position: "left", image_ratio: "square", content_width: "medium", image_filter: "none" },
    fields: [
      f("image_filter", "Görsel filtresi", "select", { options: opt(["none", "Yok"], ["grayscale", "Siyah beyaz"], ["sepia", "Sepya / grenli"]) }),
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
    defaults: { title: "Koleksiyonlar", collections: "", columns: "3", image_ratio: "square", shape: "square", hover_zoom: true },
    fields: [
      f("shape", "Şekil", "select", { options: opt(["square", "Kare"], ["circle", "Yuvarlak"], ["tile", "Büyük görsel"]) }),
      f("hover_zoom", "Üzerine gelince yakınlaş", "boolean"),
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
  hero_slider: {
    label: "Kayan hero", description: "Otomatik geçen 1–5 slayt; mobilde parmakla kaydırılır.",
    defaults: { slides: "Yeni sezon|%50'ye varan indirim|Alışverişe başla|/products|https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1600&q=70&fm=webp", interval: 5, height: "medium" },
    fields: [f("slides", "Slaytlar", "lines", { help: "Her satır: başlık|alt başlık|buton|link|görsel URL" }), f("interval", "Geçiş süresi (sn)", "number", { min: 3, max: 15 }), f("height", "Yükseklik", "select", { options: opt(["small", "Küçük"], ["medium", "Orta"], ["large", "Büyük"]) })],
    blocks: [], maxBlocks: 0,
  },
  before_after: {
    label: "Önce / sonra", description: "Sürüklenebilir karşılaştırma görseli.",
    defaults: { title: "Farkı gör", before_url: "", after_url: "", before_label: "Önce", after_label: "Sonra", caption: "" },
    fields: [f("title", "Başlık", "text"), f("before_url", "Önce görseli URL", "text"), f("after_url", "Sonra görseli URL", "text"), f("before_label", "Önce etiketi", "text"), f("after_label", "Sonra etiketi", "text"), f("caption", "Açıklama", "text")],
    blocks: [], maxBlocks: 0,
  },
  skin_quiz: {
    label: "Bul testi", description: "Kısa soru → sonuca göre ürün araması (ör. cilt tipi).",
    defaults: { title: "Cilt tipini bul", question: "Gün ortasında cildin nasıl hissediyor?", options: "Parlıyor|yağlı\nGergin|kuru\nT bölgesi parlak|karma\nKızarıyor|hassas", result_prefix: "Senin için öneriler:" },
    fields: [f("title", "Başlık", "text"), f("question", "Soru", "text"), f("options", "Seçenekler", "lines", { help: "Her satır: seçenek|arama etiketi" }), f("result_prefix", "Sonuç metni", "text")],
    blocks: [], maxBlocks: 0,
  },
  routine_builder: {
    label: "Rutin oluşturucu", description: "Sabah / gece sekmeli adım adım rutin.",
    defaults: { title: "Rutinini oluştur", morning: "Temizle|Nazik jel temizleyici\nTonikle|Nem dengeleyici tonik\nKoru|SPF 50 güneş kremi", night: "Makyaj temizle|Temizleme yağı\nOnar|Gece serumu\nBesle|Yoğun nem kremi" },
    fields: [f("title", "Başlık", "text"), f("morning", "Sabah adımları", "lines", { help: "Her satır: adım|ürün/açıklama" }), f("night", "Gece adımları", "lines", { help: "Her satır: adım|ürün/açıklama" })],
    blocks: [], maxBlocks: 0,
  },
  video_testimonials: {
    label: "Video yorumlar", description: "Müşteri video yorum kartları (YouTube/Vimeo/MP4).",
    defaults: { title: "Müşterilerimiz anlatıyor", items: "" },
    fields: [f("title", "Başlık", "text"), f("items", "Videolar", "lines", { help: "Her satır: isim|video URL|kısa not" })],
    blocks: [], maxBlocks: 0,
  },
  product_tabs: {
    label: "Sekmeli ürünler", description: "Ürün etiketlerine göre sekmeli ürün listesi.",
    defaults: { title: "Çok satanlar", tabs: "", products_count: 8, columns: 4, card_style: "minimal" },
    fields: [f("title", "Başlık", "text"), f("tabs", "Sekmeler", "lines", { help: "Her satır: sekme adı|ürün etiketi (boşsa tüm ürünler)" }), f("products_count", "Ürün sayısı", "number", { min: 2, max: 16 }), f("columns", "Sütun", "select", { options: COLS }), f("card_style", "Kart stili", "select", { options: opt(["minimal", "Minimal"], ["bold", "Cesur"], ["organic", "Organik"], ["boutique", "Butik"], ["tech", "Teknoloji"]) })],
    blocks: [], maxBlocks: 0,
  },
  community: {
    label: "Topluluk", description: "Discord, Twitch, YouTube, Instagram bağlantı kartları.",
    defaults: { title: "Topluluğa katıl", subtitle: "", links: "Discord|https://discord.com\nTwitch|https://twitch.tv\nYouTube|https://youtube.com" },
    fields: [f("title", "Başlık", "text"), f("subtitle", "Alt başlık", "text"), f("links", "Bağlantılar", "lines", { help: "Her satır: ad|URL" })],
    blocks: [], maxBlocks: 0,
  },
  marquee: {
    label: "Kayan şerit", description: "Hızlı kayan kategori / kampanya metinleri.",
    defaults: { items: "YENİ SEZON\nÜCRETSİZ KARGO\nFLASH İNDİRİM\nSPOR\nELEKTRONİK", speed: 25, bg_color: "", text_color: "", separator: "✦" },
    fields: [f("items", "Metinler", "lines"), f("speed", "Tur süresi (sn)", "number", { min: 5, max: 90 }), f("separator", "Ayırıcı", "text"), f("bg_color", "Arka plan", "text"), f("text_color", "Metin rengi", "text")],
    blocks: [], maxBlocks: 0,
  },
  flash_sale: {
    label: "Flash indirim", description: "Geri sayım + indirimli ürün kartları.",
    defaults: { title: "FLASH İNDİRİM", subtitle: "Stoklarla sınırlı", end_date: "", end_time: "23:59", products_count: 4, bg_color: "" },
    fields: [f("title", "Başlık", "text"), f("subtitle", "Alt başlık", "text"), f("end_date", "Bitiş tarihi (YYYY-AA-GG, boşsa gün sonu)", "text"), f("end_time", "Bitiş saati", "text"), f("products_count", "Ürün sayısı", "number", { min: 2, max: 12 }), f("bg_color", "Arka plan", "text")],
    blocks: [], maxBlocks: 0,
  },
  trust_badges: {
    label: "Güven rozetleri", description: "Kargo, iade, güvenli ödeme.",
    defaults: { items: "🚚|Ücretsiz Kargo|500 TL üzeri siparişlerde\n↩️|14 Gün İade|Koşulsuz iade hakkı\n🔒|Güvenli Ödeme|256-bit SSL ve 3D Secure", bg_color: "" },
    fields: [f("items", "Rozetler", "lines", { help: "Her satır: ikon|başlık|açıklama" }), f("bg_color", "Arka plan", "text")],
    blocks: [], maxBlocks: 0,
  },
  stats_counter: {
    label: "Sayaçlar", description: "Animasyonlu rakamlar (müşteri, ürün, yıl).",
    defaults: { title: "", items: "10000+|Mutlu müşteri\n500+|Ürün\n8|Yıllık tecrübe", bg_color: "" },
    fields: [f("title", "Başlık", "text"), f("items", "Sayaçlar", "lines", { help: "Her satır: değer|etiket (ör. 10000+|Müşteri)" }), f("bg_color", "Arka plan", "text")],
    blocks: [], maxBlocks: 0,
  },
  icon_features: {
    label: "İkonlu özellikler", description: "Değerlerimiz / özellik kartları.",
    defaults: { title: "Değerlerimiz", items: "🌿|Doğal|Katkısız, katkı maddesiz\n🌱|Organik|Sertifikalı üretim\n🏡|Yerel|Küçük üreticilerden", style: "plain", columns: "3", bg_color: "" },
    fields: [f("title", "Başlık", "text"), f("items", "Öğeler", "lines", { help: "Her satır: ikon|başlık|açıklama" }), f("style", "Stil", "select", { options: opt(["plain", "Sade"], ["card", "Kart"]) }), f("columns", "Sütun", "select", { options: COLS }), f("bg_color", "Arka plan", "text")],
    blocks: [], maxBlocks: 0,
  },
  faq: {
    label: "SSS", description: "Açılır-kapanır sık sorulan sorular.",
    defaults: { title: "Sık sorulan sorular", items: "Kargo ne kadar sürer?|Siparişler 1-3 iş günü içinde kargoya verilir.\nİade nasıl yapılır?|Hesabım > Siparişlerim üzerinden 14 gün içinde iade talebi oluşturabilirsiniz.\nTaksit var mı?|Tüm kredi kartlarına taksit seçenekleri sunuyoruz." },
    fields: [f("title", "Başlık", "text"), f("items", "Sorular", "lines", { help: "Her satır: soru|cevap" })],
    blocks: [], maxBlocks: 0,
  },
  comparison_table: {
    label: "Karşılaştırma tablosu", description: "Paket / ürün karşılaştırması (fiyat planları gibi).",
    defaults: { title: "Size uygun paketi seçin", items: "Başlangıç|₺499|1 kullanıcı;E-posta destek;Temel özellikler||/products\nPro|₺999|5 kullanıcı;Öncelikli destek;Tüm özellikler|öne çıkan|/products\nKurumsal|Teklif alın|Sınırsız kullanıcı;Uzman desteği;Özel entegrasyon||/contact" },
    fields: [f("title", "Başlık", "text"), f("items", "Kolonlar", "lines", { help: "Her satır: ad|fiyat|özellik;özellik|öne çıkan (boş/öne çıkan)|bağlantı" })],
    blocks: [], maxBlocks: 0,
  },
  logo_strip: {
    label: "Logo şeridi", description: "Basında biz / markalar.",
    defaults: { title: "Basında biz", items: "Vogue\nElle\nHarper's Bazaar\nMarie Claire\nL'Officiel", grayscale: true },
    fields: [f("title", "Başlık", "text"), f("items", "Logolar", "lines", { help: "Her satır: görsel adresi ya da metin" }), f("grayscale", "Gri tonlama", "boolean")],
    blocks: [], maxBlocks: 0,
  },
  instagram_grid: {
    label: "Instagram ızgarası", description: "9 fotoğraflık akış.",
    defaults: { title: "Bizi takip edin", handle: "@magazaniz", profile_url: "", images: "" },
    fields: [f("title", "Başlık", "text"), f("handle", "Kullanıcı adı", "text"), f("profile_url", "Profil bağlantısı", "text"), f("images", "Görseller", "lines", { help: "Her satır bir görsel adresi; boşsa ürün görselleri kullanılır." })],
    blocks: [], maxBlocks: 0,
  },
  lookbook: {
    label: "Lookbook", description: "Dağınık ızgara; fotoğraftaki ürüne dokununca ürün etiketi.",
    defaults: { title: "Lookbook", items: "" },
    fields: [f("title", "Başlık", "text"), f("items", "Kareler", "lines", { help: "Her satır: görsel adresi|ürün slug|x%|y% (boşsa ürünlerden üretilir)" })],
    blocks: [], maxBlocks: 0,
  },
  featured_product: {
    label: "Tek öne çıkan ürün", description: "Büyük görsel + detaylı ürün tanıtımı.",
    defaults: { product_id: "", eyebrow: "Öne çıkan", model_info: "", button_text: "Ürünü incele", image_position: "left" },
    fields: [f("product_id", "Ürün (slug ya da id; boşsa ilk ürün)", "text"), f("eyebrow", "Üst etiket", "text"), f("model_info", "Model bilgisi (ör. Model 170cm, S giyiyor)", "text"), f("button_text", "Buton metni", "text"), f("image_position", "Görsel konumu", "select", { options: opt(["left", "Sol"], ["right", "Sağ"]) })],
    blocks: [], maxBlocks: 0,
  },
};

export const V2_BLOCKS: Record<V2BlockType, V2Definition> = {
  heading: {
    label: "Başlık", description: "Başlık metni",
    defaults: { text: "Başlık", tag: "h2", font_size: 0, font_weight: "700", color: "", alignment: "inherit", margin_top: 0, margin_bottom: 12, font: "heading" },
    fields: [
      f("text", "Metin", "text"),
      f("tag", "Etiket", "select", { options: opt(["h1", "H1"], ["h2", "H2"], ["h3", "H3"], ["h4", "H4"]) }),
      f("font_size", "Yazı boyutu (0 = tema)", "number", { min: 0, max: 96 }),
      f("font", "Yazı tipi", "select", { options: opt(["heading", "Başlık fontu"], ["accent", "El yazısı / vurgu fontu"]) }),
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
export const V2_FONTS = ["Inter", "Geist", "Manrope", "DM Sans", "Plus Jakarta Sans", "Outfit", "Sora", "Work Sans", "Poppins", "Playfair Display", "Cormorant Garamond", "Lora", "Libre Baskerville", "Space Grotesk", "Bebas Neue", "Source Sans 3", "Jost", "Caveat", "Nunito", "Dancing Script", "Roboto Condensed", "Noto Serif", "Noto Sans", "Shippori Mincho", "Orbitron", "Exo 2"] as const;
export const V2_MONO_FONTS = ["JetBrains Mono", "Share Tech Mono", "Space Mono", "IBM Plex Mono", "Fira Code"] as const;

export const V2_GLOBAL_DEFAULTS: V2Settings = {
  color_primary: "#111111", color_secondary: "#6b7280", color_accent: "#e8c547", gradient_from: "", gradient_to: "", color_background: "#ffffff", color_surface: "#f9fafb",
  color_text: "#111111", color_text_muted: "#6b7280", color_border: "#e5e7eb",
  color_error: "#dc2626", color_success: "#16a34a",
  font_heading: "Inter", font_body: "Inter", font_mono: "JetBrains Mono", font_accent: "Caveat", letter_spacing: 0,
  font_size_base: 16, line_height_base: 1.5, font_weight_heading: "700",
  h1_size: 48, h2_size: 36, h3_size: 28, h4_size: 22, h5_size: 18, h6_size: 16, p_size: 16,
  max_width: 1200, content_padding: 16, section_padding: 64, grid_gap: 24, border_radius: 8,
  button_bg: "", button_text: "#ffffff", button_radius: 999, button_padding: 12, button_padding_y: 10,
  button_hover: "darken", button_transition: "150",
  image_ratio: "square", image_fit: "cover", image_placeholder: "color",
  dark_mode: "off", dark_color_background: "#0f172a", dark_color_surface: "#1e293b", dark_color_text: "#f1f5f9", dark_color_border: "#334155",
  logo_url: "", favicon_url: "", logo_width: 140, logo_position: "left",
  style_preset: "none", heading_case: "none", heading_tracking: 0,
};

const FONT_OPTS = V2_FONTS.map((x) => ({ value: x, label: x }));
export const V2_GLOBAL_GROUPS: { id: string; label: string; flag?: string; fields: SectionField[] }[] = [
  { id: "colors", label: "Renkler", fields: [
    f("color_primary", "Ana renk", "text"), f("color_secondary", "İkincil renk", "text"), f("color_accent", "Vurgu rengi", "text"),
    f("gradient_from", "Geçiş başlangıcı (boşsa ana renk)", "text"), f("gradient_to", "Geçiş bitişi (boşsa ikincil)", "text"),
    f("color_background", "Arka plan", "text"), f("color_surface", "Yüzey", "text"),
    f("color_text", "Metin", "text"), f("color_text_muted", "Soluk metin", "text"),
    f("color_error", "Hata", "text"), f("color_success", "Başarı", "text"), f("color_border", "Kenarlık", "text"),
  ] },
  { id: "typography", label: "Tipografi", fields: [
    f("font_heading", "Başlık fontu", "select", { options: FONT_OPTS }), f("font_body", "Gövde fontu", "select", { options: FONT_OPTS }),
    f("font_mono", "Mono font", "select", { options: V2_MONO_FONTS.map((x) => ({ value: x, label: x })) }),
    f("font_accent", "Vurgu / el yazısı fontu", "select", { options: FONT_OPTS }),
    f("letter_spacing", "Harf aralığı (em × 100)", "number", { min: -5, max: 20 }),
    f("heading_case", "Başlık harfleri", "select", { options: opt(["none", "Normal"], ["uppercase", "TÜMÜ BÜYÜK"]) }),
    f("heading_tracking", "Başlık harf aralığı (em × 100)", "number", { min: -5, max: 30 }),
    f("font_size_base", "Temel boyut (px)", "number", { min: 12, max: 22 }),
    f("line_height_base", "Satır yüksekliği", "number", { min: 1, max: 2.2 }),
    f("font_weight_heading", "Başlık ağırlığı", "select", { options: opt(["200", "200"], ["300", "300"], ["400", "400"], ["500", "500"], ["600", "600"], ["700", "700"], ["800", "800"], ["900", "900"]) }),
    ...(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((t) => f(`${t}_size`, `${t.toUpperCase()} boyutu`, "number", { min: 10, max: 96 })),
  ] },
  { id: "effects", label: "Efektler", fields: [
    f("style_preset", "Efekt paketi", "select", { options: opt(["none", "Yok"], ["obsidian", "Obsidyen: altın parıltı, paralaks, imleç"], ["aurora", "Aurora: hareketli geçiş, cam kartlar, ilerleme çubuğu"], ["atlas", "Atlas: pazar yeri yoğun düzen"], ["zen", "Zen: mürekkep açılış, ince çizgiler, grenli görseller"], ["nexus", "Nexus: neon, tarama çizgisi, glitch, nişangâh"]) }),
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
    `--font-accent:'${safeFont(s["font_accent"], "Caveat")}',cursive`,
    `--color-accent:${safeColor(s["color_accent"], primary)}`,
    `--gradient-primary:linear-gradient(135deg,${safeColor(s["gradient_from"], primary)},${safeColor(s["gradient_to"], safeColor(s["color_secondary"], "#6b7280"))})`,
    `--letter-spacing:${clamp(n("letter_spacing"), -5, 20) / 100}em`,
    `--heading-case:${s["heading_case"] === "uppercase" ? "uppercase" : "none"}`,
    `--heading-tracking:${clamp(n("heading_tracking"), -5, 30) / 100}em`,
    `--font-size-base:${clamp(n("font_size_base"), 12, 22)}px`,
    `--line-height-base:${clamp(Number(s["line_height_base"]) || 1.5, 1, 2.2)}`,
    `--font-weight-heading:${/^[2-9]00$/.test(String(s["font_weight_heading"])) ? s["font_weight_heading"] : "700"}`,
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
  return `${scope}{${vars.join(";")};background:var(--color-background);color:var(--color-text);font-family:var(--font-body);font-size:var(--font-size-base);line-height:var(--line-height-base);letter-spacing:var(--letter-spacing)}` +
    darkCss +
    `${scope} h1,${scope} h2,${scope} h3,${scope} h4,${scope} h5,${scope} h6{font-family:var(--font-heading);font-weight:var(--font-weight-heading);margin:0;line-height:1.15;text-transform:var(--heading-case);letter-spacing:var(--heading-tracking)}` +
    ["h1", "h2", "h3", "h4", "h5", "h6"].map((t) => `${scope} ${t}{font-size:var(--size-${t})}`).join("") +
    `${scope} code,${scope} pre{font-family:var(--font-mono)}` +
    `${scope} .v2-btn{transition:all var(--btn-transition)}${scope} .v2-btn:hover{${hover}}`;
}

/** Yayınlanmış v2 temasını eski vitrin kabuğunun (ürün, liste, sepet, ödeme sayfaları) tema alanlarına çevirir. */
export function v2ToLegacyTheme(settings: V2Settings) {
  const s = globalSettings(settings);
  const dark = darkModeOf(s) === "on";
  const bg = dark ? safeColor(s["dark_color_background"], "#0f172a") : safeColor(s["color_background"], "#ffffff");
  const primary = safeColor(s["color_primary"], "#111111");
  return {
    primary_color: dark ? primary : safeColor(s["color_text"], "#111111"),
    accent_color: safeColor(s["button_bg"], primary),
    background_color: bg,
    font_pair: `v2:${safeFont(s["font_heading"])}|${safeFont(s["font_body"])}`,
    radius: clamp(Number(s["border_radius"]) || 0, 0, 32) / 16,
    button_style: Number(s["button_radius"]) >= 99 ? "pill" : Number(s["button_radius"]) === 0 ? "square" : "solid",
    logo_url: typeof s["logo_url"] === "string" && /^https?:\/\//.test(s["logo_url"]) ? s["logo_url"] : undefined,
  };
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
