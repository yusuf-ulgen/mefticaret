import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/**
 * Platform geneli blog sitemap'i: tüm aktif mağazaların yayınlanmış,
 * noindex olmayan blog yazıları.
 */
export const Route = createFileRoute("/sitemap-blog.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { buildGlobalSitemap } = await import("@/lib/sitemap-global.server");
          const xml = await buildGlobalSitemap("blog");
          return new Response(xml, {
            headers: {
              "Content-Type": "application/xml",
              "Cache-Control": "public, max-age=3600",
            },
          });
        } catch (cause) {
          console.error(cause);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
