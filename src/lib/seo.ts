/**
 * Mefticaret SEO çekirdeği: meta etiketi, canonical, Open Graph, Twitter Card
 * ve Schema.org (Product, Organization, LocalBusiness, Breadcrumb, Article, FAQ)
 * üretimi. Hem vitrin rotaları hem SEO editörü bu yardımcıları kullanır.
 */

export const SEO_TITLE_MAX = 60;
export const SEO_DESCRIPTION_MAX = 160;

export type SeoFields = {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  noindex?: boolean;
};

/** Bilinmeyen JSONB değerini güvenli SEO nesnesine çevirir. */
export function readSeo(value: unknown): SeoFields {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const text = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string).trim() : "");
  const fields: SeoFields = {};
  const title = text("title");
  const description = text("description");
  const keywords = text("keywords");
  const canonical = text("canonical");
  const ogImage = text("ogImage") || text("og_image");
  if (title) fields.title = title;
  if (description) fields.description = description;
  if (keywords) fields.keywords = keywords;
  if (canonical) fields.canonical = canonical;
  if (ogImage) fields.ogImage = ogImage;
  if (raw['noindex'] === true) fields.noindex = true;
  return fields;
}

/** HTML etiketlerini temizler ve metni tek satıra indirir. */
export function plainText(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Meta açıklamasını sınıra göre kelime bütünlüğünü koruyarak kısaltır. */
export function clampDescription(value: string | null | undefined, max = SEO_DESCRIPTION_MAX) {
  const text = plainText(value);
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

/** "Sayfa — Mağaza" başlığını sınıra göre kurar. */
export function buildTitle(page: string, storeName?: string, max = SEO_TITLE_MAX) {
  const pageText = plainText(page);
  if (!storeName) return pageText.slice(0, max);
  const combined = `${pageText} — ${storeName}`;
  return combined.length <= max ? combined : pageText.slice(0, max);
}

/** Göreli yolu, biliniyorsa mutlak adrese çevirir. */
export function absoluteUrl(path: string, origin?: string | null) {
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin.replace(/\/$/, "")}${clean}` : clean;
}

export type MetaTag = Record<string, string>;

export type SeoInput = {
  title: string;
  description: string;
  canonicalPath: string;
  origin?: string | null | undefined;
  image?: string | null;
  keywords?: string;
  noindex?: boolean;
  ogType?: "website" | "product" | "article";
  siteName?: string;
  locale?: string;
};

/** Rota head() içinde kullanılacak meta + link listesini üretir. */
export function buildSeoHead(input: SeoInput): { meta: MetaTag[]; links: MetaTag[] } {
  const title = plainText(input.title).slice(0, 120);
  const description = clampDescription(input.description);
  const canonical = absoluteUrl(input.canonicalPath, input.origin);
  const image = input.image ? absoluteUrl(input.image, input.origin) : null;

  const meta: MetaTag[] = [
    { title },
    { name: "description", content: description },
    {
      name: "robots",
      content: input.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large",
    },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: input.ogType ?? "website" },
    { property: "og:url", content: canonical },
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];

  if (input.siteName) meta.push({ property: "og:site_name", content: input.siteName });
  if (input.locale) meta.push({ property: "og:locale", content: input.locale });
  if (input.keywords) meta.push({ name: "keywords", content: input.keywords });
  if (image) {
    meta.push({ property: "og:image", content: image });
    meta.push({ name: "twitter:image", content: image });
  }

  return { meta, links: [{ rel: "canonical", href: canonical }] };
}

/** JSON-LD betiğini head().scripts formatında döner. */
export function jsonLdScript(data: unknown) {
  return { type: "application/ld+json", children: JSON.stringify(data) };
}

export type BreadcrumbItem = { name: string; path: string };

/** Breadcrumb (kırıntı navigasyon) yapısal verisi. */
export function breadcrumbSchema(items: BreadcrumbItem[], origin?: string | null) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, origin),
    })),
  };
}

export type OrganizationInput = {
  name: string;
  url: string;
  logo?: string | null;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  sameAs?: string[];
  description?: string | null;
};

/** Organization yapısal verisi. */
export function organizationSchema(input: OrganizationInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: input.url,
    ...(input.legalName ? { legalName: input.legalName } : {}),
    ...(input.logo ? { logo: input.logo } : {}),
    ...(input.description ? { description: clampDescription(input.description, 300) } : {}),
    ...(input.sameAs?.length ? { sameAs: input.sameAs } : {}),
    ...(input.email || input.phone
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            ...(input.email ? { email: input.email } : {}),
            ...(input.phone ? { telephone: input.phone } : {}),
          },
        }
      : {}),
  };
}

export type LocalBusinessInput = OrganizationInput & {
  businessType?: string;
  street?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  priceRange?: string | null;
  openingHours?: string[];
  latitude?: number | null;
  longitude?: number | null;
};

/** LocalBusiness yapısal verisi (fiziksel mağaza / şube). */
export function localBusinessSchema(input: LocalBusinessInput) {
  const hasAddress = Boolean(input.street || input.city || input.postalCode);
  return {
    "@context": "https://schema.org",
    "@type": input.businessType?.trim() || "LocalBusiness",
    name: input.name,
    url: input.url,
    ...(input.logo ? { image: input.logo } : {}),
    ...(input.phone ? { telephone: input.phone } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.priceRange ? { priceRange: input.priceRange } : {}),
    ...(hasAddress
      ? {
          address: {
            "@type": "PostalAddress",
            ...(input.street ? { streetAddress: input.street } : {}),
            ...(input.city ? { addressLocality: input.city } : {}),
            ...(input.region ? { addressRegion: input.region } : {}),
            ...(input.postalCode ? { postalCode: input.postalCode } : {}),
            ...(input.country ? { addressCountry: input.country } : {}),
          },
        }
      : {}),
    ...(typeof input.latitude === "number" && typeof input.longitude === "number"
      ? { geo: { "@type": "GeoCoordinates", latitude: input.latitude, longitude: input.longitude } }
      : {}),
    ...(input.openingHours?.length ? { openingHoursSpecification: input.openingHours } : {}),
  };
}

export type ProductSchemaInput = {
  name: string;
  description: string;
  url: string;
  images: string[];
  price: number;
  currency: string;
  inStock: boolean;
  brand?: string | null;
  sku?: string | null;
  barcode?: string | null;
  ratingValue?: number;
  reviewCount?: number;
  sellerName?: string | null;
  category?: string | null;
};

/** Product yapısal verisi (Offer + AggregateRating dahil). */
export function productSchema(input: ProductSchemaInput) {
  // Google ürün sonuçları fiyat geçerlilik tarihi ister; fiyat gece güncellenir, bir yıl ileri verilir.
  const validUntil = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.name,
    description: clampDescription(input.description, 400),
    url: input.url,
    ...(input.images.length ? { image: input.images } : {}),
    ...(input.sku ? { sku: input.sku, mpn: input.sku } : {}),
    ...(input.barcode ? { gtin: input.barcode } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.brand ? { brand: { "@type": "Brand", name: input.brand } } : {}),
    offers: {
      "@type": "Offer",
      url: input.url,
      price: input.price,
      priceCurrency: input.currency,
      priceValidUntil: validUntil,
      itemCondition: "https://schema.org/NewCondition",
      availability: input.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      ...(input.sellerName ? { seller: { "@type": "Organization", name: input.sellerName } } : {}),
    },
    ...(input.reviewCount && input.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number((input.ratingValue ?? 0).toFixed(2)),
            reviewCount: input.reviewCount,
          },
        }
      : {}),
  };
}

export type ArticleSchemaInput = {
  headline: string;
  description: string;
  url: string;
  image?: string | null;
  author?: string | null;
  publisher: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
};

/** Article yapısal verisi (blog yazıları). */
export function articleSchema(input: ArticleSchemaInput) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: plainText(input.headline).slice(0, 110),
    description: clampDescription(input.description, 300),
    mainEntityOfPage: { "@type": "WebPage", "@id": input.url },
    ...(input.image ? { image: [input.image] } : {}),
    author: { "@type": input.author ? "Person" : "Organization", name: input.author || input.publisher },
    publisher: { "@type": "Organization", name: input.publisher },
    ...(input.publishedAt ? { datePublished: input.publishedAt } : {}),
    ...(input.updatedAt ? { dateModified: input.updatedAt } : {}),
  };
}

export type FaqEntry = { question: string; answer: string };

/** FAQPage yapısal verisi. */
export function faqSchema(entries: FaqEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries
      .filter((entry) => entry.question.trim() && entry.answer.trim())
      .map((entry) => ({
        "@type": "Question",
        name: plainText(entry.question),
        acceptedAnswer: { "@type": "Answer", text: plainText(entry.answer) },
      })),
  };
}

/** WebSite yapısal verisi + site içi arama eylemi. */
export function websiteSchema(name: string, url: string, searchPath?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
    ...(searchPath
      ? {
          potentialAction: {
            "@type": "SearchAction",
            target: `${url.replace(/\/$/, "")}${searchPath}?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }
      : {}),
  };
}

