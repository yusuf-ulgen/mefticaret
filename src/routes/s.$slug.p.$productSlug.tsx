import { Fragment, useEffect, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { toast } from "sonner";

import { StorefrontAdminLink } from "@/components/storefront-admin-link";
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
import { trackEvent } from "@/lib/track";
import { getRequestOrigin } from "@/lib/origin.functions";
import {
  absoluteUrl,
  breadcrumbSchema,
  buildSeoHead,
  buildTitle,
  jsonLdScript,
  plainText,
  productSchema,
  readSeo,
} from "@/lib/seo";

/** YouTube/Vimeo adreslerini gömme adresine çevirir. */
function embedUrl(url: string) {
  const yt = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

export const Route = createFileRoute("/s/$slug/p/$productSlug")({
  loader: async ({ context, params }) => {
    const [data, origin] = await Promise.all([
      context.queryClient.ensureQueryData(storefrontProductQuery(params.slug, params.productSlug)),
      getRequestOrigin(),
    ]);
    if (!data) throw notFound();
    const seo = readSeo(data.product.seo);
    return {
      origin,
      slug: params.slug,
      productSlug: params.productSlug,
      title: data.product.title,
      storeName: data.store.name,
      seo,
      description: seo.description || plainText(data.product.description),
      price: data.product.base_price,
      currency: data.product.currency,
      images: data.images.map((image) => image.url).filter(Boolean).slice(0, 6),
      brand: data.product.vendor || data.product.seller_name || data.store.name,
      sku: data.product.sku,
      barcode: data.product.barcode,
      category: data.product.product_type,
      ratingAverage: data.ratingAverage ?? 0,
      reviewCount: data.reviews.length,
      inStock: data.variants.length ? data.variants.some((variant) => variant.stock > 0) : true,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Ürün bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const base = `/s/${loaderData.slug}`;
    const path = loaderData.seo.canonical || `${base}/p/${loaderData.productSlug}`;
    const title = loaderData.seo.title || buildTitle(loaderData.title, loaderData.storeName);
    const description =
      loaderData.description ||
      `${loaderData.title} ürününü ${loaderData.storeName} vitrininde keşfedin.`;
    const image = loaderData.seo.ogImage || loaderData.images[0] || null;
    const canonicalUrl = absoluteUrl(path, loaderData.origin);

    const head = buildSeoHead({
      title,
      description,
      canonicalPath: path,
      origin: loaderData.origin,
      image,
      ogType: "product",
      siteName: loaderData.storeName,
      locale: "tr_TR",
      ...(loaderData.seo.keywords ? { keywords: loaderData.seo.keywords } : {}),
      ...(loaderData.seo.noindex ? { noindex: true } : {}),
    });

    const breadcrumbs = [
      { name: "Ana sayfa", path: base },
      { name: "Ürünler", path: `${base}/products` },
      ...(loaderData.category
        ? [{ name: loaderData.category, path: `${base}/products?type=${encodeURIComponent(loaderData.category)}` }]
        : []),
      { name: loaderData.title, path: `${base}/p/${loaderData.productSlug}` },
    ];

    return {
      meta: [
        ...head.meta,
        { property: "product:price:amount", content: String(loaderData.price) },
        { property: "product:price:currency", content: loaderData.currency },
        { property: "product:availability", content: loaderData.inStock ? "in stock" : "out of stock" },
      ],
      links: head.links,
      scripts: [
        jsonLdScript(
          productSchema({
            name: loaderData.title,
            description,
            url: canonicalUrl,
            images: loaderData.images.map((src) => absoluteUrl(src, loaderData.origin)),
            price: loaderData.price,
            currency: loaderData.currency,
            inStock: loaderData.inStock,
            brand: loaderData.brand,
            sku: loaderData.sku,
            barcode: loaderData.barcode,
            ratingValue: loaderData.ratingAverage,
            reviewCount: loaderData.reviewCount,
          }),
        ),
        jsonLdScript(breadcrumbSchema(breadcrumbs, loaderData.origin)),
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
  const { data: storefrontData } = useQuery(storefrontQuery(slug));
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
    trackEvent(data.store.slug, "product_view", {
      productId: data.product.id,
      value: Number(data.product.base_price ?? 0),
      currency: data.product.currency,
    });
  }, [data]);

  if (!data) return <Fallback text="Bu ürün bulunamadı." />;
  const { store, theme, product, variants, images, reviews, ratingAverage, related } = data;
  const { t, fonts, muted, cardBg, border, radius, dark } = storefrontTokens(theme);

  const selected = variants.find((variant) => variant.id === variantId) ?? variants[0] ?? null;
  const price = selected ? selected.price : product.base_price;
  const inStock = selected ? selected.stock > 0 : true;
  const variantImage = selected?.imageUrl
    ? { url: selected.imageUrl, alt: selected.title }
    : null;
  const heroImage = variantImage ?? (images.length ? { url: images[0]!.url, alt: images[0]!.alt } : null);

  // Seçenek grupları: ürün tanımı yoksa varyant seçeneklerinden türetilir.
  const definedGroups = (Array.isArray(product.variant_options) ? product.variant_options : []) as {
    name: string;
    values: string[];
  }[];
  const derived = new Map<string, string[]>();
  for (const variant of variants) {
    for (const [name, value] of Object.entries((variant.options ?? {}) as Record<string, string>)) {
      const list = derived.get(name) ?? [];
      if (!list.includes(value)) list.push(value);
      derived.set(name, list);
    }
  }
  const optionGroups = (definedGroups.length
    ? definedGroups.map((group) => ({
        name: group.name,
        values: group.values.filter((value) => (derived.get(group.name) ?? []).includes(value)),
      }))
    : Array.from(derived.entries()).map(([name, values]) => ({ name, values }))
  ).filter((group) => group.values.length > 0);

  const commerce = storefrontData?.commerce;

  function addToCart() {
    if (!selected || !inStock) return;
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
    storefrontUI.openCart();
  }

  const selectedOptions = (selected?.options ?? {}) as Record<string, string>;
  const pickOption = (name: string, value: string) => {
    const target = { ...selectedOptions, [name]: value };
    const match =
      variants.find((variant) =>
        Object.entries(target).every(
          ([key, val]) => ((variant.options ?? {}) as Record<string, string>)[key] === val,
        ),
      ) ??
      variants.find(
        (variant) => ((variant.options ?? {}) as Record<string, string>)[name] === value,
      );
    if (match) setVariantId(match.id);
  };

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug}>
      <nav style={{ padding: "20px 0", fontSize: 13, color: muted }}>
        <Link to="/s/$slug" params={{ slug: store.slug }} style={{ color: muted, textDecoration: "none" }}>
          Ürünler
        </Link>
        <span> / {product.title}</span>
      </nav>

      <section className="sf-detail-grid">
        <div>
          {heroImage ? (
            <img
              src={heroImage.url}
              alt={heroImage.alt ?? product.title}
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

          {product.video_url ? (
            <div style={{ marginTop: 16 }}>
              {/\.(mp4|webm)$/i.test(product.video_url) ? (
                <video
                  src={product.video_url}
                  controls
                  style={{ width: "100%", borderRadius: radius, border: `1px solid ${border}` }}
                />
              ) : (
                <iframe
                  src={embedUrl(product.video_url)}
                  title={`${product.title} tanıtım videosu`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                  style={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    border: `1px solid ${border}`,
                    borderRadius: radius,
                  }}
                />
              )}
            </div>
          ) : null}
        </div>

        <div>
          <h1 className="sf-title" style={{ fontFamily: fonts.heading, fontSize: 30, margin: 0, fontWeight: 700 }}>
            {product.title}
          </h1>
          <div style={{ marginTop: 10 }}>
            <StorefrontAdminLink storeId={store.id} productId={product.id} border={border} muted={muted} />
          </div>
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span className="sf-price" style={{ fontSize: 24, fontWeight: 700 }}>
              {formatMoney(price, product.currency)}
            </span>
            {product.compare_at_price ? (
              <span style={{ color: muted, textDecoration: "line-through" }}>
                {formatMoney(product.compare_at_price, product.currency)}
              </span>
            ) : null}
          </div>

          {optionGroups.length ? (
            optionGroups.map((group) => (
              <div key={group.name} style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, color: muted, marginBottom: 8 }}>{group.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {group.values.map((value) => {
                    const active = selectedOptions[group.name] === value;
                    const available = variants.some(
                      (variant) =>
                        ((variant.options ?? {}) as Record<string, string>)[group.name] === value &&
                        variant.stock > 0,
                    );
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => pickOption(group.name, value)}
                        style={{
                          border: `1px solid ${active ? t.accent_color : border}`,
                          background: active ? `${t.accent_color}22` : cardBg,
                          color: "inherit",
                          borderRadius: radius,
                          padding: "8px 14px",
                          fontSize: 13,
                          cursor: "pointer",
                          textDecoration: available ? "none" : "line-through",
                          opacity: available ? 1 : 0.5,
                        }}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : variants.length > 1 ? (
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
            {inStock ? (selected ? `Stokta ${selected.stock} adet` : "Stokta var") : "Tükendi"}
            {selected?.sku ?? product.sku ? ` · SKU: ${selected?.sku ?? product.sku}` : ""}
          </div>

          <dl
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "auto minmax(0,1fr)",
              gap: "6px 14px",
              fontSize: 13,
            }}
          >
            {[
              ["Marka", product.vendor],
              ["Satıcı", product.seller_name],
              ["Kategori", product.product_type],
              ["Barkod", selected?.barcode ?? product.barcode],
              [
                "Ağırlık",
                (selected?.weight_grams ?? product.weight_grams)
                  ? `${selected?.weight_grams ?? product.weight_grams} g`
                  : null,
              ],
              [
                "Boyut",
                product.length_cm || product.width_cm || product.height_cm
                  ? `${product.length_cm ?? 0} × ${product.width_cm ?? 0} × ${product.height_cm ?? 0} cm`
                  : null,
              ],
            ]
              .filter(([, value]) => Boolean(value))
              .map(([label, value]) => (
                <Fragment key={String(label)}>
                  <dt style={{ color: muted }}>{label}</dt>
                  <dd style={{ margin: 0 }}>{value}</dd>
                </Fragment>
              ))}
          </dl>

          <ConversionBoosters
            theme={t}
            productId={product.id}
            stock={selected?.stock ?? 0}
            commerce={commerce}
          />

          <button
            type="button"
            disabled={!inStock}
            onClick={addToCart}
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

          <StickyAddToCartBar
            theme={t}
            title={product.title}
            price={Number(price)}
            currency={product.currency}
            disabled={!inStock}
            onAdd={addToCart}
          />


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
