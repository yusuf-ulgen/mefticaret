import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/**
 * Platform geneli ürün sitemap'i: tüm aktif mağazaların yayınlanmış,
 * noindex olmayan ürün adresleri. Google bunu sitemap-index ve robots.txt
 * üzerinden otomatik keşfeder.
 */
export const Route = createFileRoute("/sitemap-products.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { buildGlobalSitemap } = await import("@/lib/sitemap-global.server");
          const xml = await buildGlobalSitemap("products");
          return new Response(xml, {
            headers: {
              "Content-Type": "application/xml",
              "Cache-Control": "public, max-age=3600",
            },
          });
        } catch (cause) {
          console.error("sitemap build failed", cause);
          return new Response("Sitemap unavailable", { status: 500 });
        }
      },
    },
  },
});
