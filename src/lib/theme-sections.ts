/**
 * Modüler tema bileşen kayıt defteri (registry).
 *
 * Her bileşen tipi; şema alanlarını, varsayılan ayarlarını ve vitrinde nasıl
 * konumlanacağını (chrome/body) burada tanımlar. Yeni bir bileşen eklemek için
 * yalnızca bu dosyaya bir kayıt eklemek ve `storefront-sections.tsx` içinde
 * karşılığını render etmek yeterlidir.
 */

import { EXTENDED_SECTIONS, type ExtendedSectionType } from "@/lib/theme-blocks";

export type CoreSectionType =
  | "header"
  | "footer"
  | "announcement_bar"
  | "hero"
  | "banner"
  | "product_grid"
  | "product_slider"
  | "category_grid"
  | "image_text"
  | "testimonials"
  | "faq"
  | "blog"
  | "newsletter"
  | "custom_html";

export type ThemeSectionType = CoreSectionType | ExtendedSectionType;

export type SectionCategory =
  | "layout"
  | "hero"
  | "banner"
  | "product"
  | "category"
  | "content"
  | "marketing"
  | "commerce";

export const SECTION_CATEGORIES: { value: SectionCategory; label: string }[] = [
  { value: "layout", label: "Yerleşim" },
  { value: "hero", label: "Hero / Slider" },
  { value: "banner", label: "Banner" },
  { value: "product", label: "Ürün" },
  { value: "category", label: "Kategori" },
  { value: "content", label: "İçerik" },
  { value: "marketing", label: "Pazarlama" },
  { value: "commerce", label: "E-ticaret" },
];

export type SectionFieldKind = "text" | "textarea" | "number" | "boolean" | "select" | "code" | "lines";

export type SectionField = {
  key: string;
  label: string;
  kind: SectionFieldKind;
  help?: string;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  placeholder?: string;
};

export type SectionSettings = Record<string, string | number | boolean>;

export type ThemeSectionDefinition = {
  type: ThemeSectionType;
  label: string;
  category: SectionCategory;
  description: string;
  /** chrome bileşenleri sayfa gövdesinin dışında (üst/alt) render edilir. */
  slot: "chrome" | "body";
  /** Aynı bileşen birden fazla kez eklenebilir mi? */
  repeatable: boolean;
  defaults: SectionSettings;
  fields: SectionField[];
};

const alignField: SectionField = {
  key: "align",
  label: "Hizalama",
  kind: "select",
  options: [
    { value: "left", label: "Sola" },
    { value: "center", label: "Ortaya" },
  ],
};

