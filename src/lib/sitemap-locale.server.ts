import { readAllPages } from "@/lib/read-all-pages";
import { publicSupabase } from "@/lib/public-supabase.server";
import { readSeo, readStoreSeo } from "@/lib/seo";

/**
 * Dil bazlı site haritaları: /sitemap-tr.xml, /sitemap-en.xml, /sitemap-de.xml, /sitemap-ar.xml
 *
 * Her adres, o dilde gerçekten yayında olan içeriği gösterir:
 * - Türkçe: platform pazarlama sayfaları + tüm aktif mağaza vitrinleri (varsayılan dil)
 * - Diğer diller: yalnızca o dili `store_locales` içinde etkin eden mağazaların içerikleri
 *
 * Adresler `?lang=<dil>` parametresiyle üretilir; vitrin bu parametreyi okuyup
 * ilgili dili açar. Her `<url>` kaydına karşılıklı `xhtml:link hreflang` etiketleri
 * ve `x-default` (Türkçe) eklenir.
 */

const BASE_URL = "https://mefticaret.com";
const PAGE_SIZE = 1000;

export const SITEMAP_LOCALES = ["tr", "en", "de", "ar", "fr"] as const;
export type SitemapLocale = (typeof SITEMAP_LOCALES)[number];

const HREFLANG: Record<SitemapLocale, string> = {
  tr: "tr",
  en: "en",
  de: "de",
  ar: "ar",
  fr: "fr",
};

