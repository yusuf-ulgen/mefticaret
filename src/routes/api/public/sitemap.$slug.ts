import { createFileRoute } from "@tanstack/react-router";

/**
 * Kiracı bazlı sitemap: /api/public/sitemap/<magaza-slug>
 * Yayınlanmış mağazanın kurumsal sayfa, ürün, koleksiyon ve blog adreslerini
 * XML olarak döner. Arama motorlarına kapatılmış içerikler listelenmez.
 */
export const Route = createFileRoute("/api/public/sitemap/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const slug = String(params.slug ?? "").trim().toLowerCase();
        if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
          return new Response("Not found", { status: 404 });
        }

        const { buildStoreSitemap } = await import("@/lib/sitemap.server");
        const url = new URL(request.url);
        const forwarded =
          url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
        const origin = forwarded ? `https://${forwarded}` : url.origin;

        try {
          const xml = await buildStoreSitemap(slug, origin);
          if (!xml) return new Response("Not found", { status: 404 });
          return new Response(xml, {
            headers: {
              "content-type": "application/xml; charset=utf-8",
              "cache-control": "public, max-age=600",
            },
          });
        } catch (cause) {
          return new Response(cause instanceof Error ? cause.message : "error", { status: 500 });
        }
      },
    },
  },
});
