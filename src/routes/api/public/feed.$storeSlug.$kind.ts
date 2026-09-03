import { createFileRoute } from "@tanstack/react-router";

const KINDS = ["google_shopping", "tiktok_shop", "instagram_shop", "facebook_catalog"] as const;

/** Public ürün akışı: /api/public/feed/<magaza-slug>/<kind>?token=... */
export const Route = createFileRoute("/api/public/feed/$storeSlug/$kind")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const kind = params.kind as (typeof KINDS)[number];
        if (!KINDS.includes(kind)) return new Response("Not found", { status: 404 });

        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: store } = await supabaseAdmin
          .from("stores")
          .select("id, name, slug")
          .eq("slug", params.storeSlug)
          .maybeSingle();
        if (!store) return new Response("Not found", { status: 404 });

        const { data: feed } = await supabaseAdmin
          .from("store_product_feeds")
          .select("*")
          .eq("store_id", store.id)
          .eq("kind", kind)
          .maybeSingle();
        if (!feed || !feed.is_active) return new Response("Not found", { status: 404 });
        if (feed.token !== token) return new Response("Unauthorized", { status: 401 });

        const forwarded = url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
        const origin = forwarded ? `https://${forwarded}` : url.origin;
        const categoryMap = (feed.category_map ?? {}) as Record<string, string>;

        if (kind === "google_shopping") {
          const { buildGoogleShoppingFeed } = await import("@/lib/product-feed.server");
          const xml = await buildGoogleShoppingFeed(
            supabaseAdmin,
            store.id,
            store.name,
            store.slug,
            origin,
            feed.currency,
            feed.include_out_of_stock,
            categoryMap,
          );
          return new Response(xml, {
            headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" },
          });
        }

        const { buildCatalogFeedJson, catalogFeedToCsv } = await import("@/lib/product-feed.server");
        const items = await buildCatalogFeedJson(
          supabaseAdmin,
          store.id,
          store.slug,
          origin,
          feed.currency,
          feed.include_out_of_stock,
          categoryMap,
        );

        const format = url.searchParams.get("format");
        if (format === "json") {
          return Response.json(items, { headers: { "cache-control": "public, max-age=900" } });
        }
        const csv = catalogFeedToCsv(items);
        return new Response(csv, {
          headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "public, max-age=900" },
        });
      },
    },
  },
});
