import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { formatMoney } from "@/lib/mefti";
import { storefrontCollectionQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/c/$collectionSlug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      storefrontCollectionQuery(params.slug, params.collectionSlug),
    );
    if (!data) throw notFound();
    return {
      storeName: data.store.name,
      title: data.collection.title,
      description: data.collection.description ?? "",
    };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Koleksiyon bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.title} — ${loaderData.storeName}`;
    const description =
      loaderData.description || `${loaderData.storeName} ${loaderData.title} koleksiyonundaki ürünleri keşfet.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `/s/${params.slug}/c/${params.collectionSlug}` }],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Bu koleksiyon bulunamadı.</h1>
    </div>
  ),
  component: CollectionPage,
});

function CollectionPage() {
  const { slug, collectionSlug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontCollectionQuery(slug, collectionSlug));
  if (!data) return null;

  const { store, theme, collection, products } = data;
  const { t, fonts, muted, cardBg, border, radius, dark } = storefrontTokens(theme);

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug}>
      <nav style={{ marginTop: 28, fontSize: 13, color: muted }}>
        <Link to="/s/$slug" params={{ slug }} style={{ color: "inherit" }}>
          {store.name}
        </Link>
        {" / "}
        <span>{collection.title}</span>
      </nav>

      <header style={{ padding: "20px 0 28px", maxWidth: 640 }}>
        <h1 style={{ fontFamily: fonts.heading, fontSize: 34, fontWeight: 700, margin: 0 }}>{collection.title}</h1>
        {collection.description ? (
          <p style={{ color: muted, marginTop: 10, fontSize: 15 }}>{collection.description}</p>
        ) : null}
      </header>

      {products.length === 0 ? (
        <p style={{ color: muted }}>Bu koleksiyonda henüz yayınlanmış ürün yok.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 18,
            paddingBottom: 40,
          }}
        >
          {products.map((product) => (
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
                  background: dark
                    ? "linear-gradient(140deg, rgba(255,255,255,.12), rgba(255,255,255,.03))"
                    : `linear-gradient(140deg, ${t.accent_color}22, ${t.primary_color}12)`,
                  marginBottom: 14,
                }}
              />
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
    </StorefrontChrome>
  );
}