const CORE_SECTIONS: ThemeSectionDefinition[] = [
  {
    type: "announcement_bar",
    category: "layout",
    label: "Duyuru çubuğu",
    description: "Sayfanın en üstünde kampanya veya kargo duyurusu şeridi.",
    slot: "chrome",
    repeatable: false,
    defaults: { text: "Tüm siparişlerde kargo bedava", linkLabel: "", linkUrl: "", tone: "accent" },
    fields: [
      { key: "text", label: "Duyuru metni", kind: "text" },
      { key: "linkLabel", label: "Bağlantı metni", kind: "text", placeholder: "Detaylar" },
      { key: "linkUrl", label: "Bağlantı adresi", kind: "text", placeholder: "/s/magazam/products" },
      {
        key: "tone",
        label: "Renk tonu",
        kind: "select",
        options: [
          { value: "accent", label: "Vurgu rengi" },
          { value: "primary", label: "Ana renk" },
          { value: "soft", label: "Yumuşak" },
        ],
      },
    ],
  },
  {
    type: "header",
    category: "layout",
    label: "Header",
    description: "Üst menü: logo, gezinme bağlantıları, arama ve sepet.",
    slot: "chrome",
    repeatable: false,
    defaults: { showSearch: true, showCart: true, showFavorites: true, sticky: true, tagline: "" },
    fields: [
      { key: "sticky", label: "Sayfa kaydırılınca sabit kalsın", kind: "boolean" },
      { key: "showSearch", label: "Arama bağlantısı", kind: "boolean" },
      { key: "showFavorites", label: "Favoriler bağlantısı", kind: "boolean" },
      { key: "showCart", label: "Sepet bağlantısı", kind: "boolean" },
      { key: "tagline", label: "Logo altı slogan", kind: "text" },
    ],
  },
  {
    type: "hero",
    category: "hero",
    label: "Hero alanı",
    description: "Ana sayfanın en üstündeki büyük tanıtım alanı.",
    slot: "body",
    repeatable: false,
    defaults: {
      title: "Yeni sezon burada",
      subtitle: "Seçkin parçalar, hızlı teslimat, güvenli ödeme.",
      ctaLabel: "Koleksiyonu keşfet",
      ctaUrl: "#urunler",
      imageUrl: "",
      align: "left",
      height: 420,
    },
    fields: [
      { key: "title", label: "Başlık", kind: "text" },
      { key: "subtitle", label: "Alt başlık", kind: "textarea" },
      { key: "ctaLabel", label: "Buton metni", kind: "text" },
      { key: "ctaUrl", label: "Buton adresi", kind: "text" },
      { key: "imageUrl", label: "Görsel adresi", kind: "text", help: "Boş bırakılırsa tema gradyanı kullanılır." },
      alignField,
      { key: "height", label: "Yükseklik (px)", kind: "number", min: 240, max: 720 },
    ],
  },
  {
    type: "banner",
    category: "banner",
    label: "Banner",
    description: "Kampanya görseli veya tek satır çağrı bandı.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Sezon sonu %40 indirim",
      text: "Stoklar tükenmeden yeni koleksiyonu keşfet.",
      ctaLabel: "İncele",
      ctaUrl: "#urunler",
      imageUrl: "",
      style: "gradient",
    },
    fields: [
      { key: "title", label: "Başlık", kind: "text" },
      { key: "text", label: "Metin", kind: "textarea" },
      { key: "ctaLabel", label: "Buton metni", kind: "text" },
      { key: "ctaUrl", label: "Buton adresi", kind: "text" },
      { key: "imageUrl", label: "Arka plan görseli", kind: "text" },
      {
        key: "style",
        label: "Görünüm",
        kind: "select",
        options: [
          { value: "gradient", label: "Gradyan" },
          { value: "outline", label: "Çerçeveli" },
          { value: "solid", label: "Dolgu" },
        ],
      },
    ],
  },
  {
    type: "product_grid",
    category: "product",
    label: "Ürün grid",
    description: "Ürünleri ızgara düzeninde listeler.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Ürünler", collectionSlug: "", limit: 12, columns: 4, showSearch: true, showPrice: true },
    fields: [
      { key: "title", label: "Başlık", kind: "text" },
      { key: "collectionSlug", label: "Koleksiyon (slug)", kind: "text", help: "Boş: tüm ürünler." },
      { key: "limit", label: "Ürün sayısı", kind: "number", min: 2, max: 48 },
      { key: "columns", label: "Kolon sayısı", kind: "number", min: 2, max: 5 },
      { key: "showSearch", label: "Arama kutusu", kind: "boolean" },
      { key: "showPrice", label: "Fiyat göster", kind: "boolean" },
    ],
  },
  {
    type: "product_slider",
    category: "product",
    label: "Ürün slider",
    description: "Yatay kaydırmalı ürün şeridi.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Öne çıkanlar", collectionSlug: "", limit: 10, cardWidth: 240 },
    fields: [
      { key: "title", label: "Başlık", kind: "text" },
      { key: "collectionSlug", label: "Koleksiyon (slug)", kind: "text" },
      { key: "limit", label: "Ürün sayısı", kind: "number", min: 2, max: 30 },
      { key: "cardWidth", label: "Kart genişliği (px)", kind: "number", min: 160, max: 360 },
    ],
  },
  {
    type: "category_grid",
    category: "category",
    label: "Kategori grid",
    description: "Koleksiyon veya ürün tiplerini kart olarak gösterir.",
    slot: "body",
    repeatable: true,
    defaults: { title: "Kategoriler", source: "collections", limit: 8, columns: 4 },
    fields: [
      { key: "title", label: "Başlık", kind: "text" },
      {
        key: "source",
        label: "Kaynak",
        kind: "select",
        options: [
          { value: "collections", label: "Koleksiyonlar" },
          { value: "product_types", label: "Ürün tipleri" },
        ],
      },
      { key: "limit", label: "Kart sayısı", kind: "number", min: 2, max: 24 },
      { key: "columns", label: "Kolon sayısı", kind: "number", min: 2, max: 6 },
    ],
  },
  {
    type: "image_text",
    category: "content",
    label: "Görsel + metin",
    description: "Yan yana görsel ve anlatım bloğu.",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Atölyemizden",
      text: "Her parça sınırlı sayıda üretilir ve tek tek kontrol edilir.",
      imageUrl: "",
      imagePosition: "left",
      ctaLabel: "",
      ctaUrl: "",
    },
    fields: [
      { key: "title", label: "Başlık", kind: "text" },
      { key: "text", label: "Metin", kind: "textarea" },
      { key: "imageUrl", label: "Görsel adresi", kind: "text" },
      {
        key: "imagePosition",
        label: "Görsel konumu",
        kind: "select",
        options: [
          { value: "left", label: "Solda" },
          { value: "right", label: "Sağda" },
        ],
      },
      { key: "ctaLabel", label: "Buton metni", kind: "text" },
      { key: "ctaUrl", label: "Buton adresi", kind: "text" },
    ],
  },
  {
    type: "testimonials",
    category: "content",
    label: "Referanslar",
    description: "Müşteri yorumları. Her satır: Yorum | İsim",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Müşterilerimiz ne diyor?",
      items: "Kalitesi beklediğimden iyiydi, kargo çok hızlı geldi. | Elif K.\nİkinci siparişim, yine memnun kaldım. | Murat S.",
      columns: 3,
    },
    fields: [
      { key: "title", label: "Başlık", kind: "text" },
      { key: "items", label: "Yorumlar", kind: "lines", help: "Her satır: Yorum | İsim" },
      { key: "columns", label: "Kolon sayısı", kind: "number", min: 1, max: 4 },
    ],
  },
  {
    type: "faq",
    category: "content",
    label: "SSS",
    description: "Sıkça sorulan sorular akordiyonu. Her satır: Soru | Cevap",
    slot: "body",
    repeatable: true,
    defaults: {
      title: "Sıkça sorulan sorular",
      items:
        "Kargo ne kadar sürer? | Siparişler 1-3 iş günü içinde teslim edilir.\nİade yapabilir miyim? | 14 gün içinde koşulsuz iade hakkın var.",
    },
    fields: [
      { key: "title", label: "Başlık", kind: "text" },
      { key: "items", label: "Soru & cevaplar", kind: "lines", help: "Her satır: Soru | Cevap" },
    ],
  },
  {
    type: "blog",
    category: "content",
    label: "Blog",
    description: "Yayınlanmış mağaza yazılarından son kayıtlar.",
    slot: "body",
    repeatable: false,
    defaults: { title: "Günlük", limit: 3, columns: 3 },
    fields: [
      { key: "title", label: "Başlık", kind: "text" },
      { key: "limit", label: "Yazı sayısı", kind: "number", min: 1, max: 12 },
      { key: "columns", label: "Kolon sayısı", kind: "number", min: 1, max: 4 },
    ],
  },
  {
    type: "newsletter",
    category: "marketing",
    label: "Newsletter",
    description: "E-posta bülten kayıt formu.",
    slot: "body",
    repeatable: false,
    defaults: {
      title: "Kampanyaları ilk sen öğren",
      text: "E-posta listesine katıl, yeni koleksiyon ve indirimleri kaçırma.",
      buttonLabel: "Kaydol",
      successMessage: "Teşekkürler! Listeye eklendin.",
    },
    fields: [
      { key: "title", label: "Başlık", kind: "text" },
      { key: "text", label: "Metin", kind: "textarea" },
      { key: "buttonLabel", label: "Buton metni", kind: "text" },
      { key: "successMessage", label: "Başarı mesajı", kind: "text" },
    ],
  },
  {
    type: "custom_html",
    category: "content",
    label: "Özel HTML",
    description: "Kendi işaretlemeni ekle (script etiketleri temizlenir).",
    slot: "body",
    repeatable: true,
    defaults: { html: "<h2>Özel blok</h2>\n<p>Buraya kendi içeriğini yazabilirsin.</p>", maxWidth: 0 },
    fields: [
      { key: "html", label: "HTML", kind: "code" },
      { key: "maxWidth", label: "Maksimum genişlik (px, 0 = tam)", kind: "number", min: 0, max: 1400 },
    ],
  },
  {
    type: "footer",
    category: "layout",
    label: "Footer",
    description: "Alt bilgi: kurumsal bağlantılar, iletişim ve telif satırı.",
    slot: "chrome",
    repeatable: false,
    defaults: {
      about: "",
      email: "",
      phone: "",
      showLegalLinks: true,
      showPages: true,
      copyright: "",
    },
    fields: [
      { key: "about", label: "Kısa tanıtım", kind: "textarea" },
      { key: "email", label: "E-posta", kind: "text" },
      { key: "phone", label: "Telefon", kind: "text" },
      { key: "showLegalLinks", label: "Politika bağlantıları", kind: "boolean" },
      { key: "showPages", label: "Mağaza sayfaları", kind: "boolean" },
      { key: "copyright", label: "Telif satırı", kind: "text" },
    ],
  },
];

