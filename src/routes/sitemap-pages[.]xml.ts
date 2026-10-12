import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/**
 * Platform geneli sayfa sitemap'i: tüm aktif mağazaların yayınlanmış,
 * noindex olmayan özel sayfaları (blog hariç).
 */
export const Route = createFileRoute("/sitemap-pages.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { buildGlobalSitemap } = await import("@/lib/sitemap-global.server");
          const xml = await buildGlobalSitemap("pages");
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
