import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Var olan sitemap üreticilerini kullanır; dil/katalog sayımları ayrı kapsamlardır. */
export const inspectPlatformSitemaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformAdmin } = await import("@/lib/platform-admin.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const { buildLocaleSitemap, SITEMAP_LOCALES } = await import("@/lib/sitemap-locale.server");
    const { buildGlobalSitemap } = await import("@/lib/sitemap-global.server");
    const { inspectSitemap } = await import("@/lib/sitemap-inspection");
    const rows: {
      scope: string;
      path: string;
      total: number | null;
      duplicates: number | null;
      error: string | null;
    }[] = [];
    const checks = [
      ...SITEMAP_LOCALES.map((locale) => ({
        scope: `Platform · ${locale.toUpperCase()}`,
        path: `/sitemap-${locale}.xml`,
        build: () => buildLocaleSitemap(locale),
      })),
      ...(["products", "categories", "pages", "blog"] as const).map((kind) => ({
        scope: `Mağaza içerikleri · ${kind}`,
        path: `/sitemap-${kind}.xml`,
        build: () => buildGlobalSitemap(kind),
      })),
    ];
    // Büyük katalog sorgularını aynı anda dokuz kez yüklemeyin.
    for (const check of checks) {
      try {
        const inventory = inspectSitemap(await check.build());
        rows.push({
          scope: check.scope,
          path: check.path,
          total: inventory.unique,
          duplicates: inventory.duplicates,
          error: null,
        });
      } catch (error) {
        rows.push({
          scope: check.scope,
          path: check.path,
          total: null,
          duplicates: null,
          error: error instanceof Error ? error.message : "Envanter alınamadı",
        });
      }
    }
    return { generatedAt: new Date().toISOString(), rows };
  });

export const fetchPlatformSlugHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertPlatformAdmin } = await import("@/lib/platform-admin.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const { readAllPages } = await import("@/lib/read-all-pages");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await readAllPages((from, to) =>
      supabaseAdmin
        .from("platform_post_redirects")
        .select("old_slug, created_at, platform_posts(slug, title, is_published)")
        .order("old_slug")
        .range(from, to),
    );
    return (data ?? []).map((row) => ({
      oldPath: `/blog/${encodeURIComponent(row.old_slug)}`,
      targetPath: row.platform_posts?.is_published
        ? `/blog/${encodeURIComponent(row.platform_posts.slug)}`
        : null,
      status: row.platform_posts?.is_published ? 301 : 404,
      title: row.platform_posts?.title ?? "Silinmiş yazı",
    }));
  });

/** Süper yönetici: platform SEO paneli okuma/yazma. */

export const fetchPlatformSeoTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const guard = await import("@/lib/platform-admin.server");
    await guard.assertPlatformAdmin(context.supabase, context.userId);
    const server = await import("@/lib/platform-seo.server");
    return server.listPlatformSeoTargets(context.supabase);
  });

export const savePlatformSeoTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const guard = await import("@/lib/platform-admin.server");
    await guard.assertPlatformAdmin(context.supabase, context.userId);
    const server = await import("@/lib/platform-seo.server");
    return server.savePlatformSeoTarget(context.supabase, server.savePlatformSeoSchema.parse(data));
  });
