/**
 * Gelişmiş tema blokları (Page Builder seviyesi).
 *
 * Çekirdek bloklar `theme-sections.ts` içinde tanımlıdır; bu dosya kategori
 * bazlı gelişmiş blok kütüphanesini ekler. Render karşılıkları
 * `src/components/storefront-blocks.tsx` içindedir.
 */

import type { SectionField, ThemeSectionDefinition } from "@/lib/theme-sections";

export type ExtendedSectionType =
  // Hero / slider
  | "hero_slider"
  | "hero_split"
  | "hero_fullscreen"
  | "hero_video"
  | "hero_center"
  | "hero_product"
  | "hero_campaign"
  | "hero_countdown"
  | "hero_before_after"
  // Banner
  | "banner_split"
  | "banner_masonry"
  | "banner_scroll"
  | "banner_color_grid"
  | "banner_collection"
  | "banner_promo"
  // Ürün
  | "product_featured"
  | "product_category"
  | "product_bestsellers"
  | "product_new"
  | "product_discounted"
  | "product_recently_viewed"
  | "product_recommended"
  | "product_feed"
  // Kategori
  | "category_slider"
  | "category_cards"
  | "category_mega"
  // İçerik
  | "rich_text"
  | "icon_boxes"
  | "video"
  | "gallery"
  | "counters"
  | "brands"
  | "logo_cloud"
  | "map"
  // Pazarlama
  | "campaign_banner"
  | "coupon_banner"
  | "countdown"
  | "free_shipping_bar"
  | "trust_badges"
  | "social_proof"
  | "reviews"
  // E-ticaret
  | "cart_block"
  | "featured_collection"
  | "product_comparison"
  | "wishlist"
  | "related_products";

const title = (value: string): SectionField => ({ key: "title", label: "Başlık", kind: "text", placeholder: value });
const textArea: SectionField = { key: "text", label: "Metin", kind: "textarea" };
const ctaLabel: SectionField = { key: "ctaLabel", label: "Buton metni", kind: "text" };
const ctaUrl: SectionField = { key: "ctaUrl", label: "Buton adresi", kind: "text" };
const imageUrl: SectionField = { key: "imageUrl", label: "Görsel adresi", kind: "text" };
const limitField = (min = 2, max = 48): SectionField => ({
  key: "limit",
  label: "Kayıt sayısı",
  kind: "number",
  min,
  max,
});
const columnsField = (min = 1, max = 6): SectionField => ({
  key: "columns",
  label: "Kolon sayısı",
  kind: "number",
  min,
  max,
});
const toneField: SectionField = {
  key: "tone",
  label: "Renk tonu",
  kind: "select",
  options: [
    { value: "accent", label: "Vurgu" },
    { value: "primary", label: "Ana renk" },
    { value: "soft", label: "Yumuşak" },
    { value: "dark", label: "Koyu" },
  ],
};
const filterField: SectionField = {
  key: "filter",
  label: "Ürün filtresi",
  kind: "text",
  help: "Ürün tipi veya etiket. Boş bırakılırsa tüm ürünler.",
};

