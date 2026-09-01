import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { storefrontPageQuery } from "@/lib/pages-queries";
import { getRequestOrigin } from "@/lib/origin.functions";
import { getStoreSeoContext } from "@/lib/seo-public.functions";
import { absoluteUrl, articleSchema, plainText } from "@/lib/seo";
import { missingHead, storefrontHead } from "@/lib/storefront-seo";

export const Route = createFileRoute("/s/$slug/page/$pageSlug")({
  loader: async ({ context, params }) => {
    const [data, ctx, origin] = await Promise.all([
      context.queryClient.ensureQueryData(storefrontPageQuery(params.slug, params.pageSlug)),
      getStoreSeoContext({ data: { slug: params.slug, pageSlug: params.pageSlug } }),
      getRequestOrigin(),
    ]);
    if (!data) throw notFound();
    return {
      storeName: data.store.name,
      title: data.page.title,
      description: plainText(data.page.seo_description ?? data.page.excerpt ?? data.page.body ?? ""),
      ctx,
      origin,
    };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return missingHead("Sayfa bulunamadı");
    const base = `/s/${params.slug}`;
    const path = `${base}/page/${params.pageSlug}`;
    const entity = loaderData.ctx?.entity ?? null;
    const isBlog = entity?.kind === "blog";
    const description =
      entity?.description || loaderData.description || `${loaderData.storeName} — ${loaderData.title}`;

    return storefrontHead({
      ctx: loaderData.ctx,
      origin: loaderData.origin,
      slug: params.slug,
      path,
      fallbackTitle: loaderData.title,
      fallbackDescription: description,
      seo: entity,
      ogType: isBlog ? "article" : "website",
      breadcrumbs: [
        { name: "Ana sayfa", path: base },
        ...(isBlog ? [{ name: "Blog", path: `${base}/blog` }] : []),
        { name: loaderData.title, path },
      ],
      schemas: isBlog
        ? [
            articleSchema({
              headline: loaderData.title,
              description,
              url: absoluteUrl(path, loaderData.origin),
              image: entity?.ogImage ?? null,
              author: entity?.author ?? null,
              publisher: loaderData.storeName,
              publishedAt: entity?.publishedAt ?? null,
              updatedAt: entity?.updatedAt ?? null,
            }),
          ]
        : [],
    });
  },
  errorComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-2xl font-semibold">Sayfa yüklenemedi</h1>
      <p className="text-muted-foreground">Lütfen daha sonra tekrar deneyin.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Bu sayfa bulunamadı.</h1>
    </div>
  ),
  component: StorePage,
});

function StorePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontPageQuery(slug, Route.useParams().pageSlug));
  if (!data) return null;

  const { store, theme, page, footerPages } = data;
  const { fonts, muted } = storefrontTokens(theme);

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      <nav style={{ marginTop: 28, fontSize: 13, color: muted }}>
        <Link to="/s/$slug" params={{ slug }} style={{ color: "inherit" }}>
          {store.name}
        </Link>
        {" / "}
        <span>{page.title}</span>
      </nav>

      <article style={{ maxWidth: 760, padding: "20px 0 56px" }}>
        <h1 style={{ fontFamily: fonts.heading, fontSize: 34, fontWeight: 700, margin: 0 }}>{page.title}</h1>
        {page.excerpt ? (
          <p style={{ color: muted, marginTop: 10, fontSize: 15 }}>{page.excerpt}</p>
        ) : null}
        <div style={{ marginTop: 24, fontSize: 15, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{page.body}</div>
        <p style={{ color: muted, fontSize: 12, marginTop: 32 }}>
          Son güncelleme: {new Date(page.updated_at).toLocaleDateString("tr-TR")}
        </p>
      </article>
    </StorefrontChrome>
  );
}
