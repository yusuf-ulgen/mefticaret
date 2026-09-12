import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { RecentlyViewed } from "@/components/recently-viewed";
import { buttonStyles, storefrontTokens, type StoreTheme } from "@/components/storefront-chrome";
import {
  Cta,
  ProductCard,
  ProductCollectionView,
  SectionHeading,
  bool,
  filterProducts,
  gridColumns,
  num,
  parseRows,
  str,
  type SectionCollection,
  type SectionContext,
  type SectionProduct,
  type SectionProps,
} from "@/components/storefront-primitives";
import { formatMoney } from "@/lib/mefti";
import { WokieeProductCard } from "@/components/wokiee/product-card";
import type { ResolvedSection } from "@/lib/theme-sections";

/** Gelişmiş tema bloklarının vitrin karşılıkları (kategori bazlı blok kütüphanesi). */

/* --------------------------------------------------------------- yardımcılar */

function toneBackground(theme: StoreTheme, tone: string) {
  const { t } = storefrontTokens(theme);
  switch (tone) {
    case "primary":
      return { background: t.primary_color, color: "#f8fafc" };
    case "dark":
      return { background: "#0f172a", color: "#f8fafc" };
    case "soft":
      return { background: `${t.accent_color}1f`, color: "inherit" };
    default:
      return { background: t.accent_color, color: "#12181f" };
  }
}

