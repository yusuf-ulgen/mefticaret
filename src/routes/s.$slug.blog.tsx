import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { Breadcrumb, StorefrontFallback } from "@/components/storefront-parts";
import { storefrontBlogQuery } from "@/lib/blog-queries";
import { storefrontQuery } from "@/lib/storefront-queries";
import { getRequestOrigin } from "@/lib/origin.functions";
import { getStoreSeoContext } from "@/lib/seo-public.functions";
import { missingHead, storefrontHead } from "@/lib/storefront-seo";

export const Route = createFileRoute("/s/$slug/blog")({
  loader: async ({ context, params }) => {
    const [data, ctx, origin] = await Promise.all([
      context.queryClient.ensureQueryData(storefrontQuery(params.slug)),
      getStoreSeoContext({ data: { slug: params.slug } }),
      getRequestOrigin(),
    ]);
    if (!data) throw notFound();
    return { storeName: data.store.name, ctx, origin };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return missingHead("Mağaza bulunamadı");
    const base = `/s/${params.slug}`;
    return storefrontHead({
      ctx: loaderData.ctx,
      origin: loaderData.origin,
      slug: params.slug,
      path: `${base}/blog`,
      fallbackTitle: "Blog",
      fallbackDescription: `${loaderData.storeName} blogu: ürün rehberleri, bakım önerileri, kampanya duyuruları ve mağaza haberleri.`,
      breadcrumbs: [
        { name: "Ana sayfa", path: base },
        { name: "Blog", path: `${base}/blog` },
      ],
    });
  },
  errorComponent: () => <StorefrontFallback text="Blog şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: BlogPage,
});

const PAGE_SIZE = 9;

function formatPostDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

function BlogPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const blog = useQuery(storefrontBlogQuery(slug));

  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const posts = blog.data?.posts ?? [];
  const filtered = useMemo(() => {
    const needle = term.trim().toLocaleLowerCase("tr-TR");
    return posts.filter((post) => {
      if (category && post.category?.slug !== category) return false;
      if (tag && !post.tags.some((item) => item.slug === tag)) return false;
      if (!needle) return true;
      const haystack = `${post.title} ${post.excerpt ?? ""} ${post.seo_description ?? ""}`.toLocaleLowerCase("tr-TR");
      return haystack.includes(needle);
    });
  }, [posts, term, category, tag]);

  if (!data) return <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme, footerPages } = data;
  const { fonts, muted, cardBg, border, radius, t } = storefrontTokens(theme);
  const accent = t.accent_color ?? muted;

  const chipStyle = (active: boolean) => ({
    border: `1px solid ${active ? "currentColor" : border}`,
    background: active ? "rgba(0,0,0,0.06)" : cardBg,
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 13,
    cursor: "pointer",
    color: "inherit",
  });

  const shown = filtered.slice(0, visible);
  const [featured, ...rest] = shown;

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      <style>{`
        .mf-blog-featured{display:grid;grid-template-columns:1fr;gap:0}
        .mf-blog-featured img{height:200px}
        @media (min-width:760px){
          .mf-blog-featured{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:18px}
          .mf-blog-featured img{height:100%}
        }
        .mf-blog-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr))}
      `}</style>
      <Breadcrumb theme={theme} slug={slug} storeName={store.name} current="Blog" />
      <header style={{ padding: "20px 0 20px", maxWidth: 680 }}>
        <h1 style={{ fontFamily: fonts.heading, fontSize: "clamp(26px, 6.4vw, 34px)", fontWeight: 700, margin: 0 }}>
          Blog
        </h1>
        <p style={{ color: muted, marginTop: 10, fontSize: "clamp(14px, 3.9vw, 15px)" }}>
          Ürün rehberleri, kampanya duyuruları ve mağaza haberleri.
        </p>
        <Link
          to="/s/$slug/galeri"
          params={{ slug }}
          style={{ display: "inline-block", marginTop: 12, color: accent, fontSize: 14 }}
        >
          Görsel galeri →
        </Link>
      </header>


      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", paddingBottom: 18 }}>
        <input
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setVisible(PAGE_SIZE);
          }}
          placeholder="Yazılarda ara…"
          aria-label="Blog yazılarında ara"
          style={{
            flex: "1 1 220px",
            minWidth: 180,
            border: `1px solid ${border}`,
            background: cardBg,
            borderRadius: 999,
            padding: "9px 14px",
            fontSize: 14,
            color: "inherit",
          }}
        />
        <button type="button" onClick={() => { setCategory(null); setTag(null); setVisible(PAGE_SIZE); }} style={chipStyle(!category && !tag)}>
          Tümü
        </button>
        {(blog.data?.categories ?? []).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setCategory(category === item.slug ? null : item.slug);
              setVisible(PAGE_SIZE);
            }}
            style={chipStyle(category === item.slug)}
          >
            {item.name} ({item.count})
          </button>
        ))}
      </div>

      {(blog.data?.tags ?? []).length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingBottom: 20 }}>
          {(blog.data?.tags ?? []).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTag(tag === item.slug ? null : item.slug);
                setVisible(PAGE_SIZE);
              }}
              style={{ ...chipStyle(tag === item.slug), fontSize: 12, padding: "4px 10px" }}
            >
              #{item.name}
            </button>
          ))}
        </div>
      ) : null}

      {blog.isLoading ? (
        <p style={{ color: muted, paddingBottom: 60 }}>Yazılar yükleniyor…</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: muted, paddingBottom: 60 }}>
          {posts.length === 0 ? "Henüz yayınlanmış bir yazı yok." : "Bu filtrelerle eşleşen yazı bulunamadı."}
        </p>
      ) : (
        <div style={{ paddingBottom: 64 }}>
          {featured ? (
            <Link
              to="/s/$slug/page/$pageSlug"
              params={{ slug, pageSlug: featured.slug }}
              className={featured.cover_url ? "mf-blog-featured" : undefined}
              style={{
                display: "grid",
                background: cardBg,
                border: `1px solid ${border}`,
                borderRadius: radius,
                overflow: "hidden",
                textDecoration: "none",
                color: "inherit",
                marginBottom: 16,
              }}
            >
              {featured.cover_url ? (
                <img
                  src={featured.cover_url}
                  alt={featured.title}
                  loading="lazy"
                  style={{ width: "100%", minHeight: 180, objectFit: "cover" }}
                />
              ) : null}
              <div style={{ padding: "18px 18px 20px" }}>
                {featured.category ? (
                  <span style={{ fontSize: 12, letterSpacing: 0.6, textTransform: "uppercase", color: accent }}>
                    {featured.category.name}
                  </span>
                ) : null}
                <h2
                  style={{
                    fontFamily: fonts.heading,
                    fontSize: "clamp(19px, 5vw, 24px)",
                    fontWeight: 700,
                    margin: "8px 0 0",
                    lineHeight: 1.3,
                    overflowWrap: "anywhere",
                  }}
                >
                  {featured.title}
                </h2>
                <p style={{ margin: "8px 0 0", color: muted, fontSize: 14, lineHeight: 1.65 }}>
                  {featured.excerpt || featured.seo_description}
                </p>
                <p style={{ margin: "12px 0 0", color: muted, fontSize: 12 }}>
                  {[featured.author_name, formatPostDate(featured.published_at ?? featured.updated_at), `${featured.readingMinutes} dk okuma`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </Link>
          ) : null}

          <div className="mf-blog-grid">

            {rest.map((post) => (
              <Link
                key={post.id}
                to="/s/$slug/page/$pageSlug"
                params={{ slug, pageSlug: post.slug }}
                style={{
                  background: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: radius,
                  overflow: "hidden",
                  textDecoration: "none",
                  color: "inherit",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {post.cover_url ? (
                  <img
                    src={post.cover_url}
                    alt={post.title}
                    loading="lazy"
                    style={{ width: "100%", height: 160, objectFit: "cover" }}
                  />
                ) : null}
                <div style={{ padding: "16px 18px", display: "grid", gap: 6 }}>
                  {post.category ? (
                    <span style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: accent }}>
                      {post.category.name}
                    </span>
                  ) : null}
                  <p style={{ margin: 0, fontFamily: fonts.heading, fontWeight: 600, fontSize: 17 }}>{post.title}</p>
                  {post.excerpt || post.seo_description ? (
                    <p style={{ margin: 0, color: muted, fontSize: 13.5, lineHeight: 1.6 }}>
                      {post.excerpt || post.seo_description}
                    </p>
                  ) : null}
                  <p style={{ margin: 0, color: muted, fontSize: 12 }}>
                    {[formatPostDate(post.published_at ?? post.updated_at), `${post.readingMinutes} dk okuma`]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {filtered.length > visible ? (
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 22 }}>
              <button
                type="button"
                onClick={() => setVisible((value) => value + PAGE_SIZE)}
                style={{ ...chipStyle(false), padding: "10px 20px", fontSize: 14 }}
              >
                Daha fazla yazı
              </button>
            </div>
          ) : null}
        </div>
      )}
    </StorefrontChrome>
  );
}
