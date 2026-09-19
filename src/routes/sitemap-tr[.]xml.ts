import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/** Türkçe dil haritası: platform pazarlama sayfaları + tüm aktif mağaza içerikleri. */
export const Route = createFileRoute("/sitemap-tr.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { buildLocaleSitemap } = await import("@/lib/sitemap-locale.server");
          const xml = await buildLocaleSitemap("tr");
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
