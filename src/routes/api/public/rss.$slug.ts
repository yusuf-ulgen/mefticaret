import { createFileRoute } from "@tanstack/react-router";

/**
 * Kiracı bazlı blog RSS akışı: /api/public/rss/<magaza-slug>
 * Yalnızca yayınlanmış mağazaların yayınlanmış blog yazılarını döner.
 */
function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const Route = createFileRoute("/api/public/rss/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const slug = String(params.slug ?? "").trim().toLowerCase();
        if (!/^[a-z0-9-]{1,120}$/.test(slug)) return new Response("Not found", { status: 404 });

        const url = new URL(request.url);
        const forwarded = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
        const origin = forwarded ? `https://${forwarded}` : url.origin;

        try {
          const { getStorefrontBlog } = await import("@/lib/blog-public.functions");
          const data = await getStorefrontBlog({ data: { slug } });
          if (!data) return new Response("Not found", { status: 404 });

          const base = `${origin}/s/${slug}`;
          const items = data.posts
            .slice(0, 50)
            .map((post) => {
              const link = `${base}/page/${post.slug}`;
              const date = new Date(post.published_at ?? post.updated_at).toUTCString();
              return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${date}</pubDate>
      <description>${escapeXml(post.excerpt ?? post.seo_description ?? "")}</description>
${post.category ? `      <category>${escapeXml(post.category.name)}</category>\n` : ""}    </item>`;
            })
            .join("\n");

          const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
    <title>${escapeXml(`${data.store.name} — Blog`)}</title>
    <link>${escapeXml(`${base}/blog`)}</link>
    <description>${escapeXml(`${data.store.name} blog yazıları`)}</description>
    <language>tr</language>
${items}
</channel></rss>`;

          return new Response(body, {
            headers: {
              "content-type": "application/rss+xml; charset=utf-8",
              "cache-control": "public, max-age=1800",
            },
          });
        } catch (cause) {
          return new Response(cause instanceof Error ? cause.message : "error", { status: 500 });
        }
      },
    },
  },
});
