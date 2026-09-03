/**
 * Tema mağazası şablonları (izomorfik, DB-agnostik).
 *
 * Her şablon; store_themes için global tema ayarlarını ve
 * store_theme_sections için hazır bölüm düzenini taşır. Uygulandıktan sonra
 * bölümler tema editöründen normal şekilde düzenlenebilir.
 */

import type { SectionSettings, ThemeSectionType } from "@/lib/theme-sections";

export type ThemeTemplateSection = {
  type: ThemeSectionType;
  settings?: SectionSettings;
};

export type ThemeTemplate = {
  code: string;
  name: string;
  tagline: string;
  description: string;
  tags: string[];
  /** Tema mağazası vitrin bilgileri (ücretli / ücretsiz tema ayrımı). */
  store?: {
    /** Aylık veya tek seferlik satış fiyatı (TL). 0 = ücretsiz. */
    price: number;
    priceNote?: string;
    /** Öne çıkan tema olarak işaretlenir. */
    featured?: boolean;
    /** Tema mağazasında listelenen özellikler. */
    features?: string[];
  };
  theme: {
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    fontPair: string;
    radius: number;
    layout: string;
    buttonStyle: "solid" | "outline" | "pill" | "ghost" | "square";
    cardStyle: "soft" | "bordered" | "flat" | "shadow";
    contentWidth: number;
    sectionSpacing: number;
    heroTitle: string;
    heroSubtitle: string;
    heroCtaLabel: string;
    announcement: string;
    showAnnouncement: boolean;
  };
  sections: ThemeTemplateSection[];
};

const BE_YOURS: ThemeTemplate = {
  code: "be-yours",
  name: "Be Yours",
  tagline: "Minimal editorial · Tenor Sans",
  description:
    "Beyaz zeminli, ortalanmış tipografili ve geniş görsel bantlı minimal mağaza teması. Slider, koleksiyon ızgaraları, öne çıkan ürünler, görsel + metin blokları ve müşteri yorumlarıyla gelir.",
  tags: ["Minimal", "Editorial", "Dijital ürün", "Geniş görsel"],
  theme: {
    primaryColor: "#1a1b18",
    accentColor: "#1a1b18",
    backgroundColor: "#ffffff",
    fontPair: "tenor-sans-jost",
    radius: 0.25,
    layout: "magazine",
    buttonStyle: "solid",
    cardStyle: "flat",
    contentWidth: 1600,
    sectionSpacing: 36,
    heroTitle: "Dijital ürünlerle işini büyüt",
    heroSubtitle:
      "Yapay zekâ destekli SaaS araçları, e-ticaret çözümleri ve hazır temalarla dijital dönüşümünü hızlandır.",
    heroCtaLabel: "Şimdi Satın Al",
    announcement: "Tüm dijital ürünlerde anında teslimat",
    showAnnouncement: true,
  },
  sections: [
    { type: "announcement_bar", settings: { text: "Tüm dijital ürünlerde anında teslimat", tone: "primary" } },
    { type: "header", settings: { sticky: true, showSearch: true, showFavorites: true, showCart: true } },
    {
      type: "hero_slider",
      settings: {
        items:
          "Kendi işini kur | Dijital ürünlerle ilk satışına saatler içinde ulaş | | Şimdi Satın Al | #urunler\nHazır e-ticaret çözümleri | Tema, uygulama ve otomasyonlar tek yerde | | Koleksiyonu Gör | #koleksiyonlar",
        height: 650,
        autoplay: true,
        interval: 5,
      },
    },
    {
      type: "rich_text",
      settings: {
        title: "Hakkımızda",
        body:
          "Yenilik, teknoloji ve sürdürülebilir çözümlerle geleceği inşa ediyoruz.\nYapay zekâ destekli SaaS araçları, e-ticaret çözümleri, web tasarımı ve dijital dönüşüm hizmetlerinde uzmanlaşıyoruz.",
        align: "center",
        maxWidth: 760,
      },
    },
    { type: "category_grid", settings: { title: "Koleksiyonlar", source: "collections", limit: 4, columns: 4 } },
    {
      type: "image_text",
      settings: {
        title: "İçeriğinizi saniyeler içinde yaratın",
        text: "Yapay zekâ destekli araçlarla metin, görsel ve kampanya içeriklerini tek tıkla üret.",
        imagePosition: "left",
        ctaLabel: "Şimdi Satın Al",
        ctaUrl: "#urunler",
      },
    },
    { type: "product_featured", settings: { title: "Öne çıkan ürünler", limit: 4, columns: 4 } },
    { type: "gallery", settings: { title: "Vitrinden", columns: 4, height: 320 } },
    {
      type: "image_text",
      settings: {
        title: "Akıllı teknoloji çalışma alanı",
        text: "İşini uzaktan yönetmek için gereken tüm dijital araçlar tek panelde.",
        imagePosition: "right",
        ctaLabel: "Tümünü Gör",
        ctaUrl: "#urunler",
      },
    },
    { type: "product_grid", settings: { title: "Tüm ürünler", limit: 12, columns: 4, showSearch: true, showPrice: true } },
    {
      type: "testimonials",
      settings: {
        title: "Müşterilerimiz ne diyor?",
        items:
          "Site kullanımı çok kolay, ürünler kaliteli ve siparişim beklediğimden hızlı ulaştı. | LARRY\nMükemmel müşteri hizmetleri ve güvenilir teslimat, sorunsuz bir alışveriş süreci. | KYLA\nÜrün çeşitliliği çok iyi, ürünüm açıklamadaki gibiydi. | SELİN\nTeknik destek ekibi her adımda yanımdaydı, tavsiye ederim. | MERT",
        columns: 4,
      },
    },
    {
      type: "newsletter",
      settings: {
        title: "Kampanyaları ilk sen öğren",
        text: "E-posta listesine katıl, yeni ürün ve indirimleri kaçırma.",
        buttonLabel: "Kaydol",
      },
    },
    { type: "footer", settings: { showLegalLinks: true, showPages: true } },
  ],
};

