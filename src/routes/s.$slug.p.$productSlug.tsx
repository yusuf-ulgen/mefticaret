import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { formatMoney } from "@/lib/mefti";
import { storefrontProductQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/p/$productSlug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(
      storefrontProductQuery(params.slug, params.productSlug),
    );
    if (!data) throw notFound();
    return {
      title: data.product.title,
      storeName: data.store.name,
      description: (data.product.description ?? "").slice(0, 150),
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Ürün bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.title} — ${loaderData.storeName}`;
    const description = loaderData.description || `${loaderData.title} ürününü ${loaderData.storeName} vitrininde keşfet.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
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

  if (!data) return <Fallback text="Bu ürün bulunamadı." />;
  const { store, theme, product, variants, images } = data;
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

          {product.description ? (
            <p style={{ marginTop: 24, color: muted, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-line" }}>
              {product.description}
            </p>
          ) : null}
        </div>
      </section>
    </StorefrontChrome>
  );
}
