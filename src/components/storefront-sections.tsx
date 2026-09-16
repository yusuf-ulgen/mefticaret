import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import { ExtendedBlock } from "@/components/storefront-blocks";
import { FavoriteButton } from "@/components/favorite-button";
import { QuickAddButton } from "@/components/quick-add-button";
import { buttonStyles, cardStyles, storefrontTokens, type StoreTheme } from "@/components/storefront-chrome";
import { formatMoney } from "@/lib/mefti";
import type { StorefrontCommerce } from "@/lib/storefront-commerce";
import {
  parsePairs,
  sanitizeHtml,
  type ResolvedSection,
  type SectionSettings,
} from "@/lib/theme-sections";

export type SectionProduct = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  base_price: number | string;
  compare_at_price?: number | string | null;
  currency?: string | null;
  product_type?: string | null;
  tags?: string[] | null;
  coverUrl?: string | null;
};

export type SectionCollection = { id: string; title: string; slug: string; description?: string | null };
export type SectionPage = { title: string; slug: string; excerpt?: string | null };

export type SectionContext = {
  theme: StoreTheme;
  storeSlug: string;
  storeName: string;
  storeCurrency: string;
  products: SectionProduct[];
  collections: SectionCollection[];
  pages: SectionPage[];
  /** Mağazanın gerçek kargo/ödeme verisi (bloklar otomatik doldurmak için kullanır). */
  commerce?: StorefrontCommerce | undefined;
  /** Editör önizlemesinde bağlantılar pasifleştirilir. */
  preview?: boolean | undefined;
};

const str = (settings: SectionSettings, key: string) => String(settings[key] ?? "");
const num = (settings: SectionSettings, key: string, fallback: number) => {
  const value = Number(settings[key]);
  return Number.isFinite(value) ? value : fallback;
};
const bool = (settings: SectionSettings, key: string) => Boolean(settings[key]);

/** Ürün tipi veya etiket filtresi uygular. */
function filterProducts(products: SectionProduct[], filter: string, limit: number) {
  const needle = filter.trim().toLocaleLowerCase("tr");
  const pool = needle
    ? products.filter((product) =>
        [product.product_type ?? "", ...(product.tags ?? [])]
          .join(" ")
          .toLocaleLowerCase("tr")
          .includes(needle),
      )
    : products;
  return pool.slice(0, Math.max(1, limit));
}

/** Modüler tema bileşenlerini (gövde slotu) sırayla render eder. */
export function StorefrontSections({
  sections,
  context,
}: {
  sections: ResolvedSection[];
  context: SectionContext;
}) {
  return (
    <>
      {sections
        .filter((section) => section.isEnabled && section.definition.slot === "body")
        .map((section) => (
          <ResponsiveSection key={section.id} section={section} context={context} />
        ))}
    </>
  );
}

/**
 * Bölüm sarmalayıcısı: cihaz bazlı görünürlük ve kolon sayısı ayarlarını
 * medya sorgularına çevirir (masaüstü / tablet / mobil).
 */
