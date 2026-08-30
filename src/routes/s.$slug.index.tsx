import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { formatMoney } from "@/lib/mefti";
import { storefrontQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.store.name, hero: data.theme?.hero_subtitle ?? "" };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Mağaza bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.name} — Online Mağaza`;
    const description =
      loaderData.hero || `${loaderData.name} vitrininde yeni sezon ürünleri keşfet, hızlı ve güvenli alışveriş yap.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        {
          rel: "sitemap",
          type: "application/xml",
          href: `/api/public/sitemap/${params.slug}`,
        },
      ],
    };
  },

  errorComponent: () => <StorefrontFallback text="Vitrin şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: StorefrontHome,
});

function StorefrontFallback({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">{text}</h1>
      <Link to="/" className="text-sm underline">
        Mefticaret ana sayfası
      </Link>
    </div>
  );
}

function StorefrontHome() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return data.products;
    return data.products.filter((p) =>
      [p.title, p.description ?? "", p.product_type ?? "", ...(p.tags ?? [])]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q),
    );
  }, [data, query]);

  if (!data) return <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />;

  const { store, theme, products, collections, footerPages } = data;
  const { t, fonts, muted, cardBg, border, radius, dark } = storefrontTokens(theme);
  const split = t.layout === "split-screen";
  const columns = t.layout === "magazine" ? "repeat(auto-fill, minmax(320px, 1fr))" : "repeat(auto-fill, minmax(240px, 1fr))";

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      <section
        style={{
          display: split ? "grid" : "block",
          gridTemplateColumns: split ? "1.1fr .9fr" : undefined,
          gap: 28,
          padding: "48px 0",
          alignItems: "center",
        }}
      >
        <div style={{ maxWidth: split ? undefined : 620 }}>
          <h1 style={{ fontFamily: fonts.heading, fontSize: 42, lineHeight: 1.08, fontWeight: 700, margin: 0 }}>
            {t.hero_title}
          </h1>
          <p style={{ color: muted, marginTop: 14, fontSize: 16 }}>{t.hero_subtitle}</p>
          <a
            href="#urunler"
            style={{
              display: "inline-block",
              marginTop: 24,
              background: t.accent_color,
              color: "#12181f",
              padding: "12px 22px",
              borderRadius: radius,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {t.hero_cta_label}
          </a>
        </div>
        {split ? (
          <div
            style={{
              background: `linear-gradient(140deg, ${t.primary_color}, ${t.accent_color})`,
              borderRadius: radius,
              minHeight: 240,
            }}
          />
        ) : null}
      </section>

      {collections.length ? (
        <section id="koleksiyonlar" style={{ paddingBottom: 32 }}>
          <h2 style={{ fontFamily: fonts.heading, fontSize: 20, margin: "0 0 12px" }}>Koleksiyonlar</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {collections.map((collection) => (
              <Link
                key={collection.id}
                to="/s/$slug/c/$collectionSlug"
                params={{ slug: store.slug, collectionSlug: collection.slug }}
                style={{
                  border: `1px solid ${border}`,
                  borderRadius: 999,
                  padding: "6px 14px",
                  fontSize: 13,
                  color: muted,
                  textDecoration: "none",
                }}
              >
                {collection.title}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section id="urunler">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <h2 style={{ fontFamily: fonts.heading, fontSize: 24, margin: 0 }}>Ürünler</h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ürün ara…"
            aria-label="Ürünlerde ara"
            style={{
              background: cardBg,
              color: "inherit",
              border: `1px solid ${border}`,
              borderRadius: radius,
              padding: "9px 14px",
              fontSize: 14,
              fontFamily: "inherit",
              minWidth: 220,
            }}
          />
        </div>
        {products.length === 0 ? (
          <p style={{ color: muted }}>Bu mağazada henüz yayınlanmış ürün yok.</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: muted }}>“{query}” aramasıyla eşleşen ürün bulunamadı.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: columns, gap: 18 }}>
            {filtered.map((product) => (
              <Link
                key={product.id}
                to="/s/$slug/p/$productSlug"
                params={{ slug: store.slug, productSlug: product.slug }}
                style={{
                  background: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: radius,
                  padding: 16,
                  textDecoration: "none",
                  color: "inherit",
                  display: "block",
                }}
              >
                <div
                  style={{
                    height: 160,
                    borderRadius: radius,
                    overflow: "hidden",
                    background: dark
                      ? "linear-gradient(140deg, rgba(255,255,255,.12), rgba(255,255,255,.03))"
                      : `linear-gradient(140deg, ${t.accent_color}22, ${t.primary_color}12)`,
                    marginBottom: 14,
                  }}
                >
                  {product.coverUrl ? (
                    <img
                      src={product.coverUrl}
                      alt={product.title}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : null}
                </div>
                <div style={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 15 }}>{product.title}</div>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{formatMoney(product.base_price, product.currency)}</span>
                  {product.compare_at_price ? (
                    <span style={{ color: muted, textDecoration: "line-through", fontSize: 13 }}>
                      {formatMoney(product.compare_at_price, product.currency)}
                    </span>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </StorefrontChrome>
  );
}
