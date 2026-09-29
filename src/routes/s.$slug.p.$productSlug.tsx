import { Fragment, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { toast } from "sonner";

import { StorefrontAdminLink } from "@/components/storefront-admin-link";
import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { RecentlyViewed } from "@/components/recently-viewed";
import { StorefrontQuestions } from "@/components/storefront-questions";
import { SizeUnitConverter } from "@/components/storefront/size-unit-converter";
import { ProductArViewer } from "@/components/storefront/product-ar-viewer";
import { ShoppableVideoRail } from "@/components/storefront/shoppable-video-rail";
import { UgcWall } from "@/components/storefront/ugc-wall";
import { detectVisitorLocale } from "@/lib/global-export.functions";
import { StorefrontReviews } from "@/components/storefront-reviews";
import { StockAlertForm } from "@/components/stock-alert-form";
import { useCart } from "@/lib/cart";
import { useCompare } from "@/lib/compare";
import { useFavorites } from "@/lib/favorites";
import { formatMoney } from "@/lib/mefti";
import { recordRecentProduct } from "@/lib/recently-viewed";
import { storefrontProductQuery, storefrontQuery } from "@/lib/storefront-queries";
import { storefrontUI } from "@/lib/storefront-ui";
import { ConversionBoosters, StickyAddToCartBar } from "@/components/wokiee/pdp-boosters";
import { FlutCountdown, FlutPdpExtras, FlutWhatsAppFab } from "@/components/storefront/flut-extras";
import { trackEvent } from "@/lib/track";
import { getRequestOrigin } from "@/lib/origin.functions";
import { getStoreSeoContext } from "@/lib/seo-public.functions";
import { missingHead, storefrontHead } from "@/lib/storefront-seo";
import { absoluteUrl, plainText, productSchema, readSeo } from "@/lib/seo";
import { imageSrcSet, isTransformable, optimizedImageUrl } from "@/lib/image";
import { useStorefrontLive } from "@/hooks/use-storefront-live";

/** YouTube/Vimeo adreslerini gömme adresine çevirir. */
function embedUrl(url: string) {
  const yt = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

export const Route = createFileRoute("/s/$slug/p/$productSlug")({
  loader: async ({ context, params, location }) => {
    const rawLang = (location.search as Record<string, unknown> | undefined)?.["lang"];
    const lang = typeof rawLang === "string" && /^[a-z]{2}(-[a-z]{2})?$/i.test(rawLang) ? rawLang : null;
    const [data, origin] = await Promise.all([
      context.queryClient.ensureQueryData(storefrontProductQuery(params.slug, params.productSlug)),
      getRequestOrigin(),
    ]);
    if (!data) throw notFound();
    // Ziyaretçi dili seçtiyse başlık, açıklama ve SEO metinleri o dilin
    // onaylanmış çevirilerinden okunur.
    const productId = data.product.id;
    const ctx = await getStoreSeoContext({
      data: {
        slug: params.slug,
        ...(lang ? { locale: lang } : {}),
        ...(lang
          ? {
              keys: [
                `product.${productId}.title`,
                `product.${productId}.description`,
                `seo.${productId}.product.title`,
                `seo.${productId}.product.description`,
              ],
            }
          : {}),
      },
    });
    const tr = ctx?.translations ?? {};
    const baseSeo = readSeo(data.product.seo);
    const seoTitle = tr[`seo.${productId}.product.title`];
    const seoDescription = tr[`seo.${productId}.product.description`];
    // Başka bir dil seçiliyse kaynak dildeki özel SEO metni kullanılmaz;
    // çeviri yoksa ürünün çevrilmiş adı/açıklaması esas alınır.
    const seo = ctx?.activeLocale
      ? {
          ...baseSeo,
          title: seoTitle ?? "",
          description: seoDescription ?? "",
        }
      : baseSeo;
    const title = tr[`product.${productId}.title`] ?? data.product.title;
    return {
      origin,
      ctx,
      slug: params.slug,
      productSlug: params.productSlug,
      title,
      storeName: data.store.name,
      seo,
      description:
        seo.description ||
        plainText(tr[`product.${productId}.description`] ?? data.product.description),
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
    if (!loaderData) return missingHead("Ürün bulunamadı");

    const base = `/s/${loaderData.slug}`;
    const path = `${base}/p/${loaderData.productSlug}`;
    const micro = loaderData.ctx?.storeKind === "micro";
    const fallbackDescription =
      loaderData.description ||
      (micro
        ? `${loaderData.title} — ${loaderData.storeName} tarafından el yapımı olarak hazırlanır. Güncel fiyat, stok ve hazırlık süresi bu sayfada.`
        : `${loaderData.title} ürününü ${loaderData.storeName} vitrininde keşfedin.`);
    const image = loaderData.images[0] ?? null;

    const breadcrumbs = [
      { name: "Ana sayfa", path: base },
      { name: "Ürünler", path: `${base}/products` },
      ...(loaderData.category
        ? [{ name: loaderData.category, path: `${base}/products?type=${encodeURIComponent(loaderData.category)}` }]
        : []),
      { name: loaderData.title, path },
    ];

    const head = storefrontHead({
      slug: loaderData.slug,
      path,
      origin: loaderData.origin,
      ctx: loaderData.ctx,
      seo: loaderData.seo,
      fallbackTitle: loaderData.title,
      fallbackDescription,
      ogType: "product",
      templateKey: "product",
      tokens: {
        product_name: loaderData.title,
        product_type: loaderData.category ?? "",
        brand_name: loaderData.brand ?? "",
        price: loaderData.price,
      },
      breadcrumbs,
      ...(image ? { image } : {}),
      schemas: [
        productSchema({
          name: loaderData.title,
          description: loaderData.seo.description || fallbackDescription,
          url: absoluteUrl(loaderData.seo.canonical || path, loaderData.origin),
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
      ],
    });

    const lcp = image ? optimizedImageUrl(image, { width: 720 }) : null;
    return {
      ...head,
      links: [
        ...(head.links ?? []),
        ...(lcp && image
          ? [{ rel: "preload", as: "image", href: lcp, fetchpriority: "high", ...(isTransformable(image) ? { imagesrcset: imageSrcSet(image) ?? undefined, imagesizes: "(max-width: 768px) 100vw, 50vw" } : {}) }]
          : []),
      ],
      meta: [
        ...head.meta,
        { property: "product:price:amount", content: String(loaderData.price) },
        { property: "product:price:currency", content: loaderData.currency },
        { property: "product:availability", content: loaderData.inStock ? "in stock" : "out of stock" },
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
  const localized = Route.useLoaderData();
  const { data } = useSuspenseQuery(storefrontProductQuery(slug, productSlug));
  const { data: storefrontData } = useQuery(storefrontQuery(slug));
  useStorefrontLive(slug, storefrontData?.store?.id ?? data?.store?.id);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [visitorCountry, setVisitorCountry] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void detectVisitorLocale()
      .then((result) => {
        if (active) setVisitorCountry(result.detected ?? null);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const [qty, setQty] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  const [zoomOpen, setZoomOpen] = useState(false);
  const [lens, setLens] = useState<string | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  const touchX = useRef<number | null>(null);
  const buyRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const el = buyRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setShowSticky(!entry!.isIntersecting && entry!.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  });
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const cart = useCart();
  const favorites = useFavorites();
  const compare = useCompare();
  const navigate = useNavigate();

  useEffect(() => {
    if (!data) return;
    recordRecentProduct({
      storeSlug: data.store.slug,
      productSlug: data.product.slug,
      title: localized.title || data.product.title,
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
  const displayTitle = localized.title || product.title;
  const displayDescription = localized.description || product.description;
  const { t, fonts, muted, cardBg, border, radius, dark } = storefrontTokens(theme);

  const selected = variants.find((variant) => variant.id === variantId) ?? variants[0] ?? null;
  const price = selected ? selected.price : product.base_price;
  const salesPaused = store.status !== "active";
  const inStock = !salesPaused && (selected ? selected.stock > 0 : true);
  const stockLeft = selected?.stock ?? 0;
  const maxQty = Math.max(1, stockLeft || 1);
  const quantity = Math.min(Math.max(1, qty), maxQty);
  const compareAt = Number(product.compare_at_price ?? 0);
  const discountPct =
    compareAt > Number(price) ? Math.round((1 - Number(price) / compareAt) * 100) : 0;
  const crumb = { color: muted, textDecoration: "none" } as const;

  const variantImage = selected?.imageUrl
    ? { url: selected.imageUrl, alt: selected.title }
    : null;
  const heroImage = variantImage ?? (images.length ? { url: images[Math.min(activeImage, images.length - 1)]!.url, alt: images[Math.min(activeImage, images.length - 1)]!.alt } : null);

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
    cart.add(
      {
        storeSlug: store.slug,
        variantId: selected.id,
        productSlug: product.slug,
        title: displayTitle,
        variantTitle: selected.title,
        price: Number(selected.price ?? product.base_price),
        currency: product.currency,
        maxStock: selected.stock ?? 0,
        imageUrl: heroImage?.url ?? images[0]?.url ?? null,
      },
      quantity,
    );
    toast.success(quantity > 1 ? `${quantity} adet sepete eklendi` : "Ürün sepete eklendi");
    storefrontUI.openCart();
  }

  /** Ürünü sepete alır ve doğrudan ödeme sayfasına götürür (tek ürün kasası). */
  function buyNow() {
    if (!selected || !inStock) return;
    cart.add(
      {
        storeSlug: store.slug,
        variantId: selected.id,
        productSlug: product.slug,
        title: displayTitle,
        variantTitle: selected.title,
        price: Number(selected.price ?? product.base_price),
        currency: product.currency,
        maxStock: selected.stock ?? 0,
        imageUrl: heroImage?.url ?? images[0]?.url ?? null,
      },
      quantity,
    );
    void navigate({ to: "/s/$slug/checkout", params: { slug: store.slug } });
  }

  async function shareProduct() {
    const url = typeof window === "undefined" ? "" : window.location.href;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: displayTitle, url });
        return;
      } catch {
        /* kullanıcı vazgeçti */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ürün bağlantısı kopyalandı");
    } catch {
      toast.error("Bağlantı kopyalanamadı");
    }
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
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} commerce={commerce}>
      <nav
        aria-label="Sayfa yolu"
        style={{
          padding: "20px 0",
          fontSize: 13,
          color: muted,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Link to="/s/$slug" params={{ slug: store.slug }} style={crumb}>
          Ana sayfa
        </Link>
        <span aria-hidden>/</span>
        <Link to="/s/$slug/products" params={{ slug: store.slug }} style={crumb}>
          Ürünler
        </Link>
        <span aria-hidden>/</span>
          <span style={{ color: "inherit" }}>{displayTitle}</span>
      </nav>

      {salesPaused ? (
        <div className="sp-paused" role="status">
          Bu mağaza, satışlarına geçici bir süre ara vermiştir. Ürünleri inceleyebilirsiniz ancak şu anda sipariş verilemez.
        </div>
      ) : null}


      {showSticky && inStock && !salesPaused ? (
        <div className="pdp-sticky" role="region" aria-label="Hızlı sepete ekle" style={{ position: "fixed", left: 0, right: 0, bottom: 64, zIndex: 45, background: t.background_color, borderTop: `1px solid ${border}`, boxShadow: "0 -4px 16px rgba(0,0,0,.08)", padding: "10px 16px", display: "none", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{displayTitle}</div>
            <strong style={{ fontSize: 16 }}>{formatMoney(price, product.currency)}</strong>
          </div>
          <button type="button" onClick={addToCart} style={{ minHeight: 48, padding: "0 22px", border: 0, borderRadius: radius, background: t.primary_color, color: "#fff", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Sepete ekle</button>
        </div>
      ) : null}
      <style>{`@media (max-width:767px){.pdp-sticky{display:flex!important}}`}</style>
      <section className="sf-detail-grid">
        <div>
          {heroImage ? (
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              aria-label="Ürün görselini büyüt"
              onMouseMove={(e) => { if (!window.matchMedia("(hover: hover)").matches) return; const r = e.currentTarget.getBoundingClientRect(); setLens(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`); }}
              onMouseLeave={() => setLens(null)}
              onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
              onTouchEnd={(e) => {
                const start = touchX.current; touchX.current = null;
                const end = e.changedTouches[0]?.clientX;
                if (start == null || end == null || images.length < 2 || Math.abs(end - start) < 40) return;
                e.preventDefault();
                setActiveImage((i) => (i + (end < start ? 1 : -1) + images.length) % images.length);
              }}
              style={{ display: "block", width: "100%", padding: 0, border: `1px solid ${border}`, borderRadius: radius, overflow: "hidden", background: "transparent", cursor: "zoom-in", position: "relative" }}
            >
              <img
                src={heroImage.url}
                alt={heroImage.alt ?? product.title}
                loading="eager"
                style={{ width: "100%", display: "block", transition: "transform 200ms ease", transform: lens ? "scale(2)" : "none", transformOrigin: lens ?? "center" }}
              />
              {images.length > 1 ? (
                <span className="pdp-dots" aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 10, display: "flex", justifyContent: "center", gap: 6 }}>
                  {images.map((image, index) => <i key={image.id} style={{ width: 7, height: 7, borderRadius: 999, background: index === Math.min(activeImage, images.length - 1) ? t.primary_color : "rgba(255,255,255,.8)", boxShadow: "0 0 0 1px rgba(0,0,0,.15)" }} />)}
                </span>
              ) : null}
            </button>
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

          {images.length > 1 ? (
            <div className="mef-ultra-pdp-thumbs" aria-label="Ürün görselleri">
              {images.map((image, index) => (
                <button key={image.id} type="button" onClick={() => setActiveImage(index)} aria-label={`${index + 1}. görseli aç`} style={{ borderColor: activeImage === index ? t.accent_color : border }}>
                  <img src={image.url} alt={image.alt ?? `${product.title} ${index + 1}`} loading="lazy" />
                </button>
              ))}
            </div>
          ) : null}

          {zoomOpen && heroImage ? (
            <div className="mef-ultra-zoom" role="dialog" aria-modal="true" aria-label="Büyütülmüş ürün görseli" onClick={() => setZoomOpen(false)}>
              <button type="button" aria-label="Kapat" onClick={() => setZoomOpen(false)}>×</button>
              <img src={heroImage.url} alt={heroImage.alt ?? product.title} />
            </div>
          ) : null}

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
            {displayTitle}
          </h1>
          <div style={{ marginTop: 10 }}>
            <StorefrontAdminLink storeId={store.id} productId={product.id} border={border} muted={muted} />
          </div>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              fontSize: 13,
              color: muted,
            }}
          >
            <span aria-hidden style={{ color: "#f5a524", letterSpacing: 1 }}>
              {"★★★★★".slice(0, Math.round(ratingAverage || 0))}
              <span style={{ color: border }}>
                {"★★★★★".slice(0, 5 - Math.round(ratingAverage || 0))}
              </span>
            </span>
            {reviews.length ? (
              <a href="#yorumlar" style={{ color: muted }}>
                {ratingAverage ? `${ratingAverage.toFixed(1)} · ` : ""}
                {reviews.length} değerlendirme
              </a>
            ) : (
              <span>Henüz değerlendirme yok</span>
            )}
          </div>
          <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <span className="sf-price" style={{ fontSize: 24, fontWeight: 700 }}>
              {formatMoney(price, product.currency)}
            </span>
            {product.compare_at_price ? (
              <span style={{ color: muted, textDecoration: "line-through" }}>
                {formatMoney(product.compare_at_price, product.currency)}
              </span>
            ) : null}
            {discountPct > 0 ? (
              <span
                style={{
                  background: `${t.accent_color}22`,
                  color: t.accent_color,
                  borderRadius: 999,
                  padding: "4px 10px",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                %{discountPct} indirim
              </span>
            ) : null}
          </div>
          {discountPct > 0 ? (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: muted }}>
              {formatMoney(compareAt - Number(price), product.currency)} tasarruf ediyorsunuz.
            </p>
          ) : null}


          {optionGroups.length ? (
            optionGroups.map((group) => (
              <div key={group.name} style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, color: muted, marginBottom: 8 }}>{group.name}</div>
                {/beden|size|ölçü/i.test(group.name) ? (
                  <button type="button" onClick={() => setSizeGuideOpen(true)} style={{ float: "right", marginTop: -26, border: 0, background: "transparent", color: t.accent_color, fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>Beden rehberi</button>
                ) : null}
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
          {inStock && stockLeft > 0 && stockLeft <= 5 ? (
            <p style={{ margin: "6px 0 0", fontSize: 13, fontWeight: 600, color: "#d0342c" }}>
              Son {stockLeft} adet — stoklar tükenmek üzere.
            </p>
          ) : null}


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
          {storefrontData?.themeFeatures?.["theme_flut_style"] ? (
            <>
              <FlutPdpExtras
                theme={t}
                features={storefrontData.themeFeatures}
                texts={storefrontData.themeTexts ?? {}}
                storeSlug={store.slug}
                storeName={store.name}
                productId={product.id}
                productTitle={displayTitle}
                selectedLabel={selected && variants.length > 1 ? selected.title : ""}
                stock={selected?.stock ?? 0}
                relatedIds={related.map((r) => r.id)}
                fallbackPhone={storefrontData.profile?.contact_phone}
                onBundleMain={() => { if (!selected || !inStock) return false; addToCart(); return true; }}
              />
              {storefrontData.themeFeatures["theme_whatsapp_order"] ? <FlutWhatsAppFab phone={storefrontData.themeTexts?.["whatsapp_number"] || storefrontData.profile?.contact_phone} /> : null}
              {storefrontData.themeFeatures["theme_countdown_timer"] ? <FlutCountdown endsAt={storefrontData.themeTexts?.["countdown_ends_at"]} label={storefrontData.themeTexts?.["countdown_label"]} accent={t.accent_color} /> : null}
            </>
          ) : null}

          {inStock ? (
            <div
              style={{
                marginTop: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                border: `1px solid ${border}`,
                borderRadius: radius,
                padding: "10px 14px",
                background: cardBg,
              }}
            >
              <span style={{ fontSize: 13, color: muted }}>Adet</span>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  type="button"
                  aria-label="Adet azalt"
                  onClick={() => setQty((value) => Math.max(1, value - 1))}
                  disabled={quantity <= 1}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius,
                    border: `1px solid ${border}`,
                    background: "transparent",
                    color: "inherit",
                    fontSize: 18,
                    cursor: quantity <= 1 ? "not-allowed" : "pointer",
                    opacity: quantity <= 1 ? 0.5 : 1,
                  }}
                >
                  −
                </button>
                <span
                  aria-live="polite"
                  style={{ minWidth: 40, textAlign: "center", fontSize: 16, fontWeight: 700 }}
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Adet arttır"
                  onClick={() => setQty((value) => Math.min(maxQty, value + 1))}
                  disabled={quantity >= maxQty}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius,
                    border: `1px solid ${border}`,
                    background: "transparent",
                    color: "inherit",
                    fontSize: 18,
                    cursor: quantity >= maxQty ? "not-allowed" : "pointer",
                    opacity: quantity >= maxQty ? 0.5 : 1,
                  }}
                >
                  +
                </button>
              </div>
            </div>
          ) : null}


          <p style={{ marginTop: 18, fontSize: 13, color: muted }}>
            Taksit seçenekleri, ödeme adımında kartınıza göre gösterilir.
          </p>
          <button
            ref={buyRef}
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

          {inStock ? (
            <button
              type="button"
              onClick={buyNow}
              style={{
                marginTop: 10,
                width: "100%",
                background: "transparent",
                color: "inherit",
                border: `1px solid ${border}`,
                borderRadius: radius,
                padding: "14px 20px",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Hemen satın al
            </button>
          ) : null}


          <StickyAddToCartBar
            theme={t}
            title={displayTitle}
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
                title: displayTitle,
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

          <button
            type="button"
            onClick={() => void shareProduct()}
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
            ↗ Ürünü paylaş
          </button>

          <div className="mef-ultra-pdp-accordions" style={{ borderColor: border }}>
            {displayDescription ? (
              <details open>
                <summary>Ürün açıklaması</summary>
                <p style={{ color: muted, whiteSpace: "pre-line" }}>{displayDescription}</p>
              </details>
            ) : null}
            <details><summary>Teslimat ve iade</summary><p style={{ color: muted }}>{commerce?.fastestEtaDays ? `Tahmini ${commerce.fastestEtaDays} iş gününde teslim.` : "Teslimat süresi seçtiğiniz kargo yöntemine göre ödeme adımında gösterilir."} İade koşulları mağaza politikalarına göre uygulanır.</p></details>
            <details><summary>Güvenli ödeme</summary><p style={{ color: muted }}>{commerce?.payments.length ? commerce.payments.map((item) => item.displayName).join(", ") : "Aktif güvenli ödeme seçenekleri"} ile ödeme yapabilirsiniz.</p></details>
          </div>

        </div>
      </section>

      {sizeGuideOpen ? (
        <div className="mef-ultra-size-modal" role="dialog" aria-modal="true" aria-label="Beden rehberi">
          <button className="mef-ultra-size-backdrop" type="button" aria-label="Kapat" onClick={() => setSizeGuideOpen(false)} />
          <div style={{ background: cardBg, borderColor: border, borderRadius: radius }}>
            <button type="button" onClick={() => setSizeGuideOpen(false)} aria-label="Kapat">×</button>
            <h2 style={{ fontFamily: fonts.heading }}>Beden rehberi</h2>
            <p style={{ color: muted }}>En doğru seçim için ürün varyant adlarını ve kendi ölçülerinizi karşılaştırın.</p>
            <table><thead><tr><th>Beden</th><th>Göğüs</th><th>Bel</th></tr></thead><tbody><tr><td>S</td><td>86–91 cm</td><td>71–76 cm</td></tr><tr><td>M</td><td>92–97 cm</td><td>77–82 cm</td></tr><tr><td>L</td><td>98–104 cm</td><td>83–89 cm</td></tr></tbody></table>
          </div>
        </div>
      ) : null}

      <div style={{ margin: "24px 0", display: "grid", gap: 24 }}>
        <ProductArViewer productId={product.id} title={product.title} />
        <SizeUnitConverter country={visitorCountry} />
        <ShoppableVideoRail
          storeId={store.id}
          slug={store.slug}
          placement="pdp"
          heading="Bu üründen videolar"
        />
        <UgcWall storeId={store.id} productId={product.id} />
      </div>


      <div id="yorumlar" style={{ scrollMarginTop: 90 }}>
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
      </div>


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
            Birlikte sık tercih edilenler
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
