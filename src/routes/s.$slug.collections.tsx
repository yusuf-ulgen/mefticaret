import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { Breadcrumb, StorefrontFallback } from "@/components/storefront-parts";
import { storefrontQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/collections")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { storeName: data.store.name, count: data.collections.length };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Mağaza bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Koleksiyonlar — ${loaderData.storeName}`;
    const description = `${loaderData.storeName} vitrinindeki ${loaderData.count} koleksiyonu keşfet: sezon seçkileri, kampanyalar ve tematik ürün grupları.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `/s/${params.slug}/collections` }],
    };
  },
  errorComponent: () => <StorefrontFallback text="Koleksiyonlar şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: CollectionsPage,
});

function CollectionsPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  if (!data) return <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme, collections, footerPages } = data;
  const { fonts, muted, cardBg, border, radius } = storefrontTokens(theme);

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      <Breadcrumb theme={theme} slug={slug} storeName={store.name} current="Koleksiyonlar" />
      <header style={{ padding: "20px 0 24px", maxWidth: 640 }}>
        <h1 style={{ fontFamily: fonts.heading, fontSize: 34, fontWeight: 700, margin: 0 }}>Koleksiyonlar</h1>
        <p style={{ color: muted, marginTop: 10, fontSize: 15 }}>
          Sezon seçkileri ve tematik ürün grupları. Bir koleksiyona girerek içindeki tüm ürünleri görebilirsin.
        </p>
      </header>

      {collections.length === 0 ? (
        <p style={{ color: muted, paddingBottom: 60 }}>Henüz yayınlanmış bir koleksiyon yok.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
            paddingBottom: 64,
          }}
        >
          {collections.map((collection) => (
            <Link
              key={collection.id}
              to="/s/$slug/c/$collectionSlug"
              params={{ slug, collectionSlug: collection.slug }}
              style={{
                background: cardBg,
                border: `1px solid ${border}`,
                borderRadius: radius,
                padding: "18px 18px 20px",
                textDecoration: "none",
                color: "inherit",
                display: "block",
              }}
            >
              <p style={{ margin: 0, fontFamily: fonts.heading, fontWeight: 600, fontSize: 18 }}>{collection.title}</p>
              <p style={{ margin: "8px 0 0", color: muted, fontSize: 14, lineHeight: 1.6 }}>
                {collection.description?.trim() || "Koleksiyonu görüntüle"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </StorefrontChrome>
  );
}