/**
 * Giyim / moda mağazaları için profesyonel tema.
 * Kadın-erkek koleksiyon bantları, beden-renk odaklı ürün vitrinleri,
 * güven ikonları, lookbook galerisi ve bülten kaydı içerir.
 */
const ATELIER_MODE: ThemeTemplate = {
  code: "atelier-mode",
  name: "Atelier Mode",
  tagline: "Giyim & moda · Cormorant + Karla",
  description:
    "Giyim mağazaları için hazırlanmış profesyonel tema. Sezon slider'ı, kadın/erkek koleksiyon bantları, yeni gelenler, en çok satanlar, indirimdekiler, lookbook galerisi, güven ikonları, müşteri yorumları ve bülten bloklarıyla gelir.",
  tags: ["Giyim", "Moda", "Koleksiyon", "Lookbook", "Sezon"],
  theme: {
    primaryColor: "#141414",
    accentColor: "#8a6a4f",
    backgroundColor: "#fbfaf8",
    fontPair: "cormorant-karla",
    radius: 0.15,
    layout: "magazine",
    buttonStyle: "square",
    cardStyle: "flat",
    contentWidth: 1520,
    sectionSpacing: 44,
    heroTitle: "Yeni sezon giyim koleksiyonu",
    heroSubtitle:
      "Zamansız kesimler, doğal kumaşlar ve günlük hayata uyum sağlayan sade parçalar.",
    heroCtaLabel: "Koleksiyonu Keşfet",
    announcement: "1.000 TL üzeri siparişlerde ücretsiz kargo · 30 gün içinde kolay iade",
    showAnnouncement: true,
  },
  sections: [
    {
      type: "announcement_bar",
      settings: {
        text: "1.000 TL üzeri siparişlerde ücretsiz kargo · 30 gün içinde kolay iade",
        linkLabel: "Detaylar",
        linkUrl: "#urunler",
        tone: "soft",
      },
    },
    {
      type: "header",
      settings: { sticky: true, showSearch: true, showFavorites: true, showCart: true, tagline: "Giyim & Aksesuar" },
    },
    {
      type: "hero_slider",
      settings: {
        items:
          "Sonbahar / Kış koleksiyonu | Yumuşak triko, yün palto ve zamansız kesimler | | Koleksiyonu Keşfet | #urunler\nGünlük denim | Yeni yıkamalar ve rahat kalıplar tek yerde | | Denimi Gör | #urunler\nSezon indirimi | Seçili parçalarda %40'a varan avantaj | | Fırsatları Gör | #urunler",
        height: 620,
        autoplay: true,
        interval: 6,
      },
    },
    {
      type: "banner_split",
      settings: {
        leftTitle: "Kadın",
        leftText: "Elbise, triko, palto",
        leftImage: "",
        leftUrl: "#urunler",
        rightTitle: "Erkek",
        rightText: "Gömlek, sweatshirt, pantolon",
        rightImage: "",
        rightUrl: "#urunler",
        height: 320,
      },
    },
    { type: "category_grid", settings: { title: "Kategoriler", source: "collections", limit: 6, columns: 3 } },
    { type: "product_new", settings: { title: "Yeni gelenler", limit: 8, columns: 4 } },
    {
      type: "banner_collection",
      settings: {
        collectionSlug: "",
        title: "Sezonun kapsül gardırobu",
        text: "Birbiriyle kombinlenebilen 8 parça ile tüm haftayı planla.",
        imageUrl: "",
        ctaLabel: "Koleksiyona git",
        height: 360,
      },
    },
    { type: "product_bestsellers", settings: { title: "En çok satanlar", limit: 8, columns: 4, layout: "slider" } },
    {
      type: "icon_boxes",
      settings: {
        title: "Alışveriş avantajları",
        items:
          "🚚 | Ücretsiz kargo | 1.000 TL üzeri tüm siparişlerde\n↩️ | 30 gün iade | Denemesi kolay, iadesi ücretsiz\n📏 | Beden danışmanı | Doğru bedeni ilk seferde bul\n🧵 | Doğal kumaş | Pamuk, yün ve keten ağırlıklı üretim",
        columns: 4,
      },
    },
    {
      type: "image_text",
      settings: {
        title: "Atölyemizden",
        text: "Her parça sınırlı sayıda üretilir; dikiş, kumaş ve kalıp kontrolünden tek tek geçer.",
        imageUrl: "",
        imagePosition: "left",
        ctaLabel: "Hikâyemiz",
        ctaUrl: "#hakkimizda",
      },
    },
    { type: "product_discounted", settings: { title: "İndirimdekiler", limit: 8, columns: 4, showBadge: true } },
    { type: "gallery", settings: { title: "Lookbook", images: "", columns: 4, height: 360 } },
    {
      type: "testimonials",
      settings: {
        title: "Müşteri yorumları",
        items:
          "Kalıbı tam beklediğim gibiydi, kumaşı çok kaliteli. | Elif K.\nBeden tablosu doğru, ilk seferde uydu. | Murat S.\nKargo bir günde geldi, paketleme çok özenli. | Zeynep A.\nİade süreci gerçekten sorunsuz işliyor. | Can T.",
        columns: 4,
      },
    },
    {
      type: "trust_badges",
      settings: {
        items:
          "🔐 | Güvenli ödeme | 3D Secure altyapısı\n📦 | Hızlı teslimat | 1-3 iş günü içinde kapında\n💬 | Canlı destek | Hafta içi 09:00-18:00",
        columns: 3,
      },
    },
    {
      type: "newsletter",
      settings: {
        title: "Yeni koleksiyonu ilk sen gör",
        text: "Bültene katıl, sezon lansmanları ve özel indirimleri kaçırma.",
        buttonLabel: "Kaydol",
        successMessage: "Teşekkürler! Listeye eklendin.",
      },
    },
    { type: "footer", settings: { showLegalLinks: true, showPages: true, about: "Zamansız kesimler, doğal kumaşlar." } },
  ],
};

