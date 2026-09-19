import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/**
 * Site haritası indeksi: kök harita + her yayınlanmış mağazanın detaylı
 * (ürün, koleksiyon, sayfa, blog) haritası. Arama motorları tek dosyadan
 * tüm platformu keşfeder.
 */
const BASE_URL = "https://mefticaret.com";

export const Route = createFileRoute("/sitemap-index.xml")({
  server: {
    handlers: {
      GET: async () => {
        const locs = [
          `${BASE_URL}/sitemap.xml`,
          `${BASE_URL}/sitemap-products.xml`,
          `${BASE_URL}/sitemap-categories.xml`,
          `${BASE_URL}/sitemap-pages.xml`,
          `${BASE_URL}/sitemap-blog.xml`,
          // Dil bazlı haritalar (hreflang etiketleri içinde)
          `${BASE_URL}/sitemap-tr.xml`,
          `${BASE_URL}/sitemap-en.xml`,
          `${BASE_URL}/sitemap-de.xml`,
          `${BASE_URL}/sitemap-ar.xml`,
        ];

        try {
          const { publicSupabase } = await import("@/lib/public-supabase.server");
          const supabase = publicSupabase();
          const { data } = await supabase
            .from("stores")
            .select("slug")
            .eq("status", "active")
            .order("slug")
            .limit(5000);
          for (const store of data ?? []) {
            locs.push(`${BASE_URL}/api/public/sitemap/${encodeURIComponent(String(store.slug))}`);
          }
        } catch {
          /* mağaza listesi alınamazsa yalnızca kök harita döner */
        }

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...locs.map((loc) => `  <sitemap>\n    <loc>${loc}</loc>\n  </sitemap>`),
          "</sitemapindex>",
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
