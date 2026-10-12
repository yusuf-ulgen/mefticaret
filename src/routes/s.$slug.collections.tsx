import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useStorefrontLive } from "@/hooks/use-storefront-live";
import { useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { Breadcrumb, StorefrontFallback } from "@/components/storefront-parts";
import { storefrontQuery } from "@/lib/storefront-queries";
import { getRequestOrigin } from "@/lib/origin.functions";
import { getStoreSeoContext } from "@/lib/seo-public.functions";
import { missingHead, storefrontHead } from "@/lib/storefront-seo";

export const Route = createFileRoute("/s/$slug/collections")({
  loader: async ({ context, params }) => {
    const [data, ctx, origin] = await Promise.all([
      context.queryClient.ensureQueryData(storefrontQuery(params.slug)),
      getStoreSeoContext({ data: { slug: params.slug } }),
      getRequestOrigin(),
    ]);
    if (!data) throw notFound();
    return { storeName: data.store.name, count: data.collections.length, ctx, origin };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return missingHead("Mağaza bulunamadı");
    const base = `/s/${params.slug}`;
    return storefrontHead({
      ctx: loaderData.ctx,
      origin: loaderData.origin,
      slug: params.slug,
      path: `${base}/collections`,
      fallbackTitle: "Koleksiyonlar",
      fallbackDescription: `${loaderData.storeName} vitrinindeki ${loaderData.count} koleksiyonu keşfedin: sezon seçkileri, kampanyalar ve tematik ürün grupları.`,
      breadcrumbs: [
        { name: "Ana sayfa", path: base },
        { name: "Koleksiyonlar", path: `${base}/collections` },
      ],
    });
  },
  errorComponent: () => <StorefrontFallback text="Koleksiyonlar şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: CollectionsPage,
});

function CollectionsPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  useStorefrontLive(slug, data?.store?.id);
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
