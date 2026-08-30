import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { toast } from "sonner";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { RecentlyViewed } from "@/components/recently-viewed";
import { StorefrontQuestions } from "@/components/storefront-questions";
import { StorefrontReviews } from "@/components/storefront-reviews";
import { StockAlertForm } from "@/components/stock-alert-form";
import { useCart } from "@/lib/cart";
import { useCompare } from "@/lib/compare";
import { useFavorites } from "@/lib/favorites";
import { formatMoney } from "@/lib/mefti";
import { recordRecentProduct } from "@/lib/recently-viewed";
import { storefrontProductQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/p/$productSlug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      storefrontProductQuery(params.slug, params.productSlug),
    );
    if (!data) throw notFound();
    const seo = (data.product.seo ?? {}) as { title?: string; description?: string };
    return {
      title: data.product.title,
      storeName: data.store.name,
      description: (seo.description?.trim() || (data.product.description ?? "")).slice(0, 160),
      seoTitle: seo.title?.trim() ?? "",
      price: data.product.base_price,
      currency: data.product.currency,
      image: data.images[0]?.url ?? null,
      ratingAverage: data.ratingAverage ?? 0,
      reviewCount: data.reviews.length,
      inStock: data.variants.length ? data.variants.some((variant) => variant.stock > 0) : true,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Ürün bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = loaderData.seoTitle || `${loaderData.title} — ${loaderData.storeName}`;
    const description = loaderData.description || `${loaderData.title} ürününü ${loaderData.storeName} vitrininde keşfet.`;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: loaderData.title,
      description,
      ...(loaderData.image ? { image: [loaderData.image] } : {}),
      brand: { "@type": "Brand", name: loaderData.storeName },
      offers: {
        "@type": "Offer",
        price: loaderData.price,
        priceCurrency: loaderData.currency,
        availability: loaderData.inStock
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      },
      ...(loaderData.reviewCount > 0
        ? {
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: loaderData.ratingAverage,
              reviewCount: loaderData.reviewCount,
            },
          }
        : {}),
    };
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
    };
  },

  errorComponent: () => <Fallback text="Ürün şu anda yüklenemedi." />,
  notFoundComponent: () => <Fallback text="Bu ürün bulunamadı." />,
  component: ProductPage,
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

