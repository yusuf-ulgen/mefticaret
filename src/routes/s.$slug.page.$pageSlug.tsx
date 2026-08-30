import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { storefrontPageQuery } from "@/lib/pages-queries";

export const Route = createFileRoute("/s/$slug/page/$pageSlug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontPageQuery(params.slug, params.pageSlug));
    if (!data) throw notFound();
    return {
      storeName: data.store.name,
      title: data.page.title,
      description: data.page.seo_description ?? data.page.excerpt ?? "",
    };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Sayfa bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.title} — ${loaderData.storeName}`;
    const description = loaderData.description || `${loaderData.storeName} — ${loaderData.title}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `/s/${params.slug}/page/${params.pageSlug}` }],
    };
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