/** Her gövde bileşenine eklenen cihaz (masaüstü/tablet/mobil) ayarları. */
const RESPONSIVE_DEFAULTS: SectionSettings = {
  showOnDesktop: true,
  showOnTablet: true,
  showOnMobile: true,
  columnsTablet: 0,
  columnsMobile: 0,
};

const RESPONSIVE_FIELDS: SectionField[] = [
  { key: "showOnDesktop", label: "Masaüstünde göster", kind: "boolean" },
  { key: "showOnTablet", label: "Tablette göster", kind: "boolean" },
  { key: "showOnMobile", label: "Mobilde göster", kind: "boolean" },
  {
    key: "columnsTablet",
    label: "Tablet kolon sayısı",
    kind: "number",
    min: 0,
    max: 6,
    help: "0 = tema varsayılanını kullan.",
  },
  {
    key: "columnsMobile",
    label: "Mobil kolon sayısı",
    kind: "number",
    min: 0,
    max: 4,
    help: "0 = tema varsayılanını kullan.",
  },
];

export const RESPONSIVE_SETTING_KEYS = Object.keys(RESPONSIVE_DEFAULTS);

function withResponsive(definition: ThemeSectionDefinition): ThemeSectionDefinition {
  if (definition.slot === "chrome") return definition;
  return {
    ...definition,
    defaults: { ...definition.defaults, ...RESPONSIVE_DEFAULTS },
    fields: [...definition.fields, ...RESPONSIVE_FIELDS],
  };
}

