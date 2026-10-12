import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/** Almanca dil haritası: Almancayı etkin eden mağazaların içerikleri. */
export const Route = createFileRoute("/sitemap-de.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { buildLocaleSitemap } = await import("@/lib/sitemap-locale.server");
          const xml = await buildLocaleSitemap("de");
          return new Response(xml, {
            headers: { "Content-Type": "application/xml", "Cache-Control": "public, max-age=3600" },
          });
        } catch (cause) {
          console.error("sitemap build failed", cause);
          return new Response("Sitemap unavailable", { status: 500 });
        }
      },
    },
  },
});