/** Kategorilere ayrılmış gelişmiş blok kütüphanesi. */
export const EXTENDED_SECTIONS: ThemeSectionDefinition[] = [
  /* ---------------------------------------------------------------- HERO */
  {
    type: "hero_slider",
    label: "Slider",
    category: "hero",
    description: "Otomatik geçişli çok slaytlı tanıtım alanı.",
    slot: "body",
    repeatable: true,
    defaults: {
      items:
        "Yeni sezon indirimde | Seçili ürünlerde %40'a varan avantaj | | Alışverişe başla | #urunler\nHızlı teslimat | Aynı gün kargo fırsatı | | Detaylar | #urunler",
      height: 460,
      autoplay: true,
      interval: 6,
    },
    fields: [
      {
        key: "items",
        label: "Slaytlar",
        kind: "lines",
        help: "Her satır: Başlık | Alt metin | Görsel URL | Buton | Bağlantı",
      },
      { key: "height", label: "Yükseklik (px)", kind: "number", min: 240, max: 820 },
      { key: "autoplay", label: "Otomatik geçiş", kind: "boolean" },
      { key: "interval", label: "Geçiş süresi (sn)", kind: "number", min: 2, max: 20 },
    ],
  },
  {
    type: "hero_split",
    label: "Split Hero",
    category: "hero",
    description: "Solda metin, sağda görsel; iki kolonlu hero.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Günlük hayata uygun tasarımlar",
      subtitle: "Sınırlı sayıda üretilen parçaları keşfet.",
      ctaLabel: "Koleksiyona git",
      ctaUrl: "#urunler",
      imageUrl: "",
      imagePosition: "right",
    },
    fields: [
      title("Başlık"),
      { key: "subtitle", label: "Alt başlık", kind: "textarea" },
      ctaLabel,
      ctaUrl,
      imageUrl,
      {
        key: "imagePosition",
        label: "Görsel konumu",
        kind: "select",
        options: [
          { value: "left", label: "Solda" },
          { value: "right", label: "Sağda" },
        ],
      },
    ],
  },
  {
    type: "hero_fullscreen",
    label: "Full Screen Hero",
    category: "hero",
    description: "Ekranı kaplayan tam boy tanıtım alanı.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Yeni koleksiyon yayında",
      subtitle: "Sezonun öne çıkan parçaları şimdi mağazada.",
      ctaLabel: "Keşfet",
      ctaUrl: "#urunler",
      imageUrl: "",
      overlay: 55,
    },
    fields: [
      title("Başlık"),
      { key: "subtitle", label: "Alt başlık", kind: "textarea" },
      ctaLabel,
      ctaUrl,
      imageUrl,
      { key: "overlay", label: "Karartma (%)", kind: "number", min: 0, max: 90 },
    ],
  },
  {
    type: "hero_video",
    label: "Video Hero",
    category: "hero",
    description: "Arka planda video oynayan hero alanı.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Üretim sürecimizi izle",
      subtitle: "Her ürün atölyemizde tek tek kontrol edilir.",
      videoUrl: "",
      posterUrl: "",
      ctaLabel: "Ürünleri gör",
      ctaUrl: "#urunler",
      height: 520,
    },
    fields: [
      title("Başlık"),
      { key: "subtitle", label: "Alt başlık", kind: "textarea" },
      { key: "videoUrl", label: "Video adresi (mp4)", kind: "text" },
      { key: "posterUrl", label: "Kapak görseli", kind: "text" },
      ctaLabel,
      ctaUrl,
      { key: "height", label: "Yükseklik (px)", kind: "number", min: 280, max: 820 },
    ],
  },
  {
    type: "hero_center",
    label: "Center Hero",
    category: "hero",
    description: "Ortalanmış, sade ve tipografi ağırlıklı hero.",
    slot: "body",
    repeatable: true,
    defaults: {
      badge: "YENİ",
      title: "Sadelikte kalite",
      subtitle: "Az ama doğru parçalarla dolu bir koleksiyon.",
      ctaLabel: "Alışverişe başla",
      ctaUrl: "#urunler",
      height: 420,
    },
    fields: [
      { key: "badge", label: "Etiket", kind: "text" },
      title("Başlık"),
      { key: "subtitle", label: "Alt başlık", kind: "textarea" },
      ctaLabel,
      ctaUrl,
      { key: "height", label: "Yükseklik (px)", kind: "number", min: 240, max: 720 },
    ],
  },
  {
    type: "hero_product",
    label: "Product Hero",
    category: "hero",
    description: "Tek bir ürünü öne çıkaran hero alanı.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Haftanın ürünü", filter: "", ctaLabel: "Ürüne git", badge: "ÖNE ÇIKAN" },
    fields: [title("Başlık"), filterField, { key: "badge", label: "Etiket", kind: "text" }, ctaLabel],
  },
  {
    type: "hero_campaign",
    label: "Campaign Hero",
    category: "hero",
    description: "Kampanya odaklı, etiketli ve renkli hero.",
    slot: "body",
    repeatable: true,
    defaults: {
      badge: "KAMPANYA",
      title: "İkinci ürüne %50 indirim",
      subtitle: "Sepette otomatik uygulanır.",
      ctaLabel: "Kampanyayı gör",
      ctaUrl: "#urunler",
      imageUrl: "",
      tone: "accent",
    },
    fields: [
      { key: "badge", label: "Etiket", kind: "text" },
      title("Başlık"),
      { key: "subtitle", label: "Alt başlık", kind: "textarea" },
      ctaLabel,
      ctaUrl,
      imageUrl,
      toneField,
    ],
  },
  {
    type: "hero_countdown",
    label: "Countdown Hero",
    category: "hero",
    description: "Geri sayım sayacı içeren kampanya hero'su.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Kampanya bitmek üzere",
      subtitle: "Fırsatları kaçırmadan sepetini tamamla.",
      endsAt: "",
      ctaLabel: "Hemen incele",
      ctaUrl: "#urunler",
    },
    fields: [
      title("Başlık"),
      { key: "subtitle", label: "Alt başlık", kind: "textarea" },
      { key: "endsAt", label: "Bitiş tarihi", kind: "text", placeholder: "2026-12-31T23:59" },
      ctaLabel,
      ctaUrl,
    ],
  },
  {
    type: "hero_before_after",
    label: "Before/After Hero",
    category: "hero",
    description: "Sürgülü öncesi/sonrası görsel karşılaştırması.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Öncesi ve sonrası",
      beforeUrl: "",
      afterUrl: "",
      beforeLabel: "Öncesi",
      afterLabel: "Sonrası",
      height: 380,
    },
    fields: [
      title("Başlık"),
      { key: "beforeUrl", label: "Öncesi görseli", kind: "text" },
      { key: "afterUrl", label: "Sonrası görseli", kind: "text" },
      { key: "beforeLabel", label: "Öncesi etiketi", kind: "text" },
      { key: "afterLabel", label: "Sonrası etiketi", kind: "text" },
      { key: "height", label: "Yükseklik (px)", kind: "number", min: 220, max: 700 },
    ],
  },

  /* -------------------------------------------------------------- BANNER */
  {
    type: "banner_split",
    label: "Split Banner",
    category: "banner",
    description: "Yan yana iki kampanya kartı.",
    slot: "body",
    repeatable: true,
    defaults: {
      leftTitle: "Kadın koleksiyonu",
      leftText: "Yeni gelenler",
      leftImage: "",
      leftUrl: "#urunler",
      rightTitle: "Erkek koleksiyonu",
      rightText: "Sezon favorileri",
      rightImage: "",
      rightUrl: "#urunler",
      height: 260,
    },
    fields: [
      { key: "leftTitle", label: "Sol başlık", kind: "text" },
      { key: "leftText", label: "Sol metin", kind: "text" },
      { key: "leftImage", label: "Sol görsel", kind: "text" },
      { key: "leftUrl", label: "Sol bağlantı", kind: "text" },
      { key: "rightTitle", label: "Sağ başlık", kind: "text" },
      { key: "rightText", label: "Sağ metin", kind: "text" },
      { key: "rightImage", label: "Sağ görsel", kind: "text" },
      { key: "rightUrl", label: "Sağ bağlantı", kind: "text" },
      { key: "height", label: "Yükseklik (px)", kind: "number", min: 160, max: 560 },
    ],
  },
  {
    type: "banner_masonry",
    label: "Masonry Grid",
    category: "banner",
    description: "Farklı yüksekliklerde görsel ızgarası.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Vitrin",
      items: "Yeni sezon | | #urunler\nİndirimler | | #urunler\nAksesuar | | #urunler",
      columns: 3,
      height: 220,
    },
    fields: [
      title("Başlık"),
      { key: "items", label: "Kartlar", kind: "lines", help: "Her satır: Başlık | Görsel URL | Bağlantı" },
      columnsField(2, 5),
      { key: "height", label: "Temel yükseklik (px)", kind: "number", min: 140, max: 420 },
    ],
  },
  {
    type: "banner_scroll",
    label: "Scroll Banner",
    category: "banner",
    description: "Yatay akan duyuru şeridi (marquee).",
    slot: "body",
    repeatable: true,
    defaults: {
      items: "ÜCRETSIZ KARGO\n14 GÜN İADE\nGÜVENLİ ÖDEME\nAYNI GÜN SEVKİYAT",
      speed: 28,
      tone: "dark",
    },
    fields: [
      { key: "items", label: "Metinler", kind: "lines", help: "Her satır bir öğe." },
      { key: "speed", label: "Akış süresi (sn)", kind: "number", min: 8, max: 90 },
      toneField,
    ],
  },
  {
    type: "banner_color_grid",
    label: "Color Grid",
    category: "banner",
    description: "Renk bloklarından oluşan kategori ızgarası.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Renklere göre keşfet",
      items: "Siyah | #111827 | #urunler\nBej | #d6c7ae | #urunler\nMavi | #1d4ed8 | #urunler\nYeşil | #15803d | #urunler",
      columns: 4,
      height: 140,
    },
    fields: [
      title("Başlık"),
      { key: "items", label: "Bloklar", kind: "lines", help: "Her satır: Başlık | Renk (hex) | Bağlantı" },
      columnsField(2, 6),
      { key: "height", label: "Yükseklik (px)", kind: "number", min: 90, max: 320 },
    ],
  },
  {
    type: "banner_collection",
    label: "Collection Banner",
    category: "banner",
    description: "Seçili koleksiyonu tanıtan geniş banner.",
    slot: "body",
    repeatable: true,
    defaults: {
      collectionSlug: "",
      title: "",
      text: "Koleksiyondaki tüm ürünleri görüntüle.",
      imageUrl: "",
      ctaLabel: "Koleksiyona git",
      height: 300,
    },
    fields: [
      { key: "collectionSlug", label: "Koleksiyon (slug)", kind: "text", help: "Boş: ilk koleksiyon." },
      title("Başlık (boş: koleksiyon adı)"),
      textArea,
      imageUrl,
      ctaLabel,
      { key: "height", label: "Yükseklik (px)", kind: "number", min: 180, max: 560 },
    ],
  },
  {
    type: "banner_promo",
    label: "Promotional Banner",
    category: "banner",
    description: "Tek satır kampanya bandı.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Bugüne özel %20 indirim",
      text: "Kod: MEFTI20",
      ctaLabel: "Alışverişe başla",
      ctaUrl: "#urunler",
      tone: "primary",
    },
    fields: [title("Başlık"), textArea, ctaLabel, ctaUrl, toneField],
  },

  /* ---------------------------------------------------------------- ÜRÜN */
  {
    type: "product_featured",
    label: "Featured Products",
    category: "product",
    description: "Öne çıkan ürünleri vurgulu düzende gösterir.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Öne çıkan ürünler", filter: "", limit: 4, columns: 4 },
    fields: [title("Başlık"), filterField, limitField(2, 24), columnsField(2, 5)],
  },
  {
    type: "product_category",
    label: "Category Products",
    category: "product",
    description: "Belirli bir koleksiyonun ürünlerini listeler.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Koleksiyon ürünleri", collectionSlug: "", limit: 8, columns: 4 },
    fields: [
      title("Başlık"),
      { key: "collectionSlug", label: "Koleksiyon (slug)", kind: "text" },
      limitField(2, 48),
      columnsField(2, 5),
    ],
  },
  {
    type: "product_bestsellers",
    label: "Best Sellers",
    category: "product",
    description: "En çok tercih edilen ürünler şeridi.",
    slot: "body",
    repeatable: true,
    defaults: { title: "En çok satanlar", limit: 8, columns: 4, layout: "grid" },
    fields: [
      title("Başlık"),
      limitField(2, 24),
      columnsField(2, 5),
      {
        key: "layout",
        label: "Düzen",
        kind: "select",
        options: [
          { value: "grid", label: "Izgara" },
          { value: "slider", label: "Kaydırmalı" },
        ],
      },
    ],
  },
  {
    type: "product_new",
    label: "New Arrivals",
    category: "product",
    description: "Mağazaya yeni eklenen ürünler.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Yeni gelenler", limit: 8, columns: 4 },
    fields: [title("Başlık"), limitField(2, 24), columnsField(2, 5)],
  },
  {
    type: "product_discounted",
    label: "Discounted Products",
    category: "product",
    description: "İndirimli fiyatı olan ürünleri listeler.",
    slot: "body",
    repeatable: true,
    defaults: { title: "İndirimdekiler", limit: 8, columns: 4, showBadge: true },
    fields: [title("Başlık"), limitField(2, 24), columnsField(2, 5), { key: "showBadge", label: "İndirim etiketi", kind: "boolean" }],
  },
  {
    type: "product_recently_viewed",
    label: "Recently Viewed",
    category: "product",
    description: "Ziyaretçinin son gezdiği ürünler (tarayıcıda saklanır).",
    slot: "body",
    repeatable: false,
    defaults: { title: "Son gezdiklerin", limit: 6 },
    fields: [title("Başlık"), limitField(2, 12)],
  },
  {
    type: "product_recommended",
    label: "Recommended Products",
    category: "product",
    description: "Etiket ve tip yakınlığına göre önerilen ürünler.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Sana önerdiklerimiz", filter: "", limit: 8, columns: 4 },
    fields: [title("Başlık"), filterField, limitField(2, 24), columnsField(2, 5)],
  },
  {
    type: "product_feed",
    label: "Dynamic Product Feed",
    category: "product",
    description: "Kaynağı ve düzeni seçilebilen dinamik ürün akışı.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Dinamik akış", source: "all", filter: "", limit: 12, columns: 4, layout: "grid" },
    fields: [
      title("Başlık"),
      {
        key: "source",
        label: "Kaynak",
        kind: "select",
        options: [
          { value: "all", label: "Tüm ürünler" },
          { value: "new", label: "Yeni gelenler" },
          { value: "discounted", label: "İndirimliler" },
          { value: "bestsellers", label: "En çok satanlar" },
          { value: "filter", label: "Filtreye göre" },
        ],
      },
      filterField,
      limitField(2, 48),
      columnsField(2, 6),
      {
        key: "layout",
        label: "Düzen",
        kind: "select",
        options: [
          { value: "grid", label: "Izgara" },
          { value: "slider", label: "Kaydırmalı" },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------ KATEGORİ */
  {
    type: "category_slider",
    label: "Category Slider",
    category: "category",
    description: "Yatay kaydırmalı kategori şeridi.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Kategoriler", limit: 10, cardWidth: 220 },
    fields: [
      title("Başlık"),
      limitField(2, 30),
      { key: "cardWidth", label: "Kart genişliği (px)", kind: "number", min: 140, max: 360 },
    ],
  },
  {
    type: "category_cards",
    label: "Category Cards",
    category: "category",
    description: "Ürün sayısı gösterilen kategori kartları.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Kategorilere göz at", limit: 8, columns: 4, showCount: true },
    fields: [title("Başlık"), limitField(2, 24), columnsField(2, 6), { key: "showCount", label: "Ürün sayısı göster", kind: "boolean" }],
  },
  {
    type: "category_mega",
    label: "Mega Category",
    category: "category",
    description: "Kategori ve alt ürünlerini kolonlarda listeleyen mega düzen.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Tüm kategoriler", columns: 4, itemsPerColumn: 5 },
    fields: [
      title("Başlık"),
      columnsField(2, 5),
      { key: "itemsPerColumn", label: "Kolon başına ürün", kind: "number", min: 2, max: 12 },
    ],
  },

  /* -------------------------------------------------------------- İÇERİK */
  {
    type: "rich_text",
    label: "Rich Text",
    category: "content",
    description: "Serbest metin bloğu (satır sonları korunur).",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Hakkımızda",
      body: "Mağazamız 2019'dan bu yana özenle seçilmiş ürünleri sunuyor.\nHer siparişte hızlı kargo ve kolay iade.",
      align: "left",
      maxWidth: 760,
    },
    fields: [
      title("Başlık"),
      { key: "body", label: "Metin", kind: "textarea" },
      {
        key: "align",
        label: "Hizalama",
        kind: "select",
        options: [
          { value: "left", label: "Sola" },
          { value: "center", label: "Ortaya" },
        ],
      },
      { key: "maxWidth", label: "Maksimum genişlik (px, 0 = tam)", kind: "number", min: 0, max: 1400 },
    ],
  },
  {
    type: "icon_boxes",
    label: "Icon Boxes",
    category: "content",
    description: "İkonlu avantaj kutuları.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Neden biz?",
      items:
        "🚚 | Hızlı kargo | Siparişler aynı gün kargoda\n🔒 | Güvenli ödeme | 3D Secure ile korumalı\n↩️ | Kolay iade | 14 gün içinde koşulsuz",
      columns: 3,
    },
    fields: [
      title("Başlık"),
      { key: "items", label: "Kutular", kind: "lines", help: "Her satır: İkon | Başlık | Metin" },
      columnsField(1, 4),
    ],
  },
  {
    type: "video",
    label: "Video",
    category: "content",
    description: "Gömülü video bloğu (mp4 veya embed adresi).",
    slot: "body",
    repeatable: true,
    defaults: { title: "Tanıtım videosu", videoUrl: "", embedUrl: "", caption: "", aspect: "16:9" },
    fields: [
      title("Başlık"),
      { key: "videoUrl", label: "Video adresi (mp4)", kind: "text" },
      { key: "embedUrl", label: "Embed adresi", kind: "text", help: "YouTube/Vimeo embed bağlantısı." },
      { key: "caption", label: "Alt yazı", kind: "text" },
      {
        key: "aspect",
        label: "Oran",
        kind: "select",
        options: [
          { value: "16:9", label: "16:9" },
          { value: "4:3", label: "4:3" },
          { value: "1:1", label: "1:1" },
        ],
      },
    ],
  },
  {
    type: "gallery",
    label: "Gallery",
    category: "content",
    description: "Görsel galerisi ızgarası.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Galeri", images: "", columns: 3, height: 220 },
    fields: [
      title("Başlık"),
      { key: "images", label: "Görseller", kind: "lines", help: "Her satır bir görsel adresi." },
      columnsField(2, 6),
      { key: "height", label: "Kart yüksekliği (px)", kind: "number", min: 120, max: 480 },
    ],
  },
  {
    type: "counters",
    label: "Counters",
    category: "content",
    description: "Rakamlarla öne çıkan metrikler.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Rakamlarla biz",
      items: "12.000+ | Mutlu müşteri\n4.8/5 | Ortalama puan\n48 saat | Ortalama teslimat",
      columns: 3,
    },
    fields: [
      title("Başlık"),
      { key: "items", label: "Metrikler", kind: "lines", help: "Her satır: Değer | Etiket" },
      columnsField(1, 4),
    ],
  },
  {
    type: "brands",
    label: "Brands",
    category: "content",
    description: "Marka kartları.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Markalar", items: "Marka A | | \nMarka B | | \nMarka C | | ", columns: 4 },
    fields: [
      title("Başlık"),
      { key: "items", label: "Markalar", kind: "lines", help: "Her satır: İsim | Logo URL | Bağlantı" },
      columnsField(2, 6),
    ],
  },
  {
    type: "logo_cloud",
    label: "Logo Cloud",
    category: "content",
    description: "İş ortağı logolarının sade şeridi.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Bize güvenenler", logos: "", height: 44, grayscale: true },
    fields: [
      title("Başlık"),
      { key: "logos", label: "Logolar", kind: "lines", help: "Her satır bir logo adresi." },
      { key: "height", label: "Logo yüksekliği (px)", kind: "number", min: 20, max: 120 },
      { key: "grayscale", label: "Gri tonlama", kind: "boolean" },
    ],
  },
  {
    type: "map",
    label: "Map",
    category: "content",
    description: "Mağaza konumu ve adres bilgisi.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Bize ulaşın", address: "", embedUrl: "", height: 320 },
    fields: [
      title("Başlık"),
      { key: "address", label: "Adres", kind: "textarea" },
      { key: "embedUrl", label: "Harita embed adresi", kind: "text" },
      { key: "height", label: "Yükseklik (px)", kind: "number", min: 180, max: 640 },
    ],
  },

  /* ----------------------------------------------------------- PAZARLAMA */
  {
    type: "campaign_banner",
    label: "Campaign Banner",
    category: "marketing",
    description: "Görsel destekli kampanya bandı.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Sezon finali",
      text: "Seçili ürünlerde son 3 gün.",
      ctaLabel: "Fırsatları gör",
      ctaUrl: "#urunler",
      imageUrl: "",
    },
    fields: [title("Başlık"), textArea, ctaLabel, ctaUrl, imageUrl],
  },
  {
    type: "coupon_banner",
    label: "Coupon Banner",
    category: "marketing",
    description: "Kopyalanabilir indirim kodu kartı.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "İlk siparişine özel",
      code: "HOSGELDIN10",
      text: "Sepette %10 indirim sağlar.",
      expiresAt: "",
    },
    fields: [
      title("Başlık"),
      { key: "code", label: "Kupon kodu", kind: "text" },
      textArea,
      { key: "expiresAt", label: "Son geçerlilik", kind: "text", placeholder: "2026-12-31" },
    ],
  },
  {
    type: "countdown",
    label: "Countdown",
    category: "marketing",
    description: "Kampanya bitişine geri sayım.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Fırsat bitiyor", text: "", endsAt: "", ctaLabel: "", ctaUrl: "" },
    fields: [
      title("Başlık"),
      textArea,
      { key: "endsAt", label: "Bitiş tarihi", kind: "text", placeholder: "2026-12-31T23:59" },
      ctaLabel,
      ctaUrl,
    ],
  },
  {
    type: "free_shipping_bar",
    label: "Free Shipping Bar",
    category: "marketing",
    description: "Ücretsiz kargo eşiğini duyuran şerit.",
    slot: "body",
    repeatable: true,
    defaults: { threshold: 500, text: "{tutar} ve üzeri siparişlerde kargo ücretsiz", tone: "soft" },
    fields: [
      { key: "threshold", label: "Eşik tutarı", kind: "number", min: 0, max: 1_000_000 },
      { key: "text", label: "Metin", kind: "text", help: "{tutar} yer tutucusu eşik tutarıyla değiştirilir." },
      toneField,
    ],
  },
  {
    type: "trust_badges",
    label: "Trust Badges",
    category: "marketing",
    description: "Güven veren kısa rozetler.",
    slot: "body",
    repeatable: true,
    defaults: {
      items:
        "🔐 | 3D Secure | Güvenli ödeme altyapısı\n📦 | Hızlı kargo | 1-3 iş günü teslim\n💬 | Destek | Hafta içi 09:00-18:00",
      columns: 3,
    },
    fields: [
      { key: "items", label: "Rozetler", kind: "lines", help: "Her satır: İkon | Başlık | Metin" },
      columnsField(1, 4),
    ],
  },
  {
    type: "social_proof",
    label: "Social Proof",
    category: "marketing",
    description: "Sırayla değişen canlı satış/etkileşim bildirimleri.",
    slot: "body",
    repeatable: false,
    defaults: {
      items:
        "İstanbul'dan bir müşteri sipariş verdi | 2 dakika önce\nAnkara'dan bir müşteri yorum bıraktı | 8 dakika önce\nİzmir'den bir müşteri sepete ürün ekledi | 12 dakika önce",
      intervalSeconds: 5,
    },
    fields: [
      { key: "items", label: "Bildirimler", kind: "lines", help: "Her satır: Metin | Zaman" },
      { key: "intervalSeconds", label: "Değişim süresi (sn)", kind: "number", min: 2, max: 30 },
    ],
  },
  {
    type: "reviews",
    label: "Reviews",
    category: "marketing",
    description: "Puanlı müşteri değerlendirmeleri.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Müşteri değerlendirmeleri",
      items:
        "5 | Ürün tam beklediğim gibi, kargo hızlıydı. | Elif K.\n4 | Kalitesi güzel, beden biraz büyük geldi. | Murat S.\n5 | İkinci alışverişim, yine memnunum. | Zeynep A.",
      columns: 3,
    },
    fields: [
      title("Başlık"),
      { key: "items", label: "Yorumlar", kind: "lines", help: "Her satır: Puan (1-5) | Yorum | İsim" },
      columnsField(1, 4),
    ],
  },

  /* ---------------------------------------------------------- E-TİCARET */
  {
    type: "cart_block",
    label: "Cart",
    category: "commerce",
    description: "Sepete yönlendiren özet kart.",
    slot: "body",
    repeatable: false,
    defaults: {
      title: "Sepetini tamamla",
      text: "Sepetindeki ürünleri gözden geçir ve ödemeye geç.",
      ctaLabel: "Sepete git",
    },
    fields: [title("Başlık"), textArea, ctaLabel],
  },
  {
    type: "featured_collection",
    label: "Featured Collection",
    category: "commerce",
    description: "Bir koleksiyonu başlık ve ürünleriyle öne çıkarır.",
    slot: "body",
    repeatable: true,
    defaults: { title: "", collectionSlug: "", limit: 4, columns: 4, ctaLabel: "Tümünü gör" },
    fields: [
      title("Başlık (boş: koleksiyon adı)"),
      { key: "collectionSlug", label: "Koleksiyon (slug)", kind: "text" },
      limitField(2, 24),
      columnsField(2, 5),
      ctaLabel,
    ],
  },
  {
    type: "product_comparison",
    label: "Product Comparison",
    category: "commerce",
    description: "Karşılaştırma sayfasına yönlendiren kart.",
    slot: "body",
    repeatable: false,
    defaults: {
      title: "Ürünleri karşılaştır",
      text: "Beğendiğin ürünleri yan yana inceleyerek karar ver.",
      ctaLabel: "Karşılaştırmaya git",
    },
    fields: [title("Başlık"), textArea, ctaLabel],
  },
  {
    type: "wishlist",
    label: "Wishlist",
    category: "commerce",
    description: "Favoriler listesine yönlendiren kart.",
    slot: "body",
    repeatable: false,
    defaults: {
      title: "Favorilerin",
      text: "Kaydettiğin ürünleri favorilerinde bulabilirsin.",
      ctaLabel: "Favorilere git",
    },
    fields: [title("Başlık"), textArea, ctaLabel],
  },
  {
    type: "related_products",
    label: "Related Products",
    category: "commerce",
    description: "İlgili/benzer ürün önerileri şeridi.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Bunlar da ilgini çekebilir", filter: "", limit: 6, cardWidth: 220 },
    fields: [
      title("Başlık"),
      filterField,
      limitField(2, 24),
      { key: "cardWidth", label: "Kart genişliği (px)", kind: "number", min: 140, max: 360 },
    ],
  },
];
