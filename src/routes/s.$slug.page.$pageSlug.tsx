import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { ReadingProgress, ShareButtons } from "@/components/blog-reading";
import { storefrontPageQuery } from "@/lib/pages-queries";
import { storefrontBlogPostQuery } from "@/lib/blog-queries";

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
      templateKey: isBlog ? "blog" : "page",
      tokens: {
        page_title: loaderData.title,
        page_excerpt: loaderData.description,
        ...(entity?.author ? { author_name: entity.author } : {}),
      },
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
  const { slug, pageSlug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontPageQuery(slug, pageSlug));
  const meta = useQuery(storefrontBlogPostQuery(slug, pageSlug));
  if (!data) return null;

  const { store, theme, page, footerPages } = data;
  const { fonts, muted, cardBg, border, radius, t } = storefrontTokens(theme);
  const post = meta.data?.post ?? null;
  const author = meta.data?.author ?? null;
  const related = meta.data?.related ?? [];

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      {post ? (
        <ReadingProgress postId={post.id} title={post.title} accent={t.accent_color ?? muted} />
      ) : null}
      <nav style={{ marginTop: 24, fontSize: 13, color: muted }}>
        <Link to="/s/$slug" params={{ slug }} style={{ color: "inherit" }}>
          {store.name}
        </Link>
        {" / "}
        {post ? (
          <>
            <Link to="/s/$slug/blog" params={{ slug }} style={{ color: "inherit" }}>
              Blog
            </Link>
            {" / "}
          </>
        ) : null}
        <span>{page.title}</span>
      </nav>

      <article style={{ maxWidth: 760, padding: "16px 0 40px" }}>
        {post?.category ? (
          <span style={{ fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: t.accent_color }}>
            {post.category.name}
          </span>
        ) : null}
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: "clamp(25px, 6.4vw, 34px)",
            lineHeight: 1.25,
            fontWeight: 700,
            margin: post ? "8px 0 0" : 0,
            overflowWrap: "anywhere",
          }}
        >
          {page.title}
        </h1>
        {post ? (
          <p style={{ color: muted, marginTop: 10, fontSize: 13 }}>
            {[
              post.author_name,
              post.published_at
                ? new Date(post.published_at).toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : null,
              `${post.readingMinutes} dk okuma`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        {post?.cover_url ? (
          <img
            src={post.cover_url}
            alt={page.title}
            style={{
              width: "100%",
              maxHeight: 420,
              borderRadius: radius,
              marginTop: 18,
              objectFit: "cover",
            }}
          />
        ) : null}
        {page.excerpt ? (
          <p style={{ color: muted, marginTop: 16, fontSize: "clamp(15px, 4vw, 16.5px)", lineHeight: 1.7 }}>
            {page.excerpt}
          </p>
        ) : null}
        <div
          style={{
            marginTop: 24,
            fontSize: "clamp(16px, 4.2vw, 17px)",
            lineHeight: 1.85,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {page.body}
        </div>

        {post ? <ShareButtons postId={post.id} title={post.title} border={border} muted={muted} /> : null}


        {post && post.tags.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 24 }}>
            {post.tags.map((tag) => (
              <span
                key={tag.slug}
                style={{
                  border: `1px solid ${border}`,
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 12,
                  color: muted,
                }}
              >
                #{tag.name}
              </span>
            ))}
          </div>
        ) : null}

        {author ? (
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              marginTop: 26,
              padding: "16px 18px",
              background: cardBg,
              border: `1px solid ${border}`,
              borderRadius: radius,
            }}
          >
            {author.avatar_url ? (
              <img
                src={author.avatar_url}
                alt={author.name}
                style={{ width: 52, height: 52, borderRadius: 999, objectFit: "cover" }}
              />
            ) : null}
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{author.name}</p>
              {author.title ? <p style={{ margin: "2px 0 0", color: muted, fontSize: 13 }}>{author.title}</p> : null}
              {author.bio ? <p style={{ margin: "6px 0 0", color: muted, fontSize: 13 }}>{author.bio}</p> : null}
            </div>
          </div>
        ) : null}

        <p style={{ color: muted, fontSize: 12, marginTop: 32 }}>
          Son güncelleme: {new Date(page.updated_at).toLocaleDateString("tr-TR")}
        </p>
      </article>

      {related.length > 0 ? (
        <section style={{ paddingBottom: 64 }}>
          <h2 style={{ fontFamily: fonts.heading, fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>
            İlgili yazılar
          </h2>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {related.map((item) => (
              <Link
                key={item.id}
                to="/s/$slug/page/$pageSlug"
                params={{ slug, pageSlug: item.slug }}
                style={{
                  background: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: radius,
                  padding: "14px 16px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{item.title}</p>
                <p style={{ margin: "6px 0 0", color: muted, fontSize: 12 }}>{item.readingMinutes} dk okuma</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </StorefrontChrome>
  );
}
