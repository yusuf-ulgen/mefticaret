import { createFileRoute } from "@tanstack/react-router";

import { resolveMobileAppConfig } from "@/lib/mobile-app";

/**
 * White-label mobil çekirdeğin (React Native / Expo) okuduğu Theme JSON.
 * GET /api/public/mobile-app/<magaza-slug>
 *
 * Yalnızca yayınlanmış tasarım ve vitrinde zaten herkese açık olan katalog
 * verisi döner; gizli alan (maliyet, müşteri verisi vb.) içermez.
 */
export const Route = createFileRoute("/api/public/mobile-app/$storeSlug")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: store } = await supabaseAdmin
          .from("stores")
          .select("id, name, slug, status, currency")
          .eq("slug", params.storeSlug)
          .maybeSingle();
        if (!store || store.status !== "active") return new Response("Not found", { status: 404 });

        const { data: row } = await supabaseAdmin
          .from("mobile_app_configs")
          .select("published_config, version, published_at")
          .eq("store_id", store.id)
          .maybeSingle();
        if (!row?.published_config) {
          return Response.json({ error: "app_not_published" }, { status: 404 });
        }

        const config = resolveMobileAppConfig(row.published_config, store.name);

        const [{ data: categories }, { data: products }] = await Promise.all([
          supabaseAdmin
            .from("categories")
            .select("id, name, slug, image_url")
            .eq("store_id", store.id)
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .limit(20),
          supabaseAdmin
            .from("products")
            .select("id, title, slug, base_price, compare_at_price, currency")
            .eq("store_id", store.id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(40),
        ]);


        return Response.json(
          {
            store: { id: store.id, name: store.name, slug: store.slug, currency: store.currency },
            version: row.version,
            publishedAt: row.published_at,
            config,
            catalog: { categories: categories ?? [], products: products ?? [] },
          },
          { headers: { "cache-control": "public, max-age=60, s-maxage=300" } },
        );
      },
    },
  },
});