function Surface({
  children,
  theme,
  padding = "26px 24px",
  style,
}: {
  children: ReactNode;
  theme: StoreTheme;
  padding?: string;
  style?: CSSProperties;
}) {
  const { cardBg, border, radius } = storefrontTokens(theme);
  return (
    <section
      style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: radius,
        padding,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function Clickable({
  url,
  preview,
  style,
  children,
}: {
  url: string;
  preview?: boolean | undefined;
  style: CSSProperties;
  children: ReactNode;
}) {
  if (preview || !url.trim()) return <div style={style}>{children}</div>;
  return (
    <a href={url} style={{ textDecoration: "none", color: "inherit", ...style }}>
      {children}
    </a>
  );
}

function useCountdown(endsAt: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const target = Date.parse(endsAt);
  if (now === null || !Number.isFinite(target)) return null;
  const diff = Math.max(0, target - now);
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
    finished: diff === 0,
  };
}

function CountdownDisplay({ endsAt, theme }: { endsAt: string; theme: StoreTheme }) {
  const left = useCountdown(endsAt);
  const { border, radius, muted, fonts } = storefrontTokens(theme);
  if (!endsAt.trim()) return <p style={{ color: muted, fontSize: 14 }}>Bitiş tarihi belirlenmedi.</p>;
  if (!left) return <p style={{ color: muted, fontSize: 14 }}>Sayaç hazırlanıyor…</p>;
  if (left.finished) return <p style={{ color: muted, fontSize: 14 }}>Kampanya sona erdi.</p>;

  const cells: [number, string][] = [
    [left.days, "gün"],
    [left.hours, "saat"],
    [left.minutes, "dakika"],
    [left.seconds, "saniye"],
  ];

  return (
    <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
      {cells.map(([value, label]) => (
        <div
          key={label}
          style={{
            border: `1px solid ${border}`,
            borderRadius: radius,
            padding: "10px 14px",
            minWidth: 72,
            textAlign: "center",
          }}
        >
          <div style={{ fontFamily: fonts.heading, fontSize: 22, fontWeight: 700 }}>
            {String(value).padStart(2, "0")}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

/** Ürün kaynaklarını (yeni, indirimli, popüler, filtre) çözer. */
function selectProducts(context: SectionContext, source: string, filter: string, limit: number) {
  const all = context.products;
  const pool =
    source === "discounted"
      ? all.filter((p) => Number(p.compare_at_price ?? 0) > Number(p.base_price))
      : source === "new"
        ? all
        : source === "bestsellers"
          ? [...all].sort((a, b) => Number(b.base_price) - Number(a.base_price))
          : source === "filter"
            ? filterProducts(all, filter, all.length)
            : all;
  return pool.slice(0, Math.max(1, limit));
}

function collectionCards(context: SectionContext, limit: number) {
  return context.collections.slice(0, Math.max(1, limit)).map((collection) => ({
    collection,
    count: context.products.filter((product) =>
      [product.product_type ?? "", ...(product.tags ?? [])]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(collection.title.toLocaleLowerCase("tr")),
    ).length,
  }));
}

function CollectionLink({
  collection,
  context,
  style,
  children,
}: {
  collection: SectionCollection;
  context: SectionContext;
  style: CSSProperties;
  children: ReactNode;
}) {
  if (context.preview) return <div style={style}>{children}</div>;
  return (
    <Link
      to="/s/$slug/c/$collectionSlug"
      params={{ slug: context.storeSlug, collectionSlug: collection.slug }}
      style={{ textDecoration: "none", color: "inherit", ...style }}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------- router */

/** Gelişmiş blok tiplerini render eder; bilinmeyen tipte null döner. */
export function ExtendedBlock({ section, context }: { section: ResolvedSection; context: SectionContext }) {
  const s = section.settings;
  const props: SectionProps = { settings: s, context };

  switch (section.type) {
    /* HERO */
    case "hero_slider":
      return <HeroSlider {...props} />;
    case "hero_split":
      return <HeroSplit {...props} />;
    case "hero_fullscreen":
      return <HeroFullscreen {...props} />;
    case "hero_video":
      return <HeroVideo {...props} />;
    case "hero_center":
      return <HeroCenter {...props} />;
    case "hero_product":
      return <HeroProduct {...props} />;
    case "hero_campaign":
      return <HeroCampaign {...props} />;
    case "hero_countdown":
      return <HeroCountdown {...props} />;
    case "hero_before_after":
      return <HeroBeforeAfter {...props} />;

    /* BANNER */
    case "banner_split":
      return <BannerSplit {...props} />;
    case "banner_masonry":
      return <BannerMasonry {...props} />;
    case "banner_scroll":
      return <BannerScroll {...props} />;
    case "banner_color_grid":
      return <BannerColorGrid {...props} />;
    case "banner_collection":
      return <BannerCollection {...props} />;
    case "banner_promo":
      return <BannerPromo {...props} />;

    /* ÜRÜN */
    case "product_featured":
      return <ProductBlock {...props} source="all" filterKey="filter" />;
    case "product_category":
      return <ProductCategoryBlock {...props} />;
    case "product_bestsellers":
      return <ProductBlock {...props} source="bestsellers" />;
    case "product_new":
      return <ProductBlock {...props} source="new" />;
    case "product_discounted":
      return <ProductBlock {...props} source="discounted" />;
    case "product_recommended":
      return <ProductBlock {...props} source="filter" filterKey="filter" />;
    case "product_feed":
      return <ProductFeedBlock {...props} />;
    case "product_tabs":
      return <ProductTabs {...props} />;
    case "product_recently_viewed":
      return <RecentlyViewedBlock {...props} />;

    /* KATEGORİ */
    case "category_slider":
      return <CategorySlider {...props} />;
    case "category_cards":
      return <CategoryCards {...props} />;
    case "category_mega":
      return <CategoryMega {...props} />;

    /* İÇERİK */
    case "rich_text":
      return <RichText {...props} />;
    case "icon_boxes":
      return <IconBoxes {...props} settingsKey="items" />;
    case "video":
      return <VideoBlock {...props} />;
    case "gallery":
      return <GalleryBlock {...props} />;
    case "counters":
      return <CountersBlock {...props} />;
    case "brands":
      return <BrandsBlock {...props} />;
    case "logo_cloud":
      return <LogoCloud {...props} />;
    case "map":
      return <MapBlock {...props} />;

    /* PAZARLAMA */
    case "campaign_banner":
      return <CampaignBanner {...props} />;
    case "coupon_banner":
      return <CouponBanner {...props} />;
    case "countdown":
      return <CountdownBlock {...props} />;
    case "free_shipping_bar":
      return <FreeShippingBar {...props} />;
    case "trust_badges":
      return <TrustBadges {...props} />;
    case "social_proof":
      return <SocialProof {...props} />;
    case "reviews":
      return <ReviewsBlock {...props} />;
    case "lookbook_hotspots":
      return <LookbookHotspots {...props} />;
    case "flash_sale":
      return <FlashSale {...props} />;
    case "social_gallery":
      return <SocialGallery {...props} />;

    /* E-TİCARET */
    case "cart_block":
      return <LinkCard {...props} target="cart" />;
    case "featured_collection":
      return <FeaturedCollection {...props} />;
    case "product_comparison":
      return <LinkCard {...props} target="compare" />;
    case "wishlist":
      return <LinkCard {...props} target="favorites" />;
    case "related_products":
      return <RelatedProducts {...props} />;

    default:
      return null;
  }
}

/* --------------------------------------------------------------------- HERO */

function HeroSlider({ settings, context }: SectionProps) {
  const { fonts, radius, t } = storefrontTokens(context.theme);
  const slides = parseRows(settings["items"], 5);
  const height = num(settings, "height", 460);
  const autoplay = bool(settings, "autoplay");
  const interval = Math.max(2, num(settings, "interval", 6)) * 1000;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!autoplay || slides.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), interval);
    return () => window.clearInterval(timer);
  }, [autoplay, interval, slides.length]);

  if (!slides.length) return null;
  const slide = slides[index % slides.length]!;
  const [title, subtitle, image, ctaLabel, ctaUrl] = slide;

  return (
    <section style={{ position: "relative" }}>
      <div
        style={{
          position: "relative",
          minHeight: height,
          borderRadius: radius,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          padding: "48px 40px",
          color: image ? "#f8fafc" : undefined,
          background: image
            ? `linear-gradient(rgba(6,10,16,.5), rgba(6,10,16,.5)), url(${image}) center/cover no-repeat`
            : `linear-gradient(140deg, ${t.primary_color}, ${t.accent_color})`,
        }}
      >
        <div style={{ maxWidth: 620 }}>
          <h2 style={{ fontFamily: fonts.heading, fontSize: 40, margin: 0, lineHeight: 1.1 }}>{title}</h2>
          <p style={{ marginTop: 12, fontSize: 16, opacity: 0.88 }}>{subtitle}</p>
          <Cta label={ctaLabel ?? ""} url={ctaUrl ?? ""} theme={context.theme} preview={context.preview} />
        </div>
      </div>
      {slides.length > 1 ? (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
          {slides.map((_slide, slideIndex) => (
            <button
              key={slideIndex}
              type="button"
              aria-label={`${slideIndex + 1}. slayta git`}
              onClick={() => setIndex(slideIndex)}
              style={{
                width: slideIndex === index % slides.length ? 28 : 10,
                height: 10,
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                background: slideIndex === index % slides.length ? t.accent_color : "rgba(120,130,145,.4)",
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function HeroSplit({ settings, context }: SectionProps) {
  const { fonts, muted, radius, t } = storefrontTokens(context.theme);
  const image = str(settings, "imageUrl");
  const right = str(settings, "imagePosition") !== "left";

  const visual = (
    <div
      style={{
        borderRadius: radius,
        minHeight: 320,
        overflow: "hidden",
        background: image ? undefined : `linear-gradient(140deg, ${t.primary_color}, ${t.accent_color})`,
      }}
    >
      {image ? (
        <img
          src={image}
          alt={str(settings, "title")}
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : null}
    </div>
  );

  const copy = (
    <div>
      <h2 style={{ fontFamily: fonts.heading, fontSize: 34, margin: 0, lineHeight: 1.15 }}>
        {str(settings, "title")}
      </h2>
      <p style={{ color: muted, marginTop: 14, fontSize: 16, lineHeight: 1.7 }}>{str(settings, "subtitle")}</p>
      <Cta
        label={str(settings, "ctaLabel")}
        url={str(settings, "ctaUrl")}
        theme={context.theme}
        preview={context.preview}
      />
    </div>
  );

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: 28,
        alignItems: "center",
      }}
    >
      {right ? copy : visual}
      {right ? visual : copy}
    </section>
  );
}

function HeroFullscreen({ settings, context }: SectionProps) {
  const { fonts, radius, t } = storefrontTokens(context.theme);
  const image = str(settings, "imageUrl");
  const overlay = Math.min(90, Math.max(0, num(settings, "overlay", 55))) / 100;

  return (
    <section
      style={{
        borderRadius: radius,
        minHeight: "78vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "64px 32px",
        color: "#f8fafc",
        background: image
          ? `linear-gradient(rgba(6,10,16,${overlay}), rgba(6,10,16,${overlay})), url(${image}) center/cover no-repeat`
          : `linear-gradient(160deg, ${t.primary_color}, ${t.accent_color})`,
      }}
    >
      <div style={{ maxWidth: 720 }}>
        <h2 style={{ fontFamily: fonts.heading, fontSize: 48, margin: 0, lineHeight: 1.05 }}>
          {str(settings, "title")}
        </h2>
        <p style={{ marginTop: 16, fontSize: 17, opacity: 0.9 }}>{str(settings, "subtitle")}</p>
        <Cta
          label={str(settings, "ctaLabel")}
          url={str(settings, "ctaUrl")}
          theme={context.theme}
          preview={context.preview}
        />
      </div>
    </section>
  );
}

function HeroVideo({ settings, context }: SectionProps) {
  const { fonts, radius, t } = storefrontTokens(context.theme);
  const video = str(settings, "videoUrl");
  const poster = str(settings, "posterUrl");
  const height = num(settings, "height", 520);

  return (
    <section
      style={{
        position: "relative",
        borderRadius: radius,
        overflow: "hidden",
        minHeight: height,
        display: "flex",
        alignItems: "flex-end",
        background: poster
          ? `url(${poster}) center/cover no-repeat`
          : `linear-gradient(140deg, ${t.primary_color}, ${t.accent_color})`,
      }}
    >
      {video ? (
        <video
          src={video}
          poster={poster || undefined}
          autoPlay
          muted
          loop
          playsInline
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : null}
      <div
        style={{
          position: "relative",
          padding: "40px 36px",
          width: "100%",
          color: "#f8fafc",
          background: "linear-gradient(rgba(6,10,16,0), rgba(6,10,16,.72))",
        }}
      >
        <h2 style={{ fontFamily: fonts.heading, fontSize: 34, margin: 0 }}>{str(settings, "title")}</h2>
        <p style={{ marginTop: 10, fontSize: 15, opacity: 0.9 }}>{str(settings, "subtitle")}</p>
        <Cta
          label={str(settings, "ctaLabel")}
          url={str(settings, "ctaUrl")}
          theme={context.theme}
          preview={context.preview}
        />
      </div>
    </section>
  );
}

function HeroCenter({ settings, context }: SectionProps) {
  const { fonts, muted, radius, border, t } = storefrontTokens(context.theme);
  const badge = str(settings, "badge");

  return (
    <section
      style={{
        borderRadius: radius,
        border: `1px solid ${border}`,
        minHeight: num(settings, "height", 420),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "56px 28px",
      }}
    >
      <div style={{ maxWidth: 640 }}>
        {badge ? (
          <span
            style={{
              display: "inline-block",
              padding: "5px 12px",
              borderRadius: 999,
              fontSize: 11,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              background: `${t.accent_color}22`,
              color: t.accent_color,
            }}
          >
            {badge}
          </span>
        ) : null}
        <h2 style={{ fontFamily: fonts.heading, fontSize: 40, margin: "16px 0 0", lineHeight: 1.1 }}>
          {str(settings, "title")}
        </h2>
        <p style={{ color: muted, marginTop: 14, fontSize: 16 }}>{str(settings, "subtitle")}</p>
        <Cta
          label={str(settings, "ctaLabel")}
          url={str(settings, "ctaUrl")}
          theme={context.theme}
          preview={context.preview}
        />
      </div>
    </section>
  );
}

function HeroProduct({ settings, context }: SectionProps) {
  const { fonts, muted, radius, border, t } = storefrontTokens(context.theme);
  const product = filterProducts(context.products, str(settings, "filter"), 1)[0];
  if (!product) return null;
  const currency = product.currency ?? context.storeCurrency;
  const badge = str(settings, "badge");

  const cta = (
    <span style={{ ...buttonStyles(context.theme), marginTop: 20 }}>
      {str(settings, "ctaLabel") || "Ürüne git"}
    </span>
  );

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 28,
        alignItems: "center",
        border: `1px solid ${border}`,
        borderRadius: radius,
        padding: 26,
      }}
    >
      <div
        style={{
          borderRadius: radius,
          minHeight: 300,
          overflow: "hidden",
          background: `linear-gradient(140deg, ${t.accent_color}22, ${t.primary_color}12)`,
        }}
      >
        {product.coverUrl ? (
          <img
            src={product.coverUrl}
            alt={product.title}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : null}
      </div>
      <div>
        {badge ? (
          <span style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: t.accent_color }}>
            {badge}
          </span>
        ) : null}
        <p style={{ color: muted, fontSize: 13, margin: "10px 0 0" }}>{str(settings, "title")}</p>
        <h2 style={{ fontFamily: fonts.heading, fontSize: 30, margin: "6px 0 0" }}>{product.title}</h2>
        <div style={{ marginTop: 12, fontSize: 20, fontWeight: 700 }}>
          {formatMoney(Number(product.base_price), currency)}
        </div>
        {product.description ? (
          <p style={{ color: muted, marginTop: 12, fontSize: 15, lineHeight: 1.7 }}>
            {product.description.slice(0, 220)}
          </p>
        ) : null}
        {context.preview ? (
          cta
        ) : (
          <Link
            to="/s/$slug/p/$productSlug"
            params={{ slug: context.storeSlug, productSlug: product.slug }}
            style={{ textDecoration: "none" }}
          >
            {cta}
          </Link>
        )}
      </div>
    </section>
  );
}

function HeroCampaign({ settings, context }: SectionProps) {
  const { fonts, radius } = storefrontTokens(context.theme);
  const image = str(settings, "imageUrl");
  const tone = toneBackground(context.theme, str(settings, "tone"));
  const badge = str(settings, "badge");

  return (
    <section
      style={{
        borderRadius: radius,
        padding: "44px 36px",
        ...tone,
        ...(image
          ? {
              background: `linear-gradient(rgba(6,10,16,.55), rgba(6,10,16,.55)), url(${image}) center/cover no-repeat`,
              color: "#f8fafc",
            }
          : {}),
      }}
    >
      {badge ? (
        <span style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", opacity: 0.85 }}>
          {badge}
        </span>
      ) : null}
      <h2 style={{ fontFamily: fonts.heading, fontSize: 34, margin: "12px 0 0", lineHeight: 1.15 }}>
        {str(settings, "title")}
      </h2>
      <p style={{ marginTop: 10, fontSize: 16, opacity: 0.9 }}>{str(settings, "subtitle")}</p>
      <Cta
        label={str(settings, "ctaLabel")}
        url={str(settings, "ctaUrl")}
        theme={context.theme}
        preview={context.preview}
      />
    </section>
  );
}

function HeroCountdown({ settings, context }: SectionProps) {
  const { fonts, muted, radius, border } = storefrontTokens(context.theme);
  return (
    <section style={{ border: `1px solid ${border}`, borderRadius: radius, padding: "36px 30px" }}>
      <h2 style={{ fontFamily: fonts.heading, fontSize: 32, margin: 0 }}>{str(settings, "title")}</h2>
      <p style={{ color: muted, marginTop: 10, fontSize: 15 }}>{str(settings, "subtitle")}</p>
      <CountdownDisplay endsAt={str(settings, "endsAt")} theme={context.theme} />
      <Cta
        label={str(settings, "ctaLabel")}
        url={str(settings, "ctaUrl")}
        theme={context.theme}
        preview={context.preview}
      />
    </section>
  );
}

function HeroBeforeAfter({ settings, context }: SectionProps) {
  const { radius, border, muted } = storefrontTokens(context.theme);
  const [position, setPosition] = useState(50);
  const before = str(settings, "beforeUrl");
  const after = str(settings, "afterUrl");
  const height = num(settings, "height", 380);

  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div
        style={{
          position: "relative",
          height,
          borderRadius: radius,
          overflow: "hidden",
          border: `1px solid ${border}`,
          background: before ? `url(${before}) center/cover no-repeat` : "rgba(120,130,145,.18)",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${position}%`,
            overflow: "hidden",
            background: after ? `url(${after}) left center/cover no-repeat` : "rgba(120,130,145,.32)",
          }}
        />
        <div style={{ position: "absolute", left: 12, bottom: 12, fontSize: 12, opacity: 0.9 }}>
          {str(settings, "afterLabel")}
        </div>
        <div style={{ position: "absolute", right: 12, bottom: 12, fontSize: 12, opacity: 0.9 }}>
          {str(settings, "beforeLabel")}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={position}
        aria-label="Öncesi / sonrası karşılaştırma"
        onChange={(event) => setPosition(Number(event.target.value))}
        style={{ width: "100%", marginTop: 14 }}
      />
      {!before && !after ? (
        <p style={{ color: muted, fontSize: 13 }}>Karşılaştırma için iki görsel adresi girin.</p>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------- BANNER */

function BannerSplit({ settings, context }: SectionProps) {
  const { fonts, radius, border } = storefrontTokens(context.theme);
  const height = num(settings, "height", 260);

  const cards = [
    {
      key: "left",
      title: str(settings, "leftTitle"),
      text: str(settings, "leftText"),
      image: str(settings, "leftImage"),
      url: str(settings, "leftUrl"),
    },
    {
      key: "right",
      title: str(settings, "rightTitle"),
      text: str(settings, "rightText"),
      image: str(settings, "rightImage"),
      url: str(settings, "rightUrl"),
    },
  ];

  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
      {cards.map((card) => (
        <Clickable
          key={card.key}
          url={card.url}
          preview={context.preview}
          style={{
            minHeight: height,
            borderRadius: radius,
            border: `1px solid ${border}`,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            color: card.image ? "#f8fafc" : "inherit",
            background: card.image
              ? `linear-gradient(rgba(6,10,16,.35), rgba(6,10,16,.65)), url(${card.image}) center/cover no-repeat`
              : "rgba(120,130,145,.10)",
          }}
        >
          <h3 style={{ fontFamily: fonts.heading, fontSize: 22, margin: 0 }}>{card.title}</h3>
          <p style={{ marginTop: 6, fontSize: 14, opacity: 0.85 }}>{card.text}</p>
        </Clickable>
      ))}
    </section>
  );
}

function BannerMasonry({ settings, context }: SectionProps) {
  const { fonts, radius, border } = storefrontTokens(context.theme);
  const items = parseRows(settings["items"], 3);
  const columns = num(settings, "columns", 3);
  const base = num(settings, "height", 220);
  if (!items.length) return null;

  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div style={{ display: "grid", gridTemplateColumns: gridColumns(columns), gap: 16 }}>
        {items.map((item, index) => {
          const [cardTitle, image, url] = item;
          return (
            <Clickable
              key={`${cardTitle}-${index}`}
              url={url ?? ""}
              preview={context.preview}
              style={{
                minHeight: index % 3 === 1 ? base * 1.35 : base,
                borderRadius: radius,
                border: `1px solid ${border}`,
                padding: 20,
                display: "flex",
                alignItems: "flex-end",
                color: image ? "#f8fafc" : "inherit",
                background: image
                  ? `linear-gradient(rgba(6,10,16,.3), rgba(6,10,16,.62)), url(${image}) center/cover no-repeat`
                  : "rgba(120,130,145,.10)",
              }}
            >
              <span style={{ fontFamily: fonts.heading, fontSize: 18, fontWeight: 600 }}>{cardTitle}</span>
            </Clickable>
          );
        })}
      </div>
    </section>
  );
}

function BannerScroll({ settings, context }: SectionProps) {
  const items = parseRows(settings["items"], 1).map((row) => row[0] ?? "");
  const speed = num(settings, "speed", 28);
  const tone = toneBackground(context.theme, str(settings, "tone"));
  const { radius } = storefrontTokens(context.theme);
  if (!items.length) return null;
  const loop = [...items, ...items];

  return (
    <section style={{ borderRadius: radius, overflow: "hidden", ...tone }}>
      <style>{`@keyframes mefti-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
      <div
        style={{
          display: "flex",
          gap: 40,
          padding: "12px 0",
          width: "max-content",
          animation: `mefti-marquee ${Math.max(8, speed)}s linear infinite`,
        }}
      >
        {loop.map((item, index) => (
          <span
            key={`${item}-${index}`}
            style={{ fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase", whiteSpace: "nowrap" }}
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function BannerColorGrid({ settings, context }: SectionProps) {
  const { radius, fonts } = storefrontTokens(context.theme);
  const items = parseRows(settings["items"], 3);
  const columns = num(settings, "columns", 4);
  const height = num(settings, "height", 140);
  if (!items.length) return null;

  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div style={{ display: "grid", gridTemplateColumns: gridColumns(columns, 900), gap: 14 }}>
        {items.map((item, index) => {
          const [label, color, url] = item;
          return (
            <Clickable
              key={`${label}-${index}`}
              url={url ?? ""}
              preview={context.preview}
              style={{
                minHeight: height,
                borderRadius: radius,
                background: color || "rgba(120,130,145,.2)",
                display: "flex",
                alignItems: "flex-end",
                padding: 16,
                color: "#f8fafc",
              }}
            >
              <span style={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 16 }}>{label}</span>
            </Clickable>
          );
        })}
      </div>
    </section>
  );
}

function BannerCollection({ settings, context }: SectionProps) {
  const { fonts, radius } = storefrontTokens(context.theme);
  const slug = str(settings, "collectionSlug");
  const collection =
    context.collections.find((item) => item.slug === slug) ?? context.collections[0] ?? null;
  if (!collection) return null;
  const image = str(settings, "imageUrl");
  const heading = str(settings, "title") || collection.title;

  const inner = (
    <>
      <h2 style={{ fontFamily: fonts.heading, fontSize: 30, margin: 0 }}>{heading}</h2>
      <p style={{ marginTop: 10, fontSize: 15, opacity: 0.86 }}>
        {str(settings, "text") || collection.description || ""}
      </p>
      <span style={{ ...buttonStyles(context.theme), marginTop: 18 }}>
        {str(settings, "ctaLabel") || "Koleksiyona git"}
      </span>
    </>
  );

  return (
    <CollectionLink
      collection={collection}
      context={context}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: num(settings, "height", 300),
        borderRadius: radius,
        padding: "36px 32px",
        color: image ? "#f8fafc" : "inherit",
        background: image
          ? `linear-gradient(rgba(6,10,16,.45), rgba(6,10,16,.6)), url(${image}) center/cover no-repeat`
          : "rgba(120,130,145,.10)",
      }}
    >
      {inner}
    </CollectionLink>
  );
}

function BannerPromo({ settings, context }: SectionProps) {
  const { fonts, radius } = storefrontTokens(context.theme);
  const tone = toneBackground(context.theme, str(settings, "tone"));
  return (
    <section
      style={{
        borderRadius: radius,
        padding: "22px 26px",
        display: "flex",
        flexWrap: "wrap",
        gap: 14,
        alignItems: "center",
        justifyContent: "space-between",
        ...tone,
      }}
    >
      <div>
        <h3 style={{ fontFamily: fonts.heading, fontSize: 20, margin: 0 }}>{str(settings, "title")}</h3>
        <p style={{ marginTop: 4, fontSize: 14, opacity: 0.88 }}>{str(settings, "text")}</p>
      </div>
      {str(settings, "ctaLabel") ? (
        <Cta
          label={str(settings, "ctaLabel")}
          url={str(settings, "ctaUrl")}
          theme={context.theme}
          preview={context.preview}
        />
      ) : null}
    </section>
  );
}

/* --------------------------------------------------------------------- ÜRÜN */

function ProductBlock({
  settings,
  context,
  source,
  filterKey,
}: SectionProps & { source: string; filterKey?: string }) {
  const items = selectProducts(
    context,
    source,
    filterKey ? str(settings, filterKey) : "",
    num(settings, "limit", 8),
  );
  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <ProductCollectionView
        items={items}
        context={context}
        layout={str(settings, "layout") === "slider" ? "slider" : "grid"}
        columns={num(settings, "columns", 4)}
      />
    </section>
  );
}

function ProductCategoryBlock({ settings, context }: SectionProps) {
  const slug = str(settings, "collectionSlug");
  const collection = context.collections.find((item) => item.slug === slug);
  const items = filterProducts(
    context.products,
    collection?.title ?? slug,
    num(settings, "limit", 8),
  );
  return (
    <section>
      <SectionHeading
        title={str(settings, "title") || collection?.title || "Koleksiyon ürünleri"}
        theme={context.theme}
      />
      <ProductCollectionView items={items} context={context} columns={num(settings, "columns", 4)} />
    </section>
  );
}

function ProductFeedBlock({ settings, context }: SectionProps) {
  const items = selectProducts(
    context,
    str(settings, "source") || "all",
    str(settings, "filter"),
    num(settings, "limit", 12),
  );
  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <ProductCollectionView
        items={items}
        context={context}
        layout={str(settings, "layout") === "slider" ? "slider" : "grid"}
        columns={num(settings, "columns", 4)}
      />
    </section>
  );
}

function RecentlyViewedBlock({ settings, context }: SectionProps) {
  const { muted, border, cardBg, radius, fonts } = storefrontTokens(context.theme);
  if (context.preview) {
    return (
      <Surface theme={context.theme}>
        <h2 style={{ fontFamily: fonts.heading, fontSize: 22, margin: 0 }}>{str(settings, "title")}</h2>
        <p style={{ color: muted, marginTop: 8, fontSize: 14 }}>
          Ziyaretçinin son gezdiği ürünler yayında bu alanda listelenir.
        </p>
      </Surface>
    );
  }
  return (
    <RecentlyViewed
      storeSlug={context.storeSlug}
      tokens={{ muted, border, cardBg, radius, headingFont: fonts.heading }}
    />
  );
}

function RelatedProducts({ settings, context }: SectionProps) {
  const items = filterProducts(context.products, str(settings, "filter"), num(settings, "limit", 6));
  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <ProductCollectionView
        items={items}
        context={context}
        layout="slider"
        cardWidth={num(settings, "cardWidth", 220)}
      />
    </section>
  );
}

/* ----------------------------------------------------------------- KATEGORİ */

function CategorySlider({ settings, context }: SectionProps) {
  const { fonts, muted, radius, border, cardBg } = storefrontTokens(context.theme);
  const cards = collectionCards(context, num(settings, "limit", 10));
  const width = num(settings, "cardWidth", 220);
  if (!cards.length) return null;

  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8 }}>
        {cards.map(({ collection }) => (
          <CollectionLink
            key={collection.id}
            collection={collection}
            context={context}
            style={{
              minWidth: width,
              maxWidth: width,
              flex: "0 0 auto",
              background: cardBg,
              border: `1px solid ${border}`,
              borderRadius: radius,
              padding: 18,
            }}
          >
            <div style={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 15 }}>{collection.title}</div>
            {collection.description ? (
              <div style={{ color: muted, fontSize: 13, marginTop: 6 }}>{collection.description}</div>
            ) : null}
          </CollectionLink>
        ))}
      </div>
    </section>
  );
}

function CategoryCards({ settings, context }: SectionProps) {
  const { fonts, muted, radius, border, cardBg, t } = storefrontTokens(context.theme);
  const cards = collectionCards(context, num(settings, "limit", 8));
  if (!cards.length) return null;

  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div style={{ display: "grid", gridTemplateColumns: gridColumns(num(settings, "columns", 4)), gap: 16 }}>
        {cards.map(({ collection, count }) => (
          <CollectionLink
            key={collection.id}
            collection={collection}
            context={context}
            style={{
              background: cardBg,
              border: `1px solid ${border}`,
              borderTop: `3px solid ${t.accent_color}`,
              borderRadius: radius,
              padding: 20,
              minHeight: 110,
            }}
          >
            <div style={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 16 }}>{collection.title}</div>
            {collection.description ? (
              <div style={{ color: muted, fontSize: 13, marginTop: 6 }}>{collection.description}</div>
            ) : null}
            {bool(settings, "showCount") ? (
              <div style={{ color: t.accent_color, fontSize: 12, marginTop: 10 }}>{count} ürün</div>
            ) : null}
          </CollectionLink>
        ))}
      </div>
    </section>
  );
}

function CategoryMega({ settings, context }: SectionProps) {
  const { fonts, muted, radius, border, cardBg } = storefrontTokens(context.theme);
  const columns = num(settings, "columns", 4);
  const perColumn = num(settings, "itemsPerColumn", 5);
  const cards = collectionCards(context, columns);
  if (!cards.length) return null;

  return (
    <section style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: radius, padding: 24 }}>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div style={{ display: "grid", gridTemplateColumns: gridColumns(columns), gap: 22 }}>
        {cards.map(({ collection }) => {
          const items = filterProducts(context.products, collection.title, perColumn);
          return (
            <div key={collection.id}>
              <CollectionLink collection={collection} context={context} style={{ display: "block" }}>
                <div style={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 15 }}>{collection.title}</div>
              </CollectionLink>
              <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 6 }}>
                {items.map((product) =>
                  context.preview ? (
                    <li key={product.id} style={{ color: muted, fontSize: 13 }}>
                      {product.title}
                    </li>
                  ) : (
                    <li key={product.id}>
                      <Link
                        to="/s/$slug/p/$productSlug"
                        params={{ slug: context.storeSlug, productSlug: product.slug }}
                        style={{ color: muted, fontSize: 13, textDecoration: "none" }}
                      >
                        {product.title}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- İÇERİK */

function RichText({ settings, context }: SectionProps) {
  const { fonts, muted } = storefrontTokens(context.theme);
  const maxWidth = num(settings, "maxWidth", 760) || undefined;
  const center = str(settings, "align") === "center";
  return (
    <section style={{ maxWidth, marginInline: maxWidth ? "auto" : undefined, textAlign: center ? "center" : "left" }}>
      <h2 style={{ fontFamily: fonts.heading, fontSize: 26, margin: 0 }}>{str(settings, "title")}</h2>
      <p style={{ color: muted, marginTop: 12, fontSize: 15, lineHeight: 1.8, whiteSpace: "pre-line" }}>
        {str(settings, "body")}
      </p>
    </section>
  );
}

function IconBoxes({ settings, context, settingsKey }: SectionProps & { settingsKey: string }) {
  const { fonts, muted, radius, border, cardBg } = storefrontTokens(context.theme);
  const items = parseRows(settings[settingsKey], 3);
  if (!items.length) return null;

  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div style={{ display: "grid", gridTemplateColumns: gridColumns(num(settings, "columns", 3)), gap: 16 }}>
        {items.map((item, index) => {
          const [icon, heading, text] = item;
          return (
            <div
              key={`${heading}-${index}`}
              style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: radius, padding: 20 }}
            >
              <div style={{ fontSize: 24 }}>{icon}</div>
              <div style={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 16, marginTop: 10 }}>
                {heading}
              </div>
              <p style={{ color: muted, fontSize: 14, marginTop: 6, lineHeight: 1.6 }}>{text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VideoBlock({ settings, context }: SectionProps) {
  const { muted, radius, border } = storefrontTokens(context.theme);
  const aspect = str(settings, "aspect") || "16:9";
  const ratio = aspect === "1:1" ? "1 / 1" : aspect === "4:3" ? "4 / 3" : "16 / 9";
  const video = str(settings, "videoUrl");
  const embed = str(settings, "embedUrl");

  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div
        style={{
          aspectRatio: ratio,
          width: "100%",
          borderRadius: radius,
          border: `1px solid ${border}`,
          overflow: "hidden",
          background: "rgba(120,130,145,.14)",
        }}
      >
        {video ? (
          <video src={video} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : embed ? (
          <iframe
            src={embed}
            title={str(settings, "title") || "Video"}
            allowFullScreen
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        ) : null}
      </div>
      {str(settings, "caption") ? (
        <p style={{ color: muted, fontSize: 13, marginTop: 10 }}>{str(settings, "caption")}</p>
      ) : null}
    </section>
  );
}

function GalleryBlock({ settings, context }: SectionProps) {
  const { radius, border, muted } = storefrontTokens(context.theme);
  const images = parseRows(settings["images"], 1).map((row) => row[0] ?? "");
  const height = num(settings, "height", 220);
  if (!images.length) return <p style={{ color: muted, fontSize: 14 }}>Galeriye görsel ekleyin.</p>;

  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div style={{ display: "grid", gridTemplateColumns: gridColumns(num(settings, "columns", 3)), gap: 14 }}>
        {images.map((image, index) => (
          <div
            key={`${image}-${index}`}
            style={{ height, borderRadius: radius, overflow: "hidden", border: `1px solid ${border}` }}
          >
            <img
              src={image}
              alt={`${str(settings, "title") || "Galeri"} ${index + 1}`}
              loading="lazy"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function CountersBlock({ settings, context }: SectionProps) {
  const { fonts, muted, radius, border } = storefrontTokens(context.theme);
  const items = parseRows(settings["items"], 2);
  if (!items.length) return null;

  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div style={{ display: "grid", gridTemplateColumns: gridColumns(num(settings, "columns", 3)), gap: 16 }}>
        {items.map((item, index) => (
          <div
            key={`${item[0]}-${index}`}
            style={{ border: `1px solid ${border}`, borderRadius: radius, padding: 22, textAlign: "center" }}
          >
            <div style={{ fontFamily: fonts.heading, fontSize: 30, fontWeight: 700 }}>{item[0]}</div>
            <div style={{ color: muted, fontSize: 14, marginTop: 6 }}>{item[1]}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BrandsBlock({ settings, context }: SectionProps) {
  const { fonts, radius, border, cardBg } = storefrontTokens(context.theme);
  const items = parseRows(settings["items"], 3);
  if (!items.length) return null;

  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div style={{ display: "grid", gridTemplateColumns: gridColumns(num(settings, "columns", 4), 900), gap: 14 }}>
        {items.map((item, index) => {
          const [name, logo, url] = item;
          return (
            <Clickable
              key={`${name}-${index}`}
              url={url ?? ""}
              preview={context.preview}
              style={{
                background: cardBg,
                border: `1px solid ${border}`,
                borderRadius: radius,
                padding: 18,
                minHeight: 84,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {logo ? (
                <img src={logo} alt={name} loading="lazy" style={{ maxHeight: 40, maxWidth: "100%" }} />
              ) : (
                <span style={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 15 }}>{name}</span>
              )}
            </Clickable>
          );
        })}
      </div>
    </section>
  );
}

function LogoCloud({ settings, context }: SectionProps) {
  const { muted } = storefrontTokens(context.theme);
  const logos = parseRows(settings["logos"], 1).map((row) => row[0] ?? "");
  const height = num(settings, "height", 44);
  if (!logos.length) return <p style={{ color: muted, fontSize: 14 }}>Logo adresleri ekleyin.</p>;

  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center" }}>
        {logos.map((logo, index) => (
          <img
            key={`${logo}-${index}`}
            src={logo}
            alt={`Logo ${index + 1}`}
            loading="lazy"
            style={{
              height,
              filter: bool(settings, "grayscale") ? "grayscale(1)" : undefined,
              opacity: bool(settings, "grayscale") ? 0.75 : 1,
            }}
          />
        ))}
      </div>
    </section>
  );
}

function MapBlock({ settings, context }: SectionProps) {
  const { muted, radius, border } = storefrontTokens(context.theme);
  const embed = str(settings, "embedUrl");
  const height = num(settings, "height", 320);

  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      {str(settings, "address") ? (
        <p style={{ color: muted, fontSize: 14, whiteSpace: "pre-line", marginTop: 0 }}>
          {str(settings, "address")}
        </p>
      ) : null}
      <div
        style={{
          height,
          borderRadius: radius,
          border: `1px solid ${border}`,
          overflow: "hidden",
          background: "rgba(120,130,145,.14)",
          marginTop: 14,
        }}
      >
        {embed ? (
          <iframe
            src={embed}
            title="Mağaza konumu"
            loading="lazy"
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        ) : null}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- PAZARLAMA */

function CampaignBanner({ settings, context }: SectionProps) {
  const { fonts, radius, t } = storefrontTokens(context.theme);
  const image = str(settings, "imageUrl");
  return (
    <section
      style={{
        borderRadius: radius,
        padding: "30px 28px",
        color: image ? "#f8fafc" : undefined,
        background: image
          ? `linear-gradient(rgba(6,10,16,.5), rgba(6,10,16,.5)), url(${image}) center/cover no-repeat`
          : `linear-gradient(120deg, ${t.accent_color}33, ${t.primary_color}1f)`,
      }}
    >
      <h3 style={{ fontFamily: fonts.heading, fontSize: 24, margin: 0 }}>{str(settings, "title")}</h3>
      <p style={{ marginTop: 8, fontSize: 15, opacity: 0.9 }}>{str(settings, "text")}</p>
      <Cta
        label={str(settings, "ctaLabel")}
        url={str(settings, "ctaUrl")}
        theme={context.theme}
        preview={context.preview}
      />
    </section>
  );
}

function CouponBanner({ settings, context }: SectionProps) {
  const { fonts, muted, radius, border, t } = storefrontTokens(context.theme);
  const code = str(settings, "code");
  const [copied, setCopied] = useState(false);

  return (
    <Surface theme={context.theme} style={{ borderStyle: "dashed" }}>
      <h3 style={{ fontFamily: fonts.heading, fontSize: 22, margin: 0 }}>{str(settings, "title")}</h3>
      <p style={{ color: muted, marginTop: 8, fontSize: 14 }}>{str(settings, "text")}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 16 }}>
        <code
          style={{
            border: `1px dashed ${border}`,
            borderRadius: radius,
            padding: "10px 18px",
            fontSize: 16,
            letterSpacing: ".12em",
            fontWeight: 700,
          }}
        >
          {code}
        </code>
        <button
          type="button"
          disabled={context.preview}
          onClick={() => {
            void navigator.clipboard?.writeText(code);
            setCopied(true);
          }}
          style={{
            background: t.accent_color,
            color: "#12181f",
            border: "none",
            borderRadius: radius,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            cursor: context.preview ? "default" : "pointer",
          }}
        >
          {copied ? "Kopyalandı" : "Kodu kopyala"}
        </button>
      </div>
      {str(settings, "expiresAt") ? (
        <p style={{ color: muted, fontSize: 12, marginTop: 12 }}>
          Son geçerlilik: {str(settings, "expiresAt")}
        </p>
      ) : null}
    </Surface>
  );
}

function CountdownBlock({ settings, context }: SectionProps) {
  const { fonts, muted } = storefrontTokens(context.theme);
  return (
    <Surface theme={context.theme}>
      <h3 style={{ fontFamily: fonts.heading, fontSize: 22, margin: 0 }}>{str(settings, "title")}</h3>
      {str(settings, "text") ? (
        <p style={{ color: muted, marginTop: 8, fontSize: 14 }}>{str(settings, "text")}</p>
      ) : null}
      <CountdownDisplay endsAt={str(settings, "endsAt")} theme={context.theme} />
      <Cta
        label={str(settings, "ctaLabel")}
        url={str(settings, "ctaUrl")}
        theme={context.theme}
        preview={context.preview}
      />
    </Surface>
  );
}

function FreeShippingBar({ settings, context }: SectionProps) {
  const { radius } = storefrontTokens(context.theme);
  const configured = num(settings, "threshold", 0);
  // Ayar boş/0 ise mağazanın gerçek kargo tarifelerindeki ücretsiz kargo eşiği kullanılır.
  const threshold = configured > 0 ? configured : (context.commerce?.freeShippingThreshold ?? 0);
  const tone = toneBackground(context.theme, str(settings, "tone"));
  const eta = context.commerce?.fastestEtaDays ?? null;
  if (threshold <= 0) return null;
  const text = str(settings, "text")
    .replace("{tutar}", formatMoney(threshold, context.storeCurrency))
    .replace("{gun}", eta ? String(eta) : "1-3");

  return (
    <section
      style={{
        borderRadius: radius,
        padding: "14px 20px",
        textAlign: "center",
        fontSize: 14,
        fontWeight: 600,
        ...tone,
      }}
    >
      {text}
    </section>
  );
}

/** Rozetler boş bırakılırsa mağazanın gerçek kargo ve ödeme verisinden üretilir. */
function TrustBadges({ settings, context }: SectionProps) {
  const commerce = context.commerce;
  const configured = String(settings["items"] ?? "").trim();
  const auto = useMemo(() => {
    if (configured) return configured;
    if (!commerce) return "";
    const rows: string[] = [];
    if (commerce.payments.length) {
      rows.push(
        `🔐 | Güvenli ödeme | ${commerce.payments.map((payment) => payment.displayName).join(", ")}`,
      );
      if (commerce.payments.some((payment) => payment.installments)) {
        rows.push("💳 | Taksit imkânı | Anlaşmalı bankalarla taksitli ödeme");
      }
    }
    if (commerce.fastestEtaDays) {
      rows.push(`📦 | Hızlı kargo | Ortalama ${commerce.fastestEtaDays} iş günü teslim`);
    }
    if (commerce.freeShippingThreshold) {
      rows.push(
        `🚚 | Ücretsiz kargo | ${formatMoney(commerce.freeShippingThreshold, commerce.currency)} üzeri siparişlerde`,
      );
    }
    return rows.join("\n");
  }, [commerce, configured]);

  if (!auto) return null;
  return <IconBoxes settings={{ ...settings, items: auto }} context={context} settingsKey="items" />;
}


function SocialProof({ settings, context }: SectionProps) {
  const items = useMemo(() => parseRows(settings["items"], 2), [settings]);
  const seconds = Math.max(2, num(settings, "intervalSeconds", 5));
  const [index, setIndex] = useState(0);
  const { fonts, muted, radius, border, cardBg, t } = storefrontTokens(context.theme);

  useEffect(() => {
    if (items.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), seconds * 1000);
    return () => window.clearInterval(timer);
  }, [items.length, seconds]);

  if (!items.length) return null;
  const current = items[index % items.length]!;

  return (
    <section
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: radius,
        padding: "12px 18px",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, background: t.accent_color }} />
      <span style={{ fontFamily: fonts.heading, fontSize: 14 }}>{current[0]}</span>
      <span style={{ color: muted, fontSize: 12 }}>{current[1]}</span>
    </section>
  );
}

function ReviewsBlock({ settings, context }: SectionProps) {
  const { fonts, muted, radius, border, cardBg, t } = storefrontTokens(context.theme);
  const items = parseRows(settings["items"], 3);
  if (!items.length) return null;

  return (
    <section>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div style={{ display: "grid", gridTemplateColumns: gridColumns(num(settings, "columns", 3)), gap: 16 }}>
        {items.map((item, index) => {
          const rating = Math.min(5, Math.max(0, Math.round(Number(item[0]) || 0)));
          return (
            <div
              key={`${item[2]}-${index}`}
              style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: radius, padding: 20 }}
            >
              <div style={{ color: t.accent_color, letterSpacing: 2, fontSize: 14 }}>
                {"★".repeat(rating)}
                <span style={{ opacity: 0.3 }}>{"★".repeat(5 - rating)}</span>
              </div>
              <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.65 }}>{item[1]}</p>
              <div style={{ color: muted, fontFamily: fonts.heading, fontSize: 13, marginTop: 10 }}>{item[2]}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- E-TİCARET */

function LinkCard({
  settings,
  context,
  target,
}: SectionProps & { target: "cart" | "favorites" | "compare" }) {
  const { fonts, muted } = storefrontTokens(context.theme);
  const label = str(settings, "ctaLabel") || "Devam et";
  const button = <span style={{ ...buttonStyles(context.theme), marginTop: 18 }}>{label}</span>;

  const link = context.preview ? (
    button
  ) : target === "cart" ? (
    <Link to="/s/$slug/cart" params={{ slug: context.storeSlug }} style={{ textDecoration: "none" }}>
      {button}
    </Link>
  ) : target === "favorites" ? (
    <Link to="/s/$slug/favorites" params={{ slug: context.storeSlug }} style={{ textDecoration: "none" }}>
      {button}
    </Link>
  ) : (
    <Link to="/s/$slug/compare" params={{ slug: context.storeSlug }} style={{ textDecoration: "none" }}>
      {button}
    </Link>
  );

  return (
    <Surface theme={context.theme}>
      <h3 style={{ fontFamily: fonts.heading, fontSize: 22, margin: 0 }}>{str(settings, "title")}</h3>
      <p style={{ color: muted, marginTop: 8, fontSize: 15 }}>{str(settings, "text")}</p>
      {link}
    </Surface>
  );
}

function FeaturedCollection({ settings, context }: SectionProps) {
  const { fonts, muted } = storefrontTokens(context.theme);
  const slug = str(settings, "collectionSlug");
  const collection = context.collections.find((item) => item.slug === slug) ?? context.collections[0] ?? null;
  const items: SectionProduct[] = collection
    ? filterProducts(context.products, collection.title, num(settings, "limit", 4))
    : context.products.slice(0, num(settings, "limit", 4));

  return (
    <section>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontFamily: fonts.heading, fontSize: 24, margin: 0 }}>
          {str(settings, "title") || collection?.title || "Öne çıkan koleksiyon"}
        </h2>
        {collection && !context.preview ? (
          <Link
            to="/s/$slug/c/$collectionSlug"
            params={{ slug: context.storeSlug, collectionSlug: collection.slug }}
            style={{ color: muted, fontSize: 14, textDecoration: "none" }}
          >
            {str(settings, "ctaLabel") || "Tümünü gör"} →
          </Link>
        ) : null}
      </div>
      <ProductCollectionView items={items} context={context} columns={num(settings, "columns", 4)} />
    </section>
  );
}
