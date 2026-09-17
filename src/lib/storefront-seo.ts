import {
  absoluteUrl,
  breadcrumbSchema,
  buildSeoHead,
  buildTitle,
  jsonLdScript,
  renderSeoTemplate,
  localBusinessSchema,
  organizationSchema,
  websiteSchema,
  type BreadcrumbItem,
  type SeoFields,
} from "@/lib/seo";
import type { StoreSeoContext } from "@/lib/seo-public.functions";

/**
 * Vitrin rotaları için ortak head üreticisi: meta + canonical + Open Graph +
 * Twitter Card + Breadcrumb ve mağaza düzeyinde Organization / LocalBusiness /
 * WebSite yapısal verileri.
 */

export type StorefrontHeadInput = {
  ctx: StoreSeoContext | null;
  origin?: string | null;
  slug: string;
  path: string;
  fallbackTitle: string;
  fallbackDescription: string;
  seo?: SeoFields | null;
  image?: string | null;
  ogType?: "website" | "product" | "article";
  breadcrumbs?: BreadcrumbItem[];
  /** Mağaza panelindeki meta şablon anahtarı. */
  templateKey?: "product" | "collection" | "page" | "blog";
  /** Şablon token değerleri: product_name, collection_name, page_title vb. */
  tokens?: Record<string, string | number | null | undefined>;
  schemas?: unknown[];
  includeStoreSchema?: boolean;
};

/** Mağaza düzeyinde Organization / LocalBusiness / WebSite şemaları. */
export function storeSchemas(ctx: StoreSeoContext, origin?: string | null) {
  const base = absoluteUrl(`/s/${ctx.storeSlug}`, origin);
  const logo = ctx.logoUrl ? absoluteUrl(ctx.logoUrl, origin) : null;
  const organization = organizationSchema({
    name: ctx.storeName,
    url: base,
    logo,
    legalName: ctx.legalName,
    email: ctx.contactEmail,
    phone: ctx.contactPhone,
    sameAs: ctx.social,
    description: ctx.settings.homeDescription ?? null,
  });

  const schemas: unknown[] = [organization, websiteSchema(ctx.storeName, base, "/search")];

  if (ctx.settings.localBusinessEnabled) {
    schemas.push(
      localBusinessSchema({
        name: ctx.storeName,
        url: base,
        logo,
        email: ctx.contactEmail,
        phone: ctx.contactPhone,
        legalName: ctx.legalName,
        street: ctx.address.street ?? null,
        city: ctx.address.city ?? null,
        region: ctx.address.region ?? null,
        postalCode: ctx.address.postalCode ?? null,
        country: ctx.address.country ?? null,
        priceRange: ctx.settings.priceRange ?? null,
        latitude: ctx.settings.latitude ?? null,
        longitude: ctx.settings.longitude ?? null,
        ...(ctx.settings.businessType ? { businessType: ctx.settings.businessType } : {}),
        ...(ctx.settings.openingHours?.length ? { openingHours: ctx.settings.openingHours } : {}),
        ...(ctx.settings.organizationSameAs?.length ? { sameAs: ctx.settings.organizationSameAs } : {}),
      }),
    );
  }

  return schemas;
}

/** Tüm vitrin sayfaları için head nesnesi üretir. */
export function storefrontHead(input: StorefrontHeadInput) {
  const ctx = input.ctx;
  const storeName = ctx?.storeName;
  const seo = input.seo ?? {};
  const path = seo.canonical || input.path;

  // Mağaza panelindeki meta şablonları (Ürün / Koleksiyon / Sayfa / Blog),
  // içerik için özel başlık veya açıklama girilmediğinde otomatik uygulanır.
  const template = input.templateKey ? ctx?.settings.templates?.[input.templateKey] : undefined;
  const tokens = { store_name: storeName ?? "", ...(input.tokens ?? {}) };
  const templateTitle = renderSeoTemplate(template?.title, tokens);
  const templateDescription = renderSeoTemplate(template?.description, tokens);

  const title = seo.title || templateTitle || buildTitle(input.fallbackTitle, storeName);
  const description = seo.description || templateDescription || input.fallbackDescription;
  const image = seo.ogImage || input.image || ctx?.settings.defaultOgImage || ctx?.logoUrl || null;
  const noindex = Boolean(seo.noindex || ctx?.settings.noindexStore);
  const keywords = seo.keywords || ctx?.settings.keywords;

  const head = buildSeoHead({
    title,
    description,
    canonicalPath: path,
    origin: input.origin,
    image,
    ogType: input.ogType ?? "website",
    locale: "tr_TR",
    ...(storeName ? { siteName: storeName } : {}),
    ...(keywords ? { keywords } : {}),
    ...(noindex ? { noindex: true } : {}),
  });

  const schemas: unknown[] = [];
  if (ctx && input.includeStoreSchema !== false) schemas.push(...storeSchemas(ctx, input.origin));
  if (input.breadcrumbs?.length) schemas.push(breadcrumbSchema(input.breadcrumbs, input.origin));
  for (const schema of input.schemas ?? []) schemas.push(schema);

  return {
    meta: head.meta,
    links: [
      ...head.links,
      {
        rel: "sitemap",
        type: "application/xml",
        href: `/api/public/sitemap/${input.slug}`,
      },
    ],
    scripts: schemas.map((schema) => jsonLdScript(schema)),
  };
}

/**
 * Kolay Panel (micro) vitrinleri için başlık/açıklama yardımcıları: mağaza adı,
 * şehir ve ürün kategorisi bilgisiyle arama sonuçlarında ayırt edici metin üretir.
 */
export function microStoreSeoText(ctx: StoreSeoContext | null, storeName: string) {
  const city = ctx?.address.city ?? null;
  const place = city ? `${city}'dan ` : "";
  return {
    title: `${storeName} — El Yapımı Ürünler${city ? ` | ${city}` : ""}`,
    description: `${place}${storeName} vitrini: el yapımı ve ev üretimi ürünler, güncel fiyat ve stok bilgisiyle. WhatsApp veya kartla güvenli sipariş verin.`,
  };
}

/** "Mağaza bulunamadı" gibi durumlar için indekslenmeyen head. */
export function missingHead(title: string) {
  return { meta: [{ title }, { name: "robots", content: "noindex, nofollow" }] };
}
