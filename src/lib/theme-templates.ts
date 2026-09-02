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

export const THEME_TEMPLATES: ThemeTemplate[] = [BE_YOURS];

export const TEMPLATE_BY_CODE = new Map(THEME_TEMPLATES.map((template) => [template.code, template]));
