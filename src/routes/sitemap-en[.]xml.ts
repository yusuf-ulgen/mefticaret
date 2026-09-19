import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/** İngilizce dil haritası: İngilizceyi etkin eden mağazaların içerikleri + İngilizce rehber. */
export const Route = createFileRoute("/sitemap-en.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { buildLocaleSitemap } = await import("@/lib/sitemap-locale.server");
          const xml = await buildLocaleSitemap("en");
          return new Response(xml, {
            headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
          });
        } catch (cause) {
          return new Response(cause instanceof Error ? cause.message : "error", { status: 500 });
        }
      },
    },
  },
});
