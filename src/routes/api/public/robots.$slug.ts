import { createFileRoute } from "@tanstack/react-router";

/**
 * Kiracı bazlı robots.txt: /api/public/robots/<magaza-slug>
 * Vitrin adreslerini indekslemeye açar, sepet/hesap/checkout gibi
 * özel akışları kapatır ve mağazanın sitemap adresini bildirir.
 */
export const Route = createFileRoute("/api/public/robots/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const slug = String(params.slug ?? "").trim().toLowerCase();
        if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
          return new Response("Not found", { status: 404 });
        }

        const origin = new URL(request.url).origin;
        const body = [
          "User-agent: *",
          `Allow: /s/${slug}`,
          `Disallow: /s/${slug}/cart`,
          `Disallow: /s/${slug}/checkout`,
          `Disallow: /s/${slug}/account`,
          `Disallow: /s/${slug}/order`,
          `Disallow: /s/${slug}/favorites`,
          "",
          `Sitemap: ${origin}/api/public/sitemap/${slug}`,
          "",
        ].join("\n");

        return new Response(body, {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
