import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/**
 * Platform geneli kategori/koleksiyon sitemap'i: tüm aktif mağazaların
 * noindex olmayan koleksiyon adresleri.
 */
export const Route = createFileRoute("/sitemap-categories.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { buildGlobalSitemap } = await import("@/lib/sitemap-global.server");
          const xml = await buildGlobalSitemap("categories");
          return new Response(xml, {
            headers: {
              "Content-Type": "application/xml",
              "Cache-Control": "public, max-age=3600",
            },
          });
        } catch (cause) {
          return new Response(cause instanceof Error ? cause.message : "error", { status: 500 });
        }
      },
    },
  },
});
