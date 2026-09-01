import { createFileRoute } from "@tanstack/react-router";

/**
 * Kiracı bazlı robots.txt: /api/public/robots/<magaza-slug>
 * Vitrin adreslerini indekslemeye açar, sepet/hesap/checkout gibi
 * özel akışları kapatır ve mağazanın sitemap adresini bildirir.
 * Mağaza SEO ayarlarındaki ek kurallar ve indeksleme kapatma dikkate alınır.
 */
export const Route = createFileRoute("/api/public/robots/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const slug = String(params.slug ?? "").trim().toLowerCase();
        if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
          return new Response("Not found", { status: 404 });
        }

        const { buildStoreRobots } = await import("@/lib/sitemap.server");
        const url = new URL(request.url);
        const forwarded =
          url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
        const origin = forwarded ? `https://${forwarded}` : url.origin;

        try {
          const body = await buildStoreRobots(slug, origin);
          if (!body) return new Response("Not found", { status: 404 });
          return new Response(body, {
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": "public, max-age=3600",
            },
          });
        } catch (cause) {
          return new Response(cause instanceof Error ? cause.message : "error", { status: 500 });
        }
      },
    },
  },
});