/**
 * WOKIEE — çok amaçlı premium mega-store teması.
 *
 * Tasarım yaklaşımı: koyu üst bar + para birimi/dil şeridi, sticky mega menü,
 * tam genişlik hero slider, renkli kampanya kutuları, kategori kaydırıcısı,
 * sekmeli ürün vitrinleri (yeni / en çok satan / indirimli), sayaçlı fırsat bloğu,
 * marka şeridi, avantaj ikonları, blog, yorumlar, instagram galerisi,
 * güven rozetleri ve çok kolonlu footer.
 */
const WOKIEE: ThemeTemplate = {
  code: "wokiee-mega",
  name: "Wokiee",
  tagline: "Çok amaçlı mega store · Archivo + Hind",
  description:
    "Büyük katalogla çalışan mağazalar için profesyonel çok amaçlı tema. Kampanya şeridi, tam genişlik slider, renkli kampanya kutuları, kategori kaydırıcısı, yeni/en çok satan/indirimli ürün vitrinleri, geri sayımlı fırsat bloğu, marka şeridi, blog, yorumlar, sosyal galeri, güven rozetleri ve zengin footer içerir.",
  tags: ["Çok amaçlı", "Mega store", "Elektronik", "Moda", "Premium"],
  store: {
    price: 2490,
    priceNote: "Tek seferlik lisans · ömür boyu güncelleme",
    featured: true,
    features: [
      "Mega menü uyumlu sticky header ve arama",
      "Tam genişlik otomatik hero slider (3 kampanya)",
      "Renkli kampanya kutuları ve ikili split banner",
      "Kategori kaydırıcısı + tüm kategoriler mega bloğu",
      "Yeni gelenler, en çok satanlar, indirimdekiler vitrinleri",
      "Geri sayımlı günün fırsatı ve ücretsiz kargo çubuğu",
      "Marka şeridi, avantaj ikonları, sayaçlar",
      "Ürün yorumları, müşteri görüşleri, sosyal galeri",
      "Blog bloğu, bülten kaydı ve güven rozetleri",
    ],
  },
  theme: {
    primaryColor: "#111318",
    accentColor: "#ff4545",
    backgroundColor: "#ffffff",
    fontPair: "archivo-hind",
    radius: 0.5,
    layout: "hero-grid",
    buttonStyle: "solid",
    cardStyle: "bordered",
    contentWidth: 1680,
    sectionSpacing: 32,
    heroTitle: "Her kategoride binlerce ürün",
    heroSubtitle:
      "Elektronikten modaya, ev yaşamından aksesuara kadar tüm koleksiyonlar tek mağazada. Aynı gün kargo, güvenli ödeme.",
    heroCtaLabel: "Alışverişe Başla",
    announcement: "Bugüne özel: 750 TL üzeri siparişlerde ücretsiz kargo · Kupon: WOKIEE10",
    showAnnouncement: true,
  },
  sections: [
    {
      type: "announcement_bar",
      settings: {
        text: "Bugüne özel: 750 TL üzeri siparişlerde ücretsiz kargo · Kupon: WOKIEE10",
        linkLabel: "Fırsatları gör",
        linkUrl: "#urunler",
        tone: "primary",
      },
    },
    {
      type: "header",
      settings: {
        sticky: true,
        showSearch: true,
        showFavorites: true,
        showCart: true,
        tagline: "Çok kategorili alışveriş merkezi",
      },
    },
    {
      type: "hero_slider",
      settings: {
        items:
          "Yeni sezon teknoloji | Kulaklık, akıllı saat ve aksesuarlarda %40'a varan indirim | /themes/wokiee/hero-tech.jpg | Alışverişe Başla | #urunler\nEv & yaşam | Mutfaktan dekorasyona binlerce ürün tek yerde | /themes/wokiee/hero-home.jpg | Koleksiyonu Gör | #koleksiyonlar\nHaftanın fırsatları | Seçili moda ürünlerinde sepette ekstra indirim | /themes/wokiee/hero-fashion.jpg | Fırsatları Yakala | #urunler",
        height: 620,
        autoplay: true,
        interval: 5,
      },
    },
    {
      type: "banner_color_grid",
      settings: {
        title: "Öne çıkan kampanyalar",
        items:
          "Teknoloji | %40'a varan indirim | #urunler\nModa | Yeni sezon parçalar | #urunler\nEv & Yaşam | Sepette ekstra %15 | #urunler\nAksesuar | 2 al 1 öde | #urunler",
        columns: 4,
      },
    },
    { type: "free_shipping_bar", settings: { threshold: 750, text: "{tutar} ve üzeri siparişlerde kargo ücretsiz", tone: "soft" } },
    { type: "category_slider", settings: { title: "Kategorilerde gezin", limit: 12, cardWidth: 200 } },
    { type: "product_new", settings: { title: "Yeni gelenler", limit: 8, columns: 4 } },
    {
      type: "banner_split",
      settings: {
        leftTitle: "Günün fırsatı",
        leftText: "Stoklar tükenmeden yakala",
        leftImage: "/themes/wokiee/p-headphones.jpg",
        leftUrl: "#urunler",
        rightTitle: "Çok satanlar",
        rightText: "Müşterilerin favorileri",
        rightImage: "/themes/wokiee/p-sneaker.jpg",
        rightUrl: "#urunler",
        height: 300,
      },
    },
    { type: "product_bestsellers", settings: { title: "En çok satanlar", limit: 8, columns: 4, layout: "slider" } },
    {
      type: "countdown",
      settings: {
        title: "Günün fırsatı bitiyor",
        text: "Seçili ürünlerde geri sayım sürüyor, kaçırma.",
        ctaLabel: "Fırsatları gör",
        ctaUrl: "#urunler",
      },
    },
    { type: "product_discounted", settings: { title: "İndirimdekiler", limit: 8, columns: 4, showBadge: true } },
    {
      type: "icon_boxes",
      settings: {
        title: "Neden bizden alışveriş?",
        items:
          "🚚 | Hızlı teslimat | Aynı gün kargo, 1-3 günde kapında\n🔒 | Güvenli ödeme | 3D Secure ve taksit imkânı\n↩️ | 14 gün iade | Koşulsuz cayma hakkı\n💬 | Canlı destek | Hafta içi 09:00-18:00",
        columns: 4,
      },
    },
    { type: "featured_collection", settings: { title: "Editörün seçimi", collectionSlug: "", limit: 4, columns: 4, ctaLabel: "Tümünü gör" } },
    {
      type: "brands",
      settings: {
        title: "Öne çıkan markalar",
        items:
          "Aurora | | #urunler\nNova | | #urunler\nBreeze | | #urunler\nStudio | | #urunler\nMilano | | #urunler\nBarista | | #urunler",
        columns: 6,
      },
    },
    {
      type: "counters",
      settings: {
        title: "Rakamlarla mağaza",
      },
    },
    { type: "product_grid", settings: { title: "Tüm ürünler", limit: 16, columns: 4, showSearch: true, showPrice: true } },
    { type: "reviews", settings: { title: "Ürün yorumları" } },
    {
      type: "testimonials",
      settings: {
        title: "Müşterilerimiz ne diyor?",
        items:
          "Siparişim ertesi gün elimdeydi, paketleme çok özenliydi. | Ahmet Y.\nFiyat/performans olarak en iyi seçenek, tekrar alacağım. | Büşra K.\nİade sürecini tek tıkla tamamladım, çok pratik. | Emre D.\nÜrün çeşitliliği inanılmaz, aradığım her şeyi buldum. | Nazlı T.",
        columns: 4,
      },
    },
    {
      type: "gallery",
      settings: {
        title: "Instagram'da biz",
        images:
          "/themes/wokiee/p-sneaker.jpg\n/themes/wokiee/p-sweater.jpg\n/themes/wokiee/p-bag.jpg\n/themes/wokiee/p-lamp.jpg\n/themes/wokiee/p-coffee.jpg\n/themes/wokiee/p-sunglasses.jpg",
        columns: 6,
        height: 240,
      },
    },
    { type: "blog", settings: { title: "Blog & rehberler", limit: 3, columns: 3 } },
    {
      type: "trust_badges",
      settings: {
        items:
          "🔐 | Güvenli ödeme | 256-bit SSL & 3D Secure\n📦 | Kargo takibi | Anlık sipariş durumu\n🎧 | 7/24 yardım | Destek merkezi ve canlı sohbet",
        columns: 3,
      },
    },
    {
      type: "newsletter",
      settings: {
        title: "Kampanyaları ilk sen öğren",
        text: "Bültene katıl, indirim kuponlarını ve yeni ürünleri kaçırma.",
        buttonLabel: "Kaydol",
      },
    },
    {
      type: "footer",
      settings: {
        showLegalLinks: true,
        showPages: true,
        about: "Her kategoride binlerce ürün, güvenli ödeme ve hızlı teslimat.",
      },
    },
  ],
};

export const THEME_TEMPLATES: ThemeTemplate[] = [WOKIEE, BE_YOURS, ATELIER_MODE];

export const TEMPLATE_BY_CODE = new Map(THEME_TEMPLATES.map((template) => [template.code, template]));