/** Platformun kendi (Türkçe) pazarlama sayfaları ve İngilizce karşılıkları. */
const PLATFORM_PATHS: Record<SitemapLocale, string[]> = {
  tr: [
    "/",
    "/e-ticaret-nasil-yapilir",
    "/e-ticaret-sitesi-kurma",
    "/e-ticaret-paketleri",
    "/e-ticaret-maliyeti",
    "/en-iyi-e-ticaret-altyapisi",
    "/kolay-panel-rehberi",
    "/dropshipping-nasil-yapilir",
    "/pazaryeri-entegrasyonu",
    "/seo-ve-raporlama",
    "/tedarikci-giris",
    "/supplier",
    "/ev-hanimlari",
    "/blog",
  ],
  en: ["/en", "/en/how-to-start-an-online-store", "/en/ev-hanimlari"],
  de: ["/de", "/de/ev-hanimlari"],
  ar: ["/ar", "/ar/ev-hanimlari"],
  fr: ["/fr", "/fr/ev-hanimlari"],
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Platform ana sayfalarının dil karşılıkları (ayrı adresler). */
const HOME_PATHS: Record<SitemapLocale, string> = {
  tr: "/",
  en: "/en",
  de: "/de",
  ar: "/ar",
  fr: "/fr",
};

/** Bir yolu, verilen dil için tam adrese çevirir (tr varsayılan: parametresiz). */
export function localeUrl(path: string, locale: SitemapLocale) {
  // Ana sayfa her dilde kendi adresine sahip.
  if (Object.values(HOME_PATHS).includes(path)) return `${BASE_URL}${HOME_PATHS[locale]}`;
  const url = `${BASE_URL}${path}`;
  // Dili yolunda taşıyan sayfalar (örn. /en/...) parametre almaz.
  if (locale === "tr" || /^\/(en|de|ar|fr)\//.test(path)) return url;
  return `${url}${path.includes("?") ? "&" : "?"}lang=${locale}`;
}

type Entry = {
  path: string;
  lastmod?: string | null;
  changefreq: string;
  priority: string;
  /** Bu içeriğin yayında olduğu diller (hreflang kümesi). */
  locales: SitemapLocale[];
};

function render(entries: Entry[], locale: SitemapLocale) {
  const body = entries
    .map((entry) => {
      const alternates = entry.locales
        .map(
          (alt) =>
            `    <xhtml:link rel="alternate" hreflang="${HREFLANG[alt]}" href="${escapeXml(localeUrl(entry.path, alt))}" />`,
        )
        .concat(
          entry.locales.includes("tr")
            ? [
                `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(localeUrl(entry.path, "tr"))}" />`,
              ]
            : [],
        );
      const lines = [`    <loc>${escapeXml(localeUrl(entry.path, locale))}</loc>`, ...alternates];
      if (entry.lastmod) lines.push(`    <lastmod>${entry.lastmod.slice(0, 10)}</lastmod>`);
      lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
      lines.push(`    <priority>${entry.priority}</priority>`);
      return `  <url>\n${lines.join("\n")}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

type StoreRow = { id: string; slug: string; store_kind: string | null };

/**
 * Mağazaların dil kümesini `store_locales` üzerinden okur.
 * Türkçe her zaman kümede yer alır (varsayılan dil).
 */
async function loadStoreLocales(storeIds: string[]) {
  const supabase = publicSupabase();
  const map = new Map<string, Set<SitemapLocale>>();
  for (const id of storeIds) map.set(id, new Set<SitemapLocale>(["tr"]));

  for (let i = 0; i < storeIds.length; i += 200) {
    const chunk = storeIds.slice(i, i + 200);
    const { data } = await readAllPages((from, to) =>
      supabase
        .from("store_locales")
        .select("store_id, locale, is_active")
        .in("store_id", chunk)
        .eq("is_active", true)
        .order("id")
        .range(from, to),
    );
    for (const row of data ?? []) {
      const short = String(row.locale).slice(0, 2).toLowerCase() as SitemapLocale;
      if (!SITEMAP_LOCALES.includes(short)) continue;
      map.get(String(row.store_id))?.add(short);
    }
  }
  return map;
}

/** Dil bazlı site haritası XML'i üretir. */
export async function buildLocaleSitemap(locale: SitemapLocale): Promise<string> {
  const supabase = publicSupabase();
  const entries: Entry[] = [];

  // Platform sayfaları: yalnızca o dilde gerçekten var olan içerik.
  for (const path of PLATFORM_PATHS[locale]) {
    // Ana sayfalar (/, /en, /de, /ar) birbirinin dil karşılığı; hreflang seti tam verilir.
    const isHome = path === "/" || path === `/${locale}`;
    entries.push({
      path,
      changefreq: isHome ? "weekly" : "monthly",
      priority: isHome ? "1.0" : "0.8",
      locales: isHome ? [...SITEMAP_LOCALES] : [locale],
    });
  }

  // Aktif mağazalar
  const stores: StoreRow[] = [];
  for (let offset = 0; ;) {
    const { data, error } = await supabase
      .from("stores")
      .select("id, slug, store_kind")
      .eq("status", "active")
      .order("slug")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as StoreRow[];
    stores.push(...rows);
    if (!rows.length) break;
    offset += rows.length;
  }

  const localeMap = await loadStoreLocales(stores.map((store) => store.id));
  const settings = await readAllPages((from, to) =>
    supabase.from("store_settings").select("store_id,seo").order("store_id").range(from, to),
  );
  const hiddenStores = new Set(
    (settings.data ?? [])
      .filter((row) => readStoreSeo(row.seo).noindexStore)
      .map((row) => row.store_id),
  );
  const eligible = stores.filter(
    (store) => !hiddenStores.has(store.id) && localeMap.get(store.id)?.has(locale),
  );
  if (eligible.length === 0) return render(entries, locale);

  const eligibleIds = eligible.map((store) => store.id);
  const slugById = new Map(eligible.map((store) => [store.id, store.slug]));
  const localesFor = (storeId: string) =>
    SITEMAP_LOCALES.filter((code) => localeMap.get(storeId)?.has(code));

  // Vitrin ana sayfaları
  for (const store of eligible) {
    entries.push({
      path: `/s/${store.slug}`,
      changefreq: "daily",
      priority: "0.8",
      locales: localesFor(store.id),
    });
    entries.push({
      path: `/s/${store.slug}/products`,
      changefreq: "weekly",
      priority: "0.6",
      locales: localesFor(store.id),
    });
  }

  // Ürünler
  for (let i = 0; i < eligibleIds.length; i += 50) {
    const chunk = eligibleIds.slice(i, i + 50);
    for (let offset = 0; ;) {
      const { data, error } = await supabase
        .from("products")
        .select("store_id, slug, seo, updated_at")
        .in("store_id", chunk)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .order("id")
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as {
        store_id: string;
        slug: string;
        seo: unknown;
        updated_at: string | null;
      }[];
      for (const row of rows) {
        const slug = slugById.get(row.store_id);
        if (!slug || readSeo(row.seo).noindex) continue;
        entries.push({
          path: `/s/${slug}/p/${row.slug}`,
          lastmod: row.updated_at,
          changefreq: "weekly",
          priority: "0.7",
          locales: localesFor(row.store_id),
        });
      }
      if (!rows.length) break;
      offset += rows.length;
    }
  }

  // Koleksiyonlar
  for (let i = 0; i < eligibleIds.length; i += 50) {
    const chunk = eligibleIds.slice(i, i + 50);
    const { data, error } = await readAllPages((from, to) =>
      supabase
        .from("collections")
        .select("store_id, slug, seo, updated_at")
        .in("store_id", chunk)
        .order("id")
        .range(from, to),
    );
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as {
      store_id: string;
      slug: string;
      seo: unknown;
      updated_at: string | null;
    }[]) {
      const slug = slugById.get(row.store_id);
      if (!slug || readSeo(row.seo).noindex) continue;
      entries.push({
        path: `/s/${slug}/c/${row.slug}`,
        lastmod: row.updated_at,
        changefreq: "weekly",
        priority: "0.6",
        locales: localesFor(row.store_id),
      });
    }
  }

  return render(entries, locale);
}
