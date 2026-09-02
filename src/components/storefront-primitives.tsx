import { Link } from "@tanstack/react-router";

import { FavoriteButton } from "@/components/favorite-button";
import { QuickAddButton } from "@/components/quick-add-button";
import { buttonStyles, cardStyles, storefrontTokens, type StoreTheme } from "@/components/storefront-chrome";
import { formatMoney } from "@/lib/mefti";
import type { SectionSettings } from "@/lib/theme-sections";

/** Tema bloklarının paylaştığı tipler ve görsel primitifler. */

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
  /** Editör önizlemesinde bağlantılar pasifleştirilir. */
  preview?: boolean | undefined;
};

export type SectionProps = { settings: SectionSettings; context: SectionContext };

export const str = (settings: SectionSettings, key: string) => String(settings[key] ?? "");
export const num = (settings: SectionSettings, key: string, fallback: number) => {
  const value = Number(settings[key]);
  return Number.isFinite(value) ? value : fallback;
};
export const bool = (settings: SectionSettings, key: string) => Boolean(settings[key]);

/** Ürün tipi veya etiket filtresi uygular. */
export function filterProducts(products: SectionProduct[], filter: string, limit: number) {
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

/** Izgara kolon şablonu üretir. */
export function gridColumns(columns: number, min = 1100) {
  return `repeat(auto-fit, minmax(${Math.round(min / Math.max(1, columns))}px, 1fr))`;
}

/** "a | b | c" satırlarını parçalara böler. */
export function parseRows(value: unknown, parts: number): string[][] {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cells = line.split("|").map((cell) => cell.trim());
      return Array.from({ length: parts }, (_unused, index) => cells[index] ?? "");
    });
}

export function SectionHeading({ title, theme }: { title: string; theme: StoreTheme }) {
  const { fonts } = storefrontTokens(theme);
  if (!title.trim()) return null;
  return <h2 style={{ fontFamily: fonts.heading, fontSize: 24, margin: "0 0 18px" }}>{title}</h2>;
}

export function Cta({
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

export function ProductCard({
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

/** Ürünleri ızgara veya kaydırmalı şerit olarak listeler. */
export function ProductCollectionView({
  items,
  context,
  layout = "grid",
  columns = 4,
  cardWidth = 220,
  showPrice = true,
}: {
  items: SectionProduct[];
  context: SectionContext;
  layout?: "grid" | "slider";
  columns?: number;
  cardWidth?: number;
  showPrice?: boolean;
}) {
  const { muted } = storefrontTokens(context.theme);
  if (!items.length) return <p style={{ color: muted }}>Gösterilecek ürün bulunamadı.</p>;

  if (layout === "slider") {
    return (
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 10, scrollSnapType: "x mandatory" }}>
        {items.map((product) => (
          <div key={product.id} style={{ scrollSnapAlign: "start" }}>
            <ProductCard product={product} context={context} width={cardWidth} showPrice={showPrice} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: gridColumns(columns), gap: 18 }}>
      {items.map((product) => (
        <ProductCard key={product.id} product={product} context={context} showPrice={showPrice} />
      ))}
    </div>
  );
}
