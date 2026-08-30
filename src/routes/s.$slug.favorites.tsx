import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { useFavorites } from "@/lib/favorites";
import { formatMoney } from "@/lib/mefti";
import { storefrontQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/favorites")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.store.name };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Mağaza bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Favorilerim — ${loaderData.name}`;
    const description = `${loaderData.name} vitrininde beğendiğin ürünleri favorilerinde sakla, dilediğin zaman sepete ekle.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  errorComponent: () => <Fallback text="Favoriler şu anda yüklenemedi." />,
  notFoundComponent: () => <Fallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: FavoritesPage,
});

function Fallback({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">{text}</h1>
      <Link to="/" className="text-sm underline">
        Mefticaret ana sayfası
      </Link>
    </div>
  );
}

function FavoritesPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const favorites = useFavorites();

  if (!data) return <Fallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme } = data;
  const { t, fonts, muted, cardBg, border, radius } = storefrontTokens(theme);
  const items = favorites.itemsFor(store.slug);

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug}>
      <div style={{ padding: "28px 0 12px", display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontFamily: fonts.heading, fontSize: 28, margin: 0, fontWeight: 700 }}>
          Favorilerim
        </h1>
        <span style={{ fontSize: 13, color: muted }}>{items.length} ürün</span>
        {items.length ? (
          <button
            type="button"
            onClick={() => favorites.clear(store.slug)}
            style={{
              marginLeft: "auto",
              background: "transparent",
              color: muted,
              border: `1px solid ${border}`,
              borderRadius: radius,
              padding: "6px 12px",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Listeyi temizle
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div
          style={{
            border: `1px solid ${border}`,
            background: cardBg,
            borderRadius: radius,
            padding: "48px 24px",
            textAlign: "center",
            color: muted,
            fontSize: 14,
          }}
        >
          <p style={{ margin: 0 }}>Henüz favori ürünün yok.</p>
          <Link
            to="/s/$slug"
            params={{ slug: store.slug }}
            style={{
              display: "inline-block",
              marginTop: 16,
              background: t.accent_color,
              color: "#12181f",
              borderRadius: radius,
              padding: "10px 18px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Ürünleri keşfet
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 20,
          }}
        >
          {items.map((item) => (
            <div
              key={item.productSlug}
              style={{
                border: `1px solid ${border}`,
                background: cardBg,
                borderRadius: radius,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.title}
                  loading="lazy"
                  style={{ width: "100%", height: 180, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    height: 180,
                    background: `linear-gradient(140deg, ${t.accent_color}22, ${t.primary_color}12)`,
                  }}
                />
              )}
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                <Link
                  to="/s/$slug/p/$productSlug"
                  params={{ slug: store.slug, productSlug: item.productSlug }}
                  style={{ color: "inherit", textDecoration: "none", fontWeight: 600, fontSize: 15 }}
                >
                  {item.title}
                </Link>
                <span style={{ fontSize: 14 }}>{formatMoney(item.price, item.currency)}</span>
                <button
                  type="button"
                  onClick={() => favorites.remove(store.slug, item.productSlug)}
                  style={{
                    marginTop: "auto",
                    background: "transparent",
                    color: muted,
                    border: `1px solid ${border}`,
                    borderRadius: radius,
                    padding: "8px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Favorilerden çıkar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </StorefrontChrome>
  );
}
