import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/** Arapça dil haritası: Arapçayı etkin eden mağazaların içerikleri (RTL vitrin). */
export const Route = createFileRoute("/sitemap-ar.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { buildLocaleSitemap } = await import("@/lib/sitemap-locale.server");
          const xml = await buildLocaleSitemap("ar");
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
