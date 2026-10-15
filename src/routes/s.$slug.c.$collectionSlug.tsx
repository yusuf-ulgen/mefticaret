import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useStorefrontLive } from "@/hooks/use-storefront-live";
import { useSuspenseQuery } from "@tanstack/react-query";

import { FavoriteButton } from "@/components/favorite-button";
import { QuickAddButton } from "@/components/quick-add-button";
import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { WokieeProductCard } from "@/components/wokiee/product-card";
import { formatMoney } from "@/lib/display-currency";
import { storefrontCollectionQuery } from "@/lib/storefront-queries";
import { getRequestOrigin } from "@/lib/origin.functions";
import { getStoreSeoContext } from "@/lib/seo-public.functions";
import { plainText } from "@/lib/seo";
import { missingHead, storefrontHead } from "@/lib/storefront-seo";

export const Route = createFileRoute("/s/$slug/c/$collectionSlug")({
  loader: async ({ context, params }) => {
    const [data, ctx, origin] = await Promise.all([
      context.queryClient.ensureQueryData(storefrontCollectionQuery(params.slug, params.collectionSlug)),
      getStoreSeoContext({ data: { slug: params.slug, collectionSlug: params.collectionSlug } }),
      getRequestOrigin(),
    ]);
    if (!data) throw notFound();
    return {
      storeName: data.store.name,
      title: data.collection.title,
      description: plainText(data.collection.description ?? ""),
      ctx,
      origin,
    };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return missingHead("Koleksiyon bulunamadı");
    const base = `/s/${params.slug}`;
    return storefrontHead({
      ctx: loaderData.ctx,
      origin: loaderData.origin,
      slug: params.slug,
      path: `${base}/c/${params.collectionSlug}`,
      fallbackTitle: loaderData.title,
      fallbackDescription:
        loaderData.description ||
        `${loaderData.storeName} ${loaderData.title} koleksiyonundaki ürünleri keşfedin.`,
      seo: loaderData.ctx?.entity ?? null,
      templateKey: "collection",
      tokens: { collection_name: loaderData.title },
      breadcrumbs: [
        { name: "Ana sayfa", path: base },
        { name: "Koleksiyonlar", path: `${base}/collections` },
        { name: loaderData.title, path: `${base}/c/${params.collectionSlug}` },
      ],
    });
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Bu koleksiyon bulunamadı.</h1>
    </div>
  ),
  component: CollectionPage,
});

type SortKey = "newest" | "price_asc" | "price_desc" | "title";

function CollectionPage() {
  const { slug, collectionSlug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontCollectionQuery(slug, collectionSlug));
  useStorefrontLive(slug, data?.store?.id);
  if (!data) return null;

  const { store, theme, collection, products } = data;
  const { t, fonts, muted, cardBg, border, radius, dark } = storefrontTokens(theme);

  const [sort, setSort] = useState<SortKey>("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [type, setType] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const types = useMemo(
    () => [...new Set(products.map((p) => p.product_type).filter((v): v is string => Boolean(v)))].sort(),
    [products],
  );

  const visible = useMemo(() => {
    const min = minPrice.trim() ? Number(minPrice) : null;
    const max = maxPrice.trim() ? Number(maxPrice) : null;
    const list = products.filter((product) => {
      if (type !== "all" && product.product_type !== type) return false;
      const price = Number(product.base_price);
      if (min !== null && Number.isFinite(min) && price < min) return false;
      if (max !== null && Number.isFinite(max) && price > max) return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "price_asc") sorted.sort((a, b) => Number(a.base_price) - Number(b.base_price));
    else if (sort === "price_desc") sorted.sort((a, b) => Number(b.base_price) - Number(a.base_price));
    else if (sort === "title") sorted.sort((a, b) => a.title.localeCompare(b.title, "tr"));
    return sorted;
  }, [products, type, minPrice, maxPrice, sort]);

  const controlStyle = {
    background: "transparent",
    color: "inherit",
    border: `1px solid ${border}`,
    borderRadius: radius,
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "inherit",
  } as const;

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
        <>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            alignItems: "center",
            border: `1px solid ${border}`,
            background: cardBg,
            borderRadius: radius,
            padding: 12,
            marginBottom: 18,
          }}
        >
          <select style={controlStyle} value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="newest">Sıralama: Yeni eklenenler</option>
            <option value="price_asc">Fiyat: Artan</option>
            <option value="price_desc">Fiyat: Azalan</option>
            <option value="title">İsme göre (A-Z)</option>
          </select>
          {types.length > 0 ? (
            <select style={controlStyle} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">Tüm türler</option>
              {types.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          ) : null}
          <input
            style={{ ...controlStyle, width: 100 }}
            inputMode="numeric"
            placeholder="Min ₺"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <input
            style={{ ...controlStyle, width: 100 }}
            inputMode="numeric"
            placeholder="Max ₺"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setView((current) => (current === "grid" ? "list" : "grid"))}
            style={{ ...controlStyle, cursor: "pointer" }}
            aria-label="Görünümü değiştir"
          >
            {view === "grid" ? "☰ Liste görünümü" : "▦ Izgara görünümü"}
          </button>
          <span style={{ fontSize: 12, color: muted, marginLeft: "auto" }}>
            {visible.length} / {products.length} ürün
          </span>

          {(type !== "all" || minPrice || maxPrice || sort !== "newest") && (
            <button
              type="button"
              onClick={() => {
                setType("all");
                setMinPrice("");
                setMaxPrice("");
                setSort("newest");
              }}
              style={{ ...controlStyle, cursor: "pointer", color: t.accent_color, borderColor: t.accent_color }}
            >
              Temizle
            </button>
          )}
        </div>
        {visible.length === 0 ? (
          <p style={{ color: muted, paddingBottom: 40 }}>Seçtiğiniz filtrelere uygun ürün bulunamadı.</p>
        ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: view === "list" ? "minmax(0,1fr)" : "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 18,
            paddingBottom: 40,
          }}
        >
          {visible.map((product) => (
            <WokieeProductCard
              key={product.id}
              theme={t}
              storeSlug={store.slug}
              product={product}
              view={view}
            />
          ))}
        </div>
        )}

        </>
      )}
    </StorefrontChrome>
  );
}