/** Mağaza SEO ayarları (store_settings.seo JSONB) şeması. */
export type StoreSeoUrlStructure = {
  product?: "product" | "category-product" | "short";
  collection?: "collection" | "short";
  page?: "page" | "short";
  blog?: "blog" | "page";
  htmlExtension?: boolean;
  localePrefix?: boolean;
};

export type SeoTemplate = { title?: string; description?: string };

export type StoreSeoSettings = {
  homeTitle?: string;
  homeDescription?: string;
  keywords?: string;
  defaultOgImage?: string;
  noindexStore?: boolean;
  robotsExtra?: string;
  organizationSameAs?: string[];
  localBusinessEnabled?: boolean;
  businessType?: string;
  priceRange?: string;
  openingHours?: string[];
  latitude?: number | null;
  longitude?: number | null;
  faq?: FaqEntry[];
  urlStructure?: StoreSeoUrlStructure;
  templates?: Record<string, SeoTemplate>;
};

/** store_settings.seo alanını güvenli yapıya çevirir. */
export function readStoreSeo(value: unknown): StoreSeoSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const str = (key: string) => (typeof raw[key] === "string" ? (raw[key] as string) : undefined);
  const list = (key: string) =>
    Array.isArray(raw[key])
      ? (raw[key] as unknown[]).filter((item): item is string => typeof item === "string")
      : undefined;

  const faq = Array.isArray(raw['faq'])
    ? (raw['faq'] as unknown[]).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const entry = item as Record<string, unknown>;
        const question = typeof entry['question'] === "string" ? entry['question'] : "";
        const answer = typeof entry['answer'] === "string" ? entry['answer'] : "";
        return question && answer ? [{ question, answer }] : [];
      })
    : undefined;

  const settings: StoreSeoSettings = {};
  const homeTitle = str("homeTitle") ?? str("title");
  const homeDescription = str("homeDescription") ?? str("description");
  if (homeTitle) settings.homeTitle = homeTitle;
  if (homeDescription) settings.homeDescription = homeDescription;
  const keywords = str("keywords");
  if (keywords) settings.keywords = keywords;
  const ogImage = str("defaultOgImage");
  if (ogImage) settings.defaultOgImage = ogImage;
  if (raw['noindexStore'] === true) settings.noindexStore = true;
  const robotsExtra = str("robotsExtra");
  if (robotsExtra) settings.robotsExtra = robotsExtra;
  const sameAs = list("organizationSameAs");
  if (sameAs) settings.organizationSameAs = sameAs;
  if (raw['localBusinessEnabled'] === true) settings.localBusinessEnabled = true;
  const businessType = str("businessType");
  if (businessType) settings.businessType = businessType;
  const priceRange = str("priceRange");
  if (priceRange) settings.priceRange = priceRange;
  const hours = list("openingHours");
  if (hours) settings.openingHours = hours;
  if (typeof raw['latitude'] === "number") settings.latitude = raw['latitude'];
  if (typeof raw['longitude'] === "number") settings.longitude = raw['longitude'];
  if (faq) settings.faq = faq;

  const structure = raw['urlStructure'];
  if (structure && typeof structure === "object" && !Array.isArray(structure)) {
    const value = structure as Record<string, unknown>;
    const product = value['product'];
    const collection = value['collection'];
    const page = value['page'];
    const blog = value['blog'];
    settings.urlStructure = {
      ...(product === "product" || product === "category-product" || product === "short" ? { product } : {}),
      ...(collection === "collection" || collection === "short" ? { collection } : {}),
      ...(page === "page" || page === "short" ? { page } : {}),
      ...(blog === "blog" || blog === "page" ? { blog } : {}),
      ...(typeof value['htmlExtension'] === "boolean" ? { htmlExtension: value['htmlExtension'] } : {}),
      ...(typeof value['localePrefix'] === "boolean" ? { localePrefix: value['localePrefix'] } : {}),
    };
  }

  const templates = raw['templates'];
  if (templates && typeof templates === "object" && !Array.isArray(templates)) {
    const parsed: Record<string, SeoTemplate> = {};
    for (const [key, value] of Object.entries(templates as Record<string, unknown>)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const item = value as Record<string, unknown>;
      const title = typeof item['title'] === "string" ? item['title'].trim() : undefined;
      const description = typeof item['description'] === "string" ? item['description'].trim() : undefined;
      if (title || description) parsed[key] = { ...(title ? { title } : {}), ...(description ? { description } : {}) };
    }
    if (Object.keys(parsed).length) settings.templates = parsed;
  }
  return settings;
}

