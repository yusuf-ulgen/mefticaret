import { useMemo } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { Breadcrumb, ProductGrid, StorefrontFallback } from "@/components/storefront-parts";
import { storefrontQuery } from "@/lib/storefront-queries";

type Search = { c?: string | undefined };

export const Route = createFileRoute("/s/$slug/categories")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    c: typeof search["c"] === "string" && search["c"].trim() ? String(search["c"]).slice(0, 120) : undefined,
  }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { storeName: data.store.name };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Mağaza bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Kategoriler — ${loaderData.storeName}`;
    const description = `${loaderData.storeName} ürünlerini kategorilere göre keşfet; ilgilendiğin kategoriyi seçip tüm ürünleri listele.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: `/s/${params.slug}/categories` }],
    };
  },
  errorComponent: () => <StorefrontFallback text="Kategoriler şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: CategoriesPage,
});

function CategoriesPage() {
  const { slug } = Route.useParams();
  const { c } = Route.useSearch();
  const { data } = useSuspenseQuery(storefrontQuery(slug));

  const products = useMemo(() => data?.products ?? [], [data]);
  const groups = useMemo(() => {
    const map = new Map<string, number>();
    for (const product of products) {
      const key = product.product_type?.trim() || "Diğer";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"));
  }, [products]);

  const active = c && groups.some(([name]) => name === c) ? c : null;
  const visible = active
    ? products.filter((product) => (product.product_type?.trim() || "Diğer") === active)
    : products;

  if (!data) return <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme, footerPages } = data;
  const { fonts, muted, cardBg, border, radius, t } = storefrontTokens(theme);

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      <Breadcrumb theme={theme} slug={slug} storeName={store.name} current={active ?? "Kategoriler"} />
      <header style={{ padding: "20px 0 20px", maxWidth: 640 }}>
        <h1 style={{ fontFamily: fonts.heading, fontSize: 34, fontWeight: 700, margin: 0 }}>
          {active ?? "Kategoriler"}
        </h1>
        <p style={{ color: muted, marginTop: 10, fontSize: 15 }}>
          {active
            ? `${active} kategorisindeki ${visible.length} ürün.`
            : "Ürün türüne göre gruplanmış kategoriler. Bir kategori seçerek listeyi daralt."}
        </p>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 22 }}>
        <Link
          to="/s/$slug/categories"
          params={{ slug }}
          style={{
            border: `1px solid ${active ? border : t.accent_color}`,
            background: active ? cardBg : t.accent_color,
            color: active ? "inherit" : "#111",
            borderRadius: radius,
            padding: "7px 14px",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Tümü ({products.length})
        </Link>
        {groups.map(([name, count]) => (
          <Link
            key={name}
            to="/s/$slug/categories"
            params={{ slug }}
            search={{ c: name }}
            style={{
              border: `1px solid ${active === name ? t.accent_color : border}`,
              background: active === name ? t.accent_color : cardBg,
              color: active === name ? "#111" : "inherit",
              borderRadius: radius,
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {name} ({count})
          </Link>
        ))}
      </div>

      <ProductGrid
        theme={theme}
        slug={slug}
        storeCurrency={store.currency}
        products={visible}
        empty="Bu kategoride henüz ürün yok."
      />
    </StorefrontChrome>
  );
}
