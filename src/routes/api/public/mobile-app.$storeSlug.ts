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

        const [{ data: categories }, { data: products }, { data: storePages }, { data: platformPages }] =
          await Promise.all([
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
            supabaseAdmin
              .from("store_pages")
              .select("id, title, slug, excerpt, body, updated_at")
              .eq("store_id", store.id)
              .eq("is_published", true)
              .eq("page_kind", "page")
              .order("sort_order", { ascending: true })
              .limit(40),
            supabaseAdmin
              .from("platform_pages")
              .select("id, title, slug, excerpt, body, updated_at")
              .eq("is_published", true)
              .order("sort_order", { ascending: true })
              .limit(40),
          ]);

        const allProducts = products ?? [];
        const allCategories = categories ?? [];
        const discounted = allProducts.filter(
          (p) => Number(p.compare_at_price ?? 0) > Number(p.base_price ?? 0),
        );

        /**
         * Vitrin verisini widget'lara otomatik bağlar: ürün ızgarası ve flash
         * indirim widget'ları mağazadaki canlı ürünlerle, kategori daireleri ve
         * hikayeler elle içerik girilmediğinde canlı kategorilerle dolar.
         */
        const widgetData: Record<string, unknown> = {};
        for (const widget of config.home) {
          if (widget.type === "product_grid") {
            widgetData[widget.id] = { products: allProducts.slice(0, widget.limit) };
          } else if (widget.type === "flash_sale") {
            widgetData[widget.id] = {
              products: (discounted.length ? discounted : allProducts).slice(0, widget.limit),
            };
          } else if (
            (widget.type === "category_circles" || widget.type === "stories") &&
            widget.items.length === 0
          ) {
            widgetData[widget.id] = {
              items: allCategories.slice(0, widget.limit).map((category) => ({
                id: category.id,
                label: category.name,
                imageUrl: category.image_url ?? "",
                link: `mefticaret://category/${category.slug}`,
              })),
            };
          }
        }

        /**
         * İçerik sayfaları senkronu: mağaza sayfaları `mefticaret://page/<slug>`,
         * platform (Mefticaret kurumsal) sayfaları web adresiyle açılır. Drawer
         * menüsü bu listeyle otomatik güncellenir; elle düzenleme gerekmez.
         */
        const pages = [
          ...(storePages ?? []).map((page) => ({
            id: page.id,
            scope: "store" as const,
            title: page.title,
            slug: page.slug,
            excerpt: page.excerpt ?? "",
            body: page.body ?? "",
            updatedAt: page.updated_at,
            link: `mefticaret://page/${page.slug}`,
          })),
          ...(platformPages ?? []).map((page) => ({
            id: page.id,
            scope: "platform" as const,
            title: page.title,
            slug: page.slug,
            excerpt: page.excerpt ?? "",
            body: page.body ?? "",
            updatedAt: page.updated_at,
            link: `https://mefticaret.com/sayfa/${page.slug}`,
          })),
        ];

        const drawerLinks = new Set(config.navigation.drawer.map((item) => item.link));
        const navigation = {
          ...config.navigation,
          drawer: [
            ...config.navigation.drawer,
            ...pages
              .filter((page) => !drawerLinks.has(page.link))
              .map((page) => ({
                id: `page-${page.scope}-${page.slug}`,
                label: page.title.slice(0, 40),
                link: page.link,
              })),
          ].slice(0, 30),
        };

        return Response.json(
          {
            store: { id: store.id, name: store.name, slug: store.slug, currency: store.currency },
            version: row.version,
            publishedAt: row.published_at,
            config: { ...config, navigation },
            widgetData,
            pages,
            catalog: { categories: allCategories, products: allProducts },
          },
          { headers: { "cache-control": "public, max-age=60, s-maxage=300" } },
        );
      },
    },
  },
});