/** Google sonuç önizlemesi için kısaltılmış görünüm metinleri. */
export function serpPreview(title: string, description: string, url: string) {
  return {
    title: title.length > SEO_TITLE_MAX ? `${title.slice(0, SEO_TITLE_MAX - 1)}…` : title,
    description: clampDescription(description),
    url,
    titleLength: title.length,
    descriptionLength: plainText(description).length,
    titleOk: title.length >= 20 && title.length <= SEO_TITLE_MAX,
    descriptionOk:
      plainText(description).length >= 70 && plainText(description).length <= SEO_DESCRIPTION_MAX,
  };
}

/**
 * Mağaza SEO şablonlarındaki {{token}} alanlarını gerçek içerik değerleriyle
 * doldurur. Boş kalan token'lar temizlenir; sonuç boşsa null döner.
 */
export function renderSeoTemplate(
  template: string | undefined | null,
  tokens: Record<string, string | number | null | undefined>,
): string | null {
  if (!template || !template.trim()) return null;
  const filled = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = tokens[key];
    return value === null || value === undefined ? "" : String(value);
  });
  const cleaned = filled
    .replace(/\s{2,}/g, " ")
    .replace(/\s*([|–-])\s*(?=$|[|–-])/g, "")
    .replace(/^[\s|–-]+|[\s|–-]+$/g, "")
    .trim();
  return cleaned.length > 0 ? cleaned : null;
}