function ProductPage() {
  const { slug, productSlug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontProductQuery(slug, productSlug));
  const [variantId, setVariantId] = useState<string | null>(null);
  const cart = useCart();
  const favorites = useFavorites();
  const compare = useCompare();
  const navigate = useNavigate();

  useEffect(() => {
    if (!data) return;
    recordRecentProduct({
      storeSlug: data.store.slug,
      productSlug: data.product.slug,
      title: data.product.title,
      price: Number(data.product.base_price),
      currency: data.product.currency,
      image: data.images[0]?.url ?? null,
    });
  }, [data]);

  if (!data) return <Fallback text="Bu ürün bulunamadı." />;
  const { store, theme, product, variants, images, reviews, ratingAverage, related } = data;
  const { t, fonts, muted, cardBg, border, radius, dark } = storefrontTokens(theme);

  const selected = variants.find((variant) => variant.id === variantId) ?? variants[0] ?? null;
  const price = selected ? selected.price : product.base_price;
  const inStock = selected ? selected.stock > 0 : true;

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug}>
      <nav style={{ padding: "20px 0", fontSize: 13, color: muted }}>
        <Link to="/s/$slug" params={{ slug: store.slug }} style={{ color: muted, textDecoration: "none" }}>
          Ürünler
        </Link>
        <span> / {product.title}</span>
      </nav>

      <section style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,420px)", gap: 32 }}>
        <div>
          {images.length ? (
            <img
              src={images[0]!.url}
              alt={images[0]!.alt ?? product.title}
              loading="lazy"
              style={{ width: "100%", borderRadius: radius, border: `1px solid ${border}` }}
            />
          ) : (
            <div
              style={{
                height: 420,
                borderRadius: radius,
                border: `1px solid ${border}`,
                background: dark
                  ? "linear-gradient(140deg, rgba(255,255,255,.12), rgba(255,255,255,.03))"
                  : `linear-gradient(140deg, ${t.accent_color}22, ${t.primary_color}12)`,
              }}
            />
          )}
        </div>

        <div>
          <h1 style={{ fontFamily: fonts.heading, fontSize: 30, margin: 0, fontWeight: 700 }}>{product.title}</h1>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 700 }}>{formatMoney(price, product.currency)}</span>
            {product.compare_at_price ? (
              <span style={{ color: muted, textDecoration: "line-through" }}>
                {formatMoney(product.compare_at_price, product.currency)}
              </span>
            ) : null}
          </div>

          {variants.length > 1 ? (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, color: muted, marginBottom: 8 }}>Seçenek</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {variants.map((variant) => {
                  const active = selected?.id === variant.id;
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => setVariantId(variant.id)}
                      style={{
                        border: `1px solid ${active ? t.accent_color : border}`,
                        background: active ? `${t.accent_color}22` : cardBg,
                        color: "inherit",
                        borderRadius: radius,
                        padding: "8px 14px",
                        fontSize: 13,
                        cursor: "pointer",
                        opacity: variant.stock > 0 ? 1 : 0.5,
                      }}
                    >
                      {variant.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div style={{ marginTop: 14, fontSize: 13, color: muted }}>
            {inStock ? "Stokta var" : "Tükendi"}
            {selected?.sku ? ` · SKU: ${selected.sku}` : ""}
          </div>

          <button
            type="button"
            disabled={!inStock}
            onClick={() => {
              if (!selected) return;
              cart.add({
                storeSlug: store.slug,
                variantId: selected.id,
                productSlug: product.slug,
                title: product.title,
                variantTitle: selected.title,
                price: Number(selected.price ?? product.base_price),
                currency: product.currency,
                maxStock: selected.stock ?? 0,
              });
              toast.success("Ürün sepete eklendi");
              void navigate({ to: "/s/$slug/cart", params: { slug: store.slug } });
            }}
            style={{
              marginTop: 24,
              width: "100%",
              background: t.accent_color,
              color: "#12181f",
              border: "none",
              borderRadius: radius,
              padding: "14px 20px",
              fontSize: 15,
              fontWeight: 600,
              cursor: inStock ? "pointer" : "not-allowed",
              opacity: inStock ? 1 : 0.6,
            }}
          >
            {inStock ? "Sepete ekle" : "Stokta yok"}
          </button>

          {inStock ? null : (
            <StockAlertForm
              slug={store.slug}
              productSlug={product.slug}
              variantId={selected?.id}
              accent={t.accent_color}
              border={border}
              muted={muted}
              radius={radius}
            />
          )}

          <button
            type="button"
            onClick={() => {
              const added = favorites.toggle({
                storeSlug: store.slug,
                productSlug: product.slug,
                title: product.title,
                price: Number(price),
                currency: product.currency,
                image: images[0]?.url ?? null,
              });
              toast.success(added ? "Favorilere eklendi" : "Favorilerden çıkarıldı");
            }}
            style={{
              marginTop: 10,
              width: "100%",
              background: "transparent",
              color: "inherit",
              border: `1px solid ${border}`,
              borderRadius: radius,
              padding: "12px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {favorites.isFavorite(store.slug, product.slug)
              ? "♥ Favorilerimde"
              : "♡ Favorilere ekle"}
          </button>

          <button
            type="button"
            onClick={() => {
              const result = compare.toggle({ storeSlug: store.slug, productSlug: product.slug });
              if (result === null) {
                toast.error(`En fazla ${compare.limit} ürün karşılaştırabilirsin`);
                return;
              }
              toast.success(result ? "Karşılaştırma listesine eklendi" : "Karşılaştırmadan çıkarıldı");
            }}
            style={{
              marginTop: 10,
              width: "100%",
              background: "transparent",
              color: "inherit",
              border: `1px solid ${border}`,
              borderRadius: radius,
              padding: "12px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {compare.isSelected(store.slug, product.slug)
              ? "⇄ Karşılaştırmada"
              : "⇄ Karşılaştır"}
          </button>

          {product.description ? (
            <p style={{ marginTop: 24, color: muted, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-line" }}>
              {product.description}
            </p>
          ) : null}
        </div>
      </section>

      <StorefrontReviews
        storeSlug={store.slug}
        productId={product.id}
        reviews={reviews}
        ratingAverage={ratingAverage}
        tokens={{
          accent: t.accent_color,
          muted,
          border,
          cardBg,
          radius,
          headingFont: fonts.heading,
        }}
      />

      <StorefrontQuestions
        storeSlug={store.slug}
        productId={product.id}
        tokens={{
          accent: t.accent_color,
          muted,
          border,
          cardBg,
          radius,
          headingFont: fonts.heading,
        }}
      />

      <RecentlyViewed
        storeSlug={store.slug}
        excludeSlug={product.slug}
        tokens={{ muted, border, cardBg, radius, headingFont: fonts.heading }}
      />

      {related.length ? (
        <section style={{ padding: "40px 0 8px" }}>
          <h2 style={{ fontFamily: fonts.heading, fontSize: 22, marginBottom: 16 }}>
            Benzer ürünler
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 16,
            }}
          >
            {related.map((item) => (
              <Link
                key={item.id}
                to="/s/$slug/p/$productSlug"
                params={{ slug: store.slug, productSlug: item.slug }}
                style={{
                  display: "block",
                  border: `1px solid ${border}`,
                  borderRadius: radius,
                  background: cardBg,
                  overflow: "hidden",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                {item.coverUrl ? (
                  <img
                    src={item.coverUrl}
                    alt={item.title}
                    loading="lazy"
                    style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      background: dark ? "#1b1b1b" : "#f3f3f3",
                    }}
                  />
                )}
                <div style={{ padding: 12 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{item.title}</p>
                  <p style={{ fontSize: 13, color: muted, margin: "6px 0 0" }}>
                    {formatMoney(item.base_price, item.currency)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </StorefrontChrome>

  );
}
