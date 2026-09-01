import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { Breadcrumb, StorefrontFallback } from "@/components/storefront-parts";
import { formatDateTime } from "@/lib/mefti";
import { storefrontPagesQuery, storefrontQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/blog")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { storeName: data.store.name };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Mağaza bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Blog — ${loaderData.storeName}`;
    const description = `${loaderData.storeName} blogu: ürün rehberleri, bakım önerileri, kampanya duyuruları ve mağaza haberleri.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `/s/${params.slug}/blog` }],
    };
  },
  errorComponent: () => <StorefrontFallback text="Blog şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: BlogPage,
});

function BlogPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const pages = useQuery(storefrontPagesQuery(slug));

  if (!data) return <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme, footerPages } = data;
  const { fonts, muted, cardBg, border, radius } = storefrontTokens(theme);
  const posts = pages.data?.pages ?? [];

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      <Breadcrumb theme={theme} slug={slug} storeName={store.name} current="Blog" />
      <header style={{ padding: "20px 0 24px", maxWidth: 640 }}>
        <h1 style={{ fontFamily: fonts.heading, fontSize: 34, fontWeight: 700, margin: 0 }}>Blog</h1>
        <p style={{ color: muted, marginTop: 10, fontSize: 15 }}>
          Ürün rehberleri, kampanya duyuruları ve mağaza haberleri.
        </p>
      </header>

      {pages.isLoading ? (
        <p style={{ color: muted, paddingBottom: 60 }}>Yazılar yükleniyor…</p>
      ) : posts.length === 0 ? (
        <p style={{ color: muted, paddingBottom: 60 }}>Henüz yayınlanmış bir yazı yok.</p>
      ) : (
        <div style={{ display: "grid", gap: 12, paddingBottom: 64 }}>
          {posts.map((post) => (
            <Link
              key={post.id}
              to="/s/$slug/page/$pageSlug"
              params={{ slug, pageSlug: post.slug }}
              style={{
                background: cardBg,
                border: `1px solid ${border}`,
                borderRadius: radius,
                padding: "16px 18px",
                textDecoration: "none",
                color: "inherit",
                display: "block",
              }}
            >
              <p style={{ margin: 0, fontFamily: fonts.heading, fontWeight: 600, fontSize: 18 }}>{post.title}</p>
              <p style={{ margin: "6px 0 0", color: muted, fontSize: 13 }}>{formatDateTime(post.updated_at)}</p>
              {post.excerpt || post.seo_description ? (
                <p style={{ margin: "8px 0 0", color: muted, fontSize: 14, lineHeight: 1.6 }}>
                  {post.excerpt || post.seo_description}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </StorefrontChrome>
  );
}
