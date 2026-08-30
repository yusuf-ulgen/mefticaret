import { createFileRoute } from "@tanstack/react-router";

/**
 * Kiracı bazlı sitemap: /api/public/sitemap/<magaza-slug>
 * Yayınlanmış mağazanın ürün, koleksiyon ve sayfa adreslerini XML olarak döner.
 */
export const Route = createFileRoute("/api/public/sitemap/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const slug = String(params.slug ?? "").trim().toLowerCase();
        if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
          return new Response("Not found", { status: 404 });
        }

        const { publicSupabase } = await import("@/lib/public-supabase.server");
        const supabase = publicSupabase();

        const { data: store } = await supabase
          .from("stores")
          .select("id, slug")
          .eq("slug", slug)
          .maybeSingle();
        if (!store) return new Response("Not found", { status: 404 });

        const [products, collections, pages] = await Promise.all([
          supabase
            .from("products")
            .select("slug, updated_at")
            .eq("store_id", store.id)
            .eq("status", "active")
            .order("updated_at", { ascending: false })
            .limit(5000),
          supabase.from("collections").select("slug, updated_at").eq("store_id", store.id).limit(1000),
          supabase
            .from("store_pages")
            .select("slug, updated_at")
            .eq("store_id", store.id)
            .eq("is_published", true)
            .limit(1000),
        ]);

        const origin = new URL(request.url).origin;
        const base = `${origin}/s/${store.slug}`;
        const entries: { loc: string; lastmod?: string; priority: string }[] = [
          { loc: base, priority: "1.0" },
          ...(products.data ?? []).map((p) => ({
            loc: `${base}/p/${p.slug}`,
            lastmod: p.updated_at ?? undefined,
            priority: "0.8",
          })),
          ...(collections.data ?? []).map((c) => ({
            loc: `${base}/c/${c.slug}`,
            lastmod: c.updated_at ?? undefined,
            priority: "0.6",
          })),
          ...(pages.data ?? []).map((p) => ({
            loc: `${base}/page/${p.slug}`,
            lastmod: p.updated_at ?? undefined,
            priority: "0.4",
          })),
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (e) =>
      `  <url><loc>${escapeXml(e.loc)}</loc>${
        e.lastmod ? `<lastmod>${new Date(e.lastmod).toISOString()}</lastmod>` : ""
      }<priority>${e.priority}</priority></url>`,
  )
  .join("\n")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=600",
          },
        });
      },
    },
  },
});

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