function ResponsiveSection({ section, context }: { section: ResolvedSection; context: SectionContext }) {
  const s = section.settings;
  const has = (key: string) => key in section.definition.defaults;
  const flag = (key: string) => (has(key) ? Boolean(s[key]) : true);
  const columns = Math.max(1, num(s, "columns", 3));
  const tabletCols = Math.max(0, num(s, "columnsTablet", 0)) || Math.min(columns, 2);
  const mobileCols = Math.max(0, num(s, "columnsMobile", 0)) || 1;
  const cls = `sf-s-${section.id.replace(/[^a-zA-Z0-9]/g, "")}`;
  const spacing = storefrontTokens(context.theme).sectionSpacing;

  const css = [
    `@media (max-width: 1024px){.${cls}{--sf-cols:${tabletCols};}}`,
    `@media (max-width: 640px){.${cls}{--sf-cols:${mobileCols};}}`,
    flag("showOnDesktop") ? "" : `@media (min-width: 1025px){.${cls}{display:none;}}`,
    flag("showOnTablet") ? "" : `@media (min-width: 641px) and (max-width: 1024px){.${cls}{display:none;}}`,
    flag("showOnMobile") ? "" : `@media (max-width: 640px){.${cls}{display:none;}}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      className={`sf-section ${cls}`}
      data-section-id={section.id}
      data-section-label={section.definition.label}
      style={{ marginBottom: `var(--sf-section-space, ${spacing}px)` }}
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <StorefrontSection section={section} context={context} />
    </div>
  );
}

function StorefrontSection({ section, context }: { section: ResolvedSection; context: SectionContext }) {
  const s = section.settings;
  switch (section.type) {
    case "hero":
      return <HeroSection settings={s} context={context} />;
    case "banner":
      return <BannerSection settings={s} context={context} />;
    case "product_grid":
      return <ProductGridSection settings={s} context={context} />;
    case "product_slider":
      return <ProductSliderSection settings={s} context={context} />;
    case "category_grid":
      return <CategoryGridSection settings={s} context={context} />;
    case "image_text":
      return <ImageTextSection settings={s} context={context} />;
    case "testimonials":
      return <TestimonialsSection settings={s} context={context} />;
    case "faq":
      return <FaqSection settings={s} context={context} />;
    case "blog":
      return <BlogSection settings={s} context={context} />;
    case "newsletter":
      return <NewsletterSection settings={s} context={context} />;
    case "custom_html":
      return <CustomHtmlSection settings={s} />;
    default:
      return <ExtendedBlock section={section} context={context} />;
  }
}

type SectionProps = { settings: SectionSettings; context: SectionContext };

function SectionHeading({ title, theme }: { title: string; theme: StoreTheme }) {
  const { fonts } = storefrontTokens(theme);
  if (!title.trim()) return null;
  return <h2 style={{ fontFamily: fonts.heading, fontSize: 24, margin: "0 0 18px" }}>{title}</h2>;
}

function Cta({
  label,
  url,
  theme,
  preview,
}: {
  label: string;
  url: string;
  theme: StoreTheme;
  preview?: boolean | undefined;
}) {
  if (!label.trim()) return null;
  const style = { ...buttonStyles(theme), marginTop: 20 };
  if (preview || !url.trim()) return <span style={style}>{label}</span>;
  return (
    <a href={url} style={style}>
      {label}
    </a>
  );
}

/** Verilen zemin renginin üzerinde okunabilir yazı rengini döndürür. */
function readableOn(background: string) {
  const hex = background.trim().replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return { fg: "#f8fafc", soft: "rgba(248,250,252,.86)" };
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.5
    ? { fg: "#0b1220", soft: "rgba(11,18,32,.72)" }
    : { fg: "#f8fafc", soft: "rgba(248,250,252,.86)" };
}

function HeroSection({ settings, context }: SectionProps) {
  const { t, fonts, radius } = storefrontTokens(context.theme);
  // Görsel seçilmediyse mağazanın ilk ürün fotoğrafı arka plan olarak kullanılır;
  // böylece tanıtım alanı boş bir renk bloğu gibi görünmez.
  const image = str(settings, "imageUrl") || context.products.find((p) => p.coverUrl)?.coverUrl || "";
  const center = str(settings, "align") === "center";
  const height = num(settings, "height", 420);
  const ink = image ? { fg: "#f8fafc", soft: "rgba(248,250,252,.90)" } : readableOn(t.primary_color);

  return (
    <section
      className="sf-hero"
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: radius,
        minHeight: height,
        display: "flex",
        alignItems: "center",
        justifyContent: center ? "center" : "flex-start",
        textAlign: center ? "center" : "left",
        margin: "28px 0",
        background: image
          ? `linear-gradient(100deg, rgba(6,10,16,.82), rgba(6,10,16,.45) 62%, rgba(6,10,16,.25)), url(${image}) center/cover no-repeat`
          : `linear-gradient(140deg, ${t.primary_color}, ${t.accent_color})`,
        color: ink.fg,
      }}
    >
      <div style={{ maxWidth: 620, position: "relative", zIndex: 1 }}>
        <h1
          style={{
            fontFamily: fonts.heading,
            fontSize: "clamp(28px, 5.2vw, 44px)",
            lineHeight: 1.08,
            fontWeight: 700,
            margin: 0,
            color: ink.fg,
            textWrap: "balance",
          }}
        >
          {str(settings, "title")}
        </h1>
        <p
          style={{
            color: ink.soft,
            marginTop: 14,
            fontSize: "clamp(14px, 2.2vw, 17px)",
            lineHeight: 1.6,
            maxWidth: 520,
          }}
        >
          {str(settings, "subtitle")}
        </p>
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

function BannerSection({ settings, context }: SectionProps) {
  const { t, fonts, radius, border, muted } = storefrontTokens(context.theme);
  const style = str(settings, "style");
  const image = str(settings, "imageUrl");

  const background = image
    ? `linear-gradient(rgba(6,10,16,.5), rgba(6,10,16,.5)), url(${image}) center/cover no-repeat`
    : style === "gradient"
      ? `linear-gradient(120deg, ${t.accent_color}33, ${t.primary_color}22)`
      : style === "solid"
        ? t.accent_color
        : "transparent";

  return (
    <section
      style={{
        margin: "16px 0 32px",
        padding: "28px 26px",
        borderRadius: radius,
        background,
        border: style === "outline" ? `1px solid ${border}` : undefined,
        color: image ? "#f8fafc" : style === "solid" ? "#12181f" : undefined,
      }}
    >
      <h3 style={{ fontFamily: fonts.heading, fontSize: 22, margin: 0 }}>{str(settings, "title")}</h3>
      <p style={{ marginTop: 8, color: image || style === "solid" ? "inherit" : muted, fontSize: 15 }}>
        {str(settings, "text")}
      </p>
      <Cta
        label={str(settings, "ctaLabel")}
        url={str(settings, "ctaUrl")}
        theme={context.theme}
        preview={context.preview}
      />
    </section>
  );
}

function ProductCard({
  product,
  context,
  showPrice = true,
  width,
}: {
  product: SectionProduct;
  context: SectionContext;
  showPrice?: boolean;
  width?: number;
}) {
  const { t, fonts, muted, cardBg, border, radius, dark } = storefrontTokens(context.theme);
  const currency = product.currency ?? context.storeCurrency;

  const body = (
    <>
      <div
        style={{
          height: 160,
          borderRadius: radius,
          overflow: "hidden",
          background: dark
            ? "linear-gradient(140deg, rgba(255,255,255,.12), rgba(255,255,255,.03))"
            : `linear-gradient(140deg, ${t.accent_color}22, ${t.primary_color}12)`,
          marginBottom: 14,
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
      <div style={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 15 }}>{product.title}</div>
      {showPrice ? (
        <div style={{ marginTop: 6, display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontWeight: 600 }}>{formatMoney(Number(product.base_price), currency)}</span>
          {product.compare_at_price ? (
            <span style={{ color: muted, fontSize: 13, textDecoration: "line-through" }}>
              {formatMoney(Number(product.compare_at_price), currency)}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );

  const shell = {
    ...cardStyles(context.theme),
    textDecoration: "none",
    color: "inherit",
    display: "block",
    position: "relative" as const,
    minWidth: width,
    maxWidth: width,
    flex: width ? "0 0 auto" : undefined,
  };

  if (context.preview) {
    return <div style={shell}>{body}</div>;
  }

  return (
    <div style={shell}>
      <FavoriteButton
        item={{
          storeSlug: context.storeSlug,
          productSlug: product.slug,
          title: product.title,
          price: Number(product.base_price),
          currency,
          image: product.coverUrl ?? null,
        }}
        border={border}
        cardBg={cardBg}
        accent={t.accent_color}
        muted={muted}
      />
      <Link
        to="/s/$slug/p/$productSlug"
        params={{ slug: context.storeSlug, productSlug: product.slug }}
        style={{ textDecoration: "none", color: "inherit", display: "block" }}
      >
        {body}
      </Link>
      <QuickAddButton storeSlug={context.storeSlug} productSlug={product.slug} accent={t.accent_color} />
    </div>
  );
}

function ProductGridSection({ settings, context }: SectionProps) {
  const [query, setQuery] = useState("");
  const { muted, cardBg, border, radius, fonts } = storefrontTokens(context.theme);
  const columns = num(settings, "columns", 4);
  const limit = num(settings, "limit", 12);

  const items = useMemo(() => {
    const base = filterProducts(context.products, str(settings, "collectionSlug"), limit);
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return base;
    return base.filter((product) =>
      [product.title, product.description ?? "", ...(product.tags ?? [])]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q),
    );
  }, [context.products, settings, limit, query]);

  return (
    <section id="urunler" style={{ paddingBottom: 40 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 18,
        }}
      >
        <h2 style={{ fontFamily: fonts.heading, fontSize: 24, margin: 0 }}>{str(settings, "title")}</h2>
        {bool(settings, "showSearch") && !context.preview ? (
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ürün ara…"
            aria-label="Ürünlerde ara"
            style={{
              background: cardBg,
              color: "inherit",
              border: `1px solid ${border}`,
              borderRadius: radius,
              padding: "9px 14px",
              fontSize: 14,
              fontFamily: "inherit",
              minWidth: 220,
            }}
          />
        ) : null}
      </div>
      {items.length === 0 ? (
        <p style={{ color: muted }}>Gösterilecek ürün bulunamadı.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(1100 / Math.max(2, columns))}px, 1fr))`,
            gap: 18,
          }}
        >
          {items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              context={context}
              showPrice={bool(settings, "showPrice")}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProductSliderSection({ settings, context }: SectionProps) {
  const { muted } = storefrontTokens(context.theme);
  const items = filterProducts(context.products, str(settings, "collectionSlug"), num(settings, "limit", 10));
  const width = num(settings, "cardWidth", 240);

  return (
    <section style={{ paddingBottom: 40 }}>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      {items.length === 0 ? (
        <p style={{ color: muted }}>Gösterilecek ürün bulunamadı.</p>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 16,
            overflowX: "auto",
            paddingBottom: 10,
            scrollSnapType: "x mandatory",
          }}
        >
          {items.map((product) => (
            <div key={product.id} style={{ scrollSnapAlign: "start" }}>
              <ProductCard product={product} context={context} width={width} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CategoryGridSection({ settings, context }: SectionProps) {
  const { t, fonts, muted, cardBg, border, radius } = storefrontTokens(context.theme);
  const columns = num(settings, "columns", 4);
  const limit = num(settings, "limit", 8);
  const useCollections = str(settings, "source") !== "product_types";

  const cards = useCollections
    ? context.collections.slice(0, limit).map((collection) => ({
        key: collection.id,
        title: collection.title,
        subtitle: collection.description ?? "",
        to: { kind: "collection" as const, slug: collection.slug },
      }))
    : Array.from(new Set(context.products.map((product) => product.product_type).filter(Boolean) as string[]))
        .slice(0, limit)
        .map((type) => ({
          key: type,
          title: type,
          subtitle: `${context.products.filter((product) => product.product_type === type).length} ürün`,
          to: { kind: "type" as const, slug: type },
        }));

  if (!cards.length) return null;

  return (
    <section style={{ paddingBottom: 40 }}>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fill, minmax(${Math.round(1100 / Math.max(2, columns))}px, 1fr))`,
          gap: 16,
        }}
      >
        {cards.map((card) => {
          const inner = (
            <>
              <div style={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 16 }}>{card.title}</div>
              {card.subtitle ? (
                <div style={{ color: muted, fontSize: 13, marginTop: 6 }}>{card.subtitle}</div>
              ) : null}
            </>
          );
          const shell = {
            background: cardBg,
            border: `1px solid ${border}`,
            borderRadius: radius,
            padding: 18,
            minHeight: 96,
            textDecoration: "none",
            color: "inherit",
            display: "block",
            borderTop: `3px solid ${t.accent_color}`,
          } as const;

          if (context.preview) {
            return (
              <div key={card.key} style={shell}>
                {inner}
              </div>
            );
          }
          return card.to.kind === "collection" ? (
            <Link
              key={card.key}
              to="/s/$slug/c/$collectionSlug"
              params={{ slug: context.storeSlug, collectionSlug: card.to.slug }}
              style={shell}
            >
              {inner}
            </Link>
          ) : (
            <Link
              key={card.key}
              to="/s/$slug/categories"
              params={{ slug: context.storeSlug }}
              search={{ c: card.to.slug }}
              style={shell}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ImageTextSection({ settings, context }: SectionProps) {
  const { fonts, muted, radius, t } = storefrontTokens(context.theme);
  const image = str(settings, "imageUrl");
  const right = str(settings, "imagePosition") === "right";

  const visual = (
    <div
      style={{
        borderRadius: radius,
        minHeight: 260,
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
      <h2 style={{ fontFamily: fonts.heading, fontSize: 26, margin: 0 }}>{str(settings, "title")}</h2>
      <p style={{ color: muted, marginTop: 12, fontSize: 15, lineHeight: 1.7, whiteSpace: "pre-line" }}>
        {str(settings, "text")}
      </p>
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
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 28,
        alignItems: "center",
        paddingBottom: 44,
      }}
    >
      {right ? copy : visual}
      {right ? visual : copy}
    </section>
  );
}

function TestimonialsSection({ settings, context }: SectionProps) {
  const { fonts, muted, cardBg, border, radius, t } = storefrontTokens(context.theme);
  const items = parsePairs(settings["items"]);
  const columns = num(settings, "columns", 3);
  if (!items.length) return null;

  return (
    <section style={{ paddingBottom: 44 }}>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(${Math.round(1100 / Math.max(1, columns))}px, 1fr))`,
          gap: 16,
        }}
      >
        {items.map((item, index) => (
          <blockquote
            key={`${item.left}-${index}`}
            style={{
              margin: 0,
              background: cardBg,
              border: `1px solid ${border}`,
              borderRadius: radius,
              padding: 20,
            }}
          >
            <div style={{ color: t.accent_color, fontSize: 20, lineHeight: 1 }}>“</div>
            <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.65 }}>{item.left}</p>
            {item.right ? (
              <footer style={{ marginTop: 12, color: muted, fontFamily: fonts.heading, fontSize: 13 }}>
                {item.right}
              </footer>
            ) : null}
          </blockquote>
        ))}
      </div>
    </section>
  );
}

function FaqSection({ settings, context }: SectionProps) {
  const { fonts, muted, border, radius, cardBg } = storefrontTokens(context.theme);
  const items = parsePairs(settings["items"]);
  if (!items.length) return null;

  return (
    <section style={{ paddingBottom: 44 }}>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div style={{ display: "grid", gap: 10 }}>
        {items.map((item, index) => (
          <details
            key={`${item.left}-${index}`}
            style={{
              background: cardBg,
              border: `1px solid ${border}`,
              borderRadius: radius,
              padding: "14px 18px",
            }}
          >
            <summary style={{ cursor: "pointer", fontFamily: fonts.heading, fontWeight: 600, fontSize: 15 }}>
              {item.left}
            </summary>
            <p style={{ color: muted, marginTop: 10, fontSize: 14, lineHeight: 1.7 }}>{item.right}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function BlogSection({ settings, context }: SectionProps) {
  const { fonts, muted, cardBg, border, radius } = storefrontTokens(context.theme);
  const columns = num(settings, "columns", 3);
  const items = context.pages.slice(0, num(settings, "limit", 3));
  if (!items.length) return null;

  return (
    <section style={{ paddingBottom: 44 }}>
      <SectionHeading title={str(settings, "title")} theme={context.theme} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(${Math.round(1100 / Math.max(1, columns))}px, 1fr))`,
          gap: 16,
        }}
      >
        {items.map((page) => {
          const inner = (
            <>
              <div style={{ fontFamily: fonts.heading, fontWeight: 600, fontSize: 16 }}>{page.title}</div>
              {page.excerpt ? (
                <p style={{ color: muted, fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>{page.excerpt}</p>
              ) : null}
            </>
          );
          const shell = {
            background: cardBg,
            border: `1px solid ${border}`,
            borderRadius: radius,
            padding: 18,
            textDecoration: "none",
            color: "inherit",
            display: "block",
          } as const;
          return context.preview ? (
            <div key={page.slug} style={shell}>
              {inner}
            </div>
          ) : (
            <Link
              key={page.slug}
              to="/s/$slug/page/$pageSlug"
              params={{ slug: context.storeSlug, pageSlug: page.slug }}
              style={shell}
            >
              {inner}
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function NewsletterSection({ settings, context }: SectionProps) {
  const { t, fonts, muted, border, radius, cardBg } = storefrontTokens(context.theme);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  return (
    <section
      style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: radius,
        padding: "28px 26px",
        marginBottom: 48,
      }}
    >
      <h2 style={{ fontFamily: fonts.heading, fontSize: 22, margin: 0 }}>{str(settings, "title")}</h2>
      <p style={{ color: muted, marginTop: 8, fontSize: 15 }}>{str(settings, "text")}</p>
      {done ? (
        <p style={{ marginTop: 16, color: t.accent_color, fontSize: 14 }}>{str(settings, "successMessage")}</p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!email.includes("@")) return;
            setDone(true);
          }}
          style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="eposta@ornek.com"
            aria-label="E-posta adresi"
            style={{
              flex: "1 1 220px",
              background: "transparent",
              color: "inherit",
              border: `1px solid ${border}`,
              borderRadius: radius,
              padding: "11px 14px",
              fontSize: 14,
              fontFamily: "inherit",
            }}
          />
          <button
            type="submit"
            style={{
              background: t.accent_color,
              color: "#12181f",
              border: "none",
              borderRadius: radius,
              padding: "11px 22px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {str(settings, "buttonLabel")}
          </button>
        </form>
      )}
    </section>
  );
}

function CustomHtmlSection({ settings }: { settings: SectionSettings }) {
  const maxWidth = Number(settings["maxWidth"]) || undefined;
  const html = useMemo(() => sanitizeHtml(String(settings["html"] ?? "")), [settings]);
  return (
    <section style={{ paddingBottom: 44, maxWidth, marginInline: maxWidth ? "auto" : undefined }}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  );
}