export const THEME_SECTIONS: ThemeSectionDefinition[] = [...CORE_SECTIONS, ...EXTENDED_SECTIONS].map(withResponsive);


/** Kategoriye göre gruplanmış blok listesi (editör seçicisi için). */
export function sectionsByCategory(): { category: SectionCategory; label: string; items: ThemeSectionDefinition[] }[] {
  return SECTION_CATEGORIES.map((entry) => ({
    category: entry.value,
    label: entry.label,
    items: THEME_SECTIONS.filter((section) => section.category === entry.value),
  })).filter((group) => group.items.length > 0);
}

export const SECTION_BY_TYPE = new Map(THEME_SECTIONS.map((section) => [section.type, section]));

export type ThemeSectionRow = {
  id: string;
  store_id: string;
  type: string;
  position: number;
  is_enabled: boolean;
  settings: unknown;
};

export type ResolvedSection = {
  id: string;
  type: ThemeSectionType;
  position: number;
  isEnabled: boolean;
  settings: SectionSettings;
  definition: ThemeSectionDefinition;
};

function coerce(defaults: SectionSettings, raw: unknown): SectionSettings {
  const out: SectionSettings = { ...defaults };
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(key in defaults)) continue;
    const fallback = defaults[key];
    if (typeof fallback === "number") out[key] = Number.isFinite(Number(value)) ? Number(value) : fallback;
    else if (typeof fallback === "boolean") out[key] = Boolean(value);
    else out[key] = typeof value === "string" ? value : String(value ?? "");
  }
  return out;
}

/** Ham satırları tip güvenli, sıralı bileşen listesine çevirir. */
export function resolveSections(rows: ThemeSectionRow[] | null | undefined): ResolvedSection[] {
  return (rows ?? [])
    .map((row) => {
      const definition = SECTION_BY_TYPE.get(row.type as ThemeSectionType);
      if (!definition) return null;
      return {
        id: row.id,
        type: definition.type,
        position: row.position,
        isEnabled: row.is_enabled,
        settings: coerce(definition.defaults, row.settings),
        definition,
      } satisfies ResolvedSection;
    })
    .filter((row): row is ResolvedSection => row !== null)
    .sort((a, b) => a.position - b.position);
}

export function sectionLabel(type: string) {
  return SECTION_BY_TYPE.get(type as ThemeSectionType)?.label ?? type;
}

/** "Yorum | İsim" biçimindeki satırları çift listesine çevirir. */
export function parsePairs(value: unknown): { left: string; right: string }[] {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [left, ...rest] = line.split("|");
      return { left: (left ?? "").trim(), right: rest.join("|").trim() };
    });
}

/**
 * Özel HTML bloklarını render etmeden önce script/iframe ve inline event
 * niteliklerini temizler. Özel JavaScript ayrı ve bilinçli bir alandır.
 */
export function sanitizeHtml(html: string) {
  return html
    .replace(/<\s*(script|iframe|object|embed|link|meta)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|link|meta)[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

/** Vitrin bileşeni hiç tanımlanmamışsa kullanılacak varsayılan düzen. */
export const DEFAULT_SECTION_LAYOUT: ThemeSectionType[] = [
  "announcement_bar",
  "header",
  "hero",
  "category_grid",
  "product_grid",
  "newsletter",
  "footer",
];
