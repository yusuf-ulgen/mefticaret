import { publicSupabase } from "@/lib/public-supabase.server";
import { buildStoreSitemap } from "@/lib/sitemap.server";

/**
 * IndexNow ile hızlı indeksleme: platform pazarlama sayfaları ve yayınlanmış
 * mağazaların tüm vitrin adresleri (ürün, koleksiyon, sayfa, blog) tek çağrıda
 * arama motorlarına bildirilir. Anahtar `public/<key>.txt` ile doğrulanır.
 */

export const INDEXNOW_KEY = "83870d8d07e0416d9f34d4dbc1ff917f";

const MARKETING_PATHS = [
  "/",
  "/en-iyi-e-ticaret-altyapisi",
  "/seo-ve-raporlama",
  "/e-ticaret-sitesi-kurma",
  "/dropshipping-nasil-yapilir",
  "/pazaryeri-entegrasyonu",
  "/blog",
];

const ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
  "https://yandex.com/indexnow",
];

/** Bildirilecek tüm herkese açık adresleri toplar. */
export async function collectIndexableUrls(origin: string): Promise<string[]> {
  const base = origin.replace(/\/$/, "");
  const urls = new Set<string>(MARKETING_PATHS.map((path) => `${base}${path}`));
  urls.add(`${base}/sitemap.xml`);

  const supabase = publicSupabase();
  const { data } = await supabase.from("stores").select("slug").eq("status", "active").limit(500);

  for (const store of data ?? []) {
    const slug = String(store.slug);
    try {
      const xml = await buildStoreSitemap(slug, base);
      if (!xml) continue;
      for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        const loc = match[1]?.replace(/&amp;/g, "&").trim();
        if (loc && loc.startsWith(base)) urls.add(loc);
      }
    } catch {
      /* tek mağaza hatası tüm turu durdurmaz */
    }
  }

  return [...urls];
}

export type IndexNowResult = {
  host: string;
  urlCount: number;
  batches: number;
  endpoints: { endpoint: string; status: number | "error" }[];
};

/** Adresleri IndexNow uçlarına gönderir (10.000'lik gruplar hâlinde). */
export async function submitToIndexNow(origin: string): Promise<IndexNowResult> {
  const host = new URL(origin).host;
  const urlList = await collectIndexableUrls(origin);
  const batches: string[][] = [];
  for (let i = 0; i < urlList.length; i += 10000) batches.push(urlList.slice(i, i + 10000));

  const results: IndexNowResult["endpoints"] = [];
  for (const endpoint of ENDPOINTS) {
    for (const batch of batches) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            host,
            key: INDEXNOW_KEY,
            keyLocation: `${origin.replace(/\/$/, "")}/${INDEXNOW_KEY}.txt`,
            urlList: batch,
          }),
        });
        results.push({ endpoint, status: response.status });
      } catch {
        results.push({ endpoint, status: "error" });
      }
    }
  }

  return { host, urlCount: urlList.length, batches: batches.length, endpoints: results };
}
