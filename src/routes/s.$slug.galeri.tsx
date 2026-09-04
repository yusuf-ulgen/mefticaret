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
import { trackBlogShare, trackBlogView } from "@/lib/blog-track";

/**
 * Blog galerisi: yayınlanmış yazıları kapak görselleriyle görsel bir ızgarada
 * gösterir. Kart açıldığında büyük önizleme (lightbox) gelir, yazıya geçiş ve
 * paylaşım buradan da izlenir.
 */
export const Route = createFileRoute("/s/$slug/galeri")({
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
      path: `${base}/galeri`,
      fallbackTitle: "Blog Galerisi",
      fallbackDescription: `${loaderData.storeName} blog galerisi: yazıların kapak görselleri, rehberler ve kampanya içerikleri tek ekranda.`,
      breadcrumbs: [
        { name: "Ana sayfa", path: base },
        { name: "Blog", path: `${base}/blog` },
        { name: "Galeri", path: `${base}/galeri` },
      ],
    });
  },
  errorComponent: () => <StorefrontFallback text="Galeri şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: GalleryPage,
});

function GalleryPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const blog = useQuery(storefrontBlogQuery(slug));
  const [category, setCategory] = useState<string | null>(null);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const posts = blog.data?.posts ?? [];
  const withCover = useMemo(
    () => posts.filter((post) => Boolean(post.cover_url) && (!category || post.category?.slug === category)),
    [posts, category],
  );

  if (!data) return <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme, footerPages } = data;
  const { fonts, muted, cardBg, border, radius, t } = storefrontTokens(theme);
  const accent = t.accent_color ?? muted;
  const active = openIndex !== null ? withCover[openIndex] ?? null : null;

  const chip = (isActive: boolean) => ({
    border: `1px solid ${isActive ? "currentColor" : border}`,
    background: isActive ? "rgba(0,0,0,0.06)" : cardBg,
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 13,
    cursor: "pointer",
    color: "inherit",
    minHeight: 40,
  });

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      <Breadcrumb theme={theme} slug={slug} storeName={store.name} current="Galeri" />
      <header style={{ padding: "18px 0", maxWidth: 680 }}>
        <h1 style={{ fontFamily: fonts.heading, fontSize: "clamp(26px, 6.4vw, 34px)", fontWeight: 700, margin: 0 }}>
          Blog galerisi
        </h1>
        <p style={{ color: muted, marginTop: 10, fontSize: "clamp(14px, 3.9vw, 15px)" }}>
          Yazıların kapak görsellerine göz at, beğendiğine dokunup okumaya başla.
        </p>
        <Link
          to="/s/$slug/blog"
          params={{ slug }}
          style={{ display: "inline-block", marginTop: 12, color: accent, fontSize: 14 }}
        >
          Tüm yazılar →
        </Link>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingBottom: 16 }}>
        <button type="button" onClick={() => setCategory(null)} style={chip(!category)}>
          Tümü
        </button>
        {(blog.data?.categories ?? []).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(category === item.slug ? null : item.slug)}
            style={chip(category === item.slug)}
          >
            {item.name}
          </button>
        ))}
      </div>

      {blog.isLoading ? (
        <p style={{ color: muted, paddingBottom: 60 }}>Galeri yükleniyor…</p>
      ) : withCover.length === 0 ? (
        <p style={{ color: muted, paddingBottom: 60 }}>
          Kapak görselli yayınlanmış yazı yok. Panelden yazıya kapak görseli ekleyince burada görünür.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            paddingBottom: 64,
          }}
        >
          {withCover.map((post, index) => (
            <button
              key={post.id}
              type="button"
              onClick={() => {
                setOpenIndex(index);
                trackBlogView({ postId: post.id, title: post.title });
              }}
              style={{
                padding: 0,
                border: `1px solid ${border}`,
                background: cardBg,
                borderRadius: radius,
                overflow: "hidden",
                cursor: "zoom-in",
                color: "inherit",
                textAlign: "left",
              }}
            >
              <img
                src={post.cover_url ?? ""}
                alt={post.title}
                loading="lazy"
                style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", display: "block" }}
              />
              <span style={{ display: "block", padding: "10px 12px", fontSize: 13.5, lineHeight: 1.45 }}>
                {post.title}
                <span style={{ display: "block", color: muted, fontSize: 12, marginTop: 4 }}>
                  {post.readingMinutes} dk okuma
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
          onClick={() => setOpenIndex(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.78)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 80,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              background: cardBg,
              borderRadius: radius,
              maxWidth: 720,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <img
              src={active.cover_url ?? ""}
              alt={active.title}
              style={{ width: "100%", maxHeight: "55vh", objectFit: "cover", display: "block" }}
            />
            <div style={{ padding: "16px 18px 20px" }}>
              <h2 style={{ margin: 0, fontFamily: fonts.heading, fontSize: "clamp(18px, 5vw, 22px)" }}>
                {active.title}
              </h2>
              {active.excerpt || active.seo_description ? (
                <p style={{ color: muted, fontSize: 14, lineHeight: 1.65, marginTop: 8 }}>
                  {active.excerpt || active.seo_description}
                </p>
              ) : null}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
                <Link
                  to="/s/$slug/page/$pageSlug"
                  params={{ slug, pageSlug: active.slug }}
                  style={{
                    ...chip(true),
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "10px 16px",
                  }}
                >
                  Yazıyı oku
                </Link>
                <button
                  type="button"
                  style={chip(false)}
                  onClick={async () => {
                    const url = `${window.location.origin}/s/${slug}/page/${active.slug}`;
                    try {
                      await navigator.clipboard.writeText(url);
                    } catch {
                      /* kopyalama engellenmiş olabilir */
                    }
                    trackBlogShare({ postId: active.id, title: active.title, method: "galeri-kopyala" });
                  }}
                >
                  Bağlantıyı kopyala
                </button>
                <button type="button" style={chip(false)} onClick={() => setOpenIndex(null)}>
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </StorefrontChrome>
  );
}
