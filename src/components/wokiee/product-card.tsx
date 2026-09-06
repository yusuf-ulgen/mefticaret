import { useState } from "react";
import { Link } from "@tanstack/react-router";

import { FavoriteButton } from "@/components/favorite-button";
import { isDark, storefrontTokens, type StoreTheme } from "@/components/storefront-chrome";
import { useCompare } from "@/lib/compare";
import { formatMoney } from "@/lib/mefti";
import { storefrontUI } from "@/lib/storefront-ui";
import { useCart } from "@/lib/cart";
import { getQuickAddVariant } from "@/lib/storefront.functions";
import { toast } from "sonner";

/** Wokiee vitrin kartının beklediği ürün alanları (getStorefront çıktısıyla uyumlu). */
export type WokieeProduct = {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  base_price: number | string;
  compare_at_price?: number | string | null;
  currency: string;
  product_type?: string | null;
  tags?: string[] | null;
  coverUrl?: string | null;
  livePrice?: number | null;
  stockTotal?: number | null;
  variantCount?: number | null;
};

/** Etiketlerden renk dairesi üretmek için Türkçe renk sözlüğü. */
const COLOR_MAP: Record<string, string> = {
  siyah: "#111111",
  beyaz: "#f5f5f5",
  kirmizi: "#d92d20",
  kırmızı: "#d92d20",
  mavi: "#1d4ed8",
  lacivert: "#1e293b",
  yesil: "#15803d",
  yeşil: "#15803d",
  sari: "#eab308",
  sarı: "#eab308",
  turuncu: "#ea580c",
  gri: "#9ca3af",
  bej: "#e7d8c1",
  kahve: "#78350f",
  pembe: "#ec4899",
  mor: "#7c3aed",
  krem: "#f3ead6",
  bordo: "#7f1d1d",
  altin: "#d4af37",
  altın: "#d4af37",
  gumus: "#c0c0c0",
  gümüş: "#c0c0c0",
};

export function productSwatches(tags: string[] | null | undefined) {
  return (tags ?? [])
    .map((tag) => ({ tag, hex: COLOR_MAP[tag.trim().toLocaleLowerCase("tr")] }))
    .filter((entry): entry is { tag: string; hex: string } => Boolean(entry.hex))
    .slice(0, 5);
}

export function discountPercent(price: number, compareAt: number | null) {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** Wokiee tarzı ürün kartı: rozetler, hover efekti, renk daireleri, hızlı bakış ve hızlı sepet. */
export function WokieeProductCard({
  theme,
  storeSlug,
  product,
  view = "grid",
}: {
  theme: StoreTheme;
  storeSlug: string;
  product: WokieeProduct;
  view?: "grid" | "list";
}) {
  const { t, fonts, muted, cardBg, border, radius, dark } = storefrontTokens(theme);
  const compare = useCompare();
  const cart = useCart();
  const [hover, setHover] = useState(false);
  const [busy, setBusy] = useState(false);

  const price = Number(product.livePrice ?? product.base_price);
  const compareAt = product.compare_at_price ? Number(product.compare_at_price) : null;
  const off = discountPercent(price, compareAt);
  const soldOut = product.stockTotal !== null && product.stockTotal !== undefined && product.stockTotal <= 0;
  const swatches = productSwatches(product.tags);
  const selected = compare.isSelected(storeSlug, product.slug);
  const accentContrast = isDark(t.accent_color) ? "#ffffff" : "#101418";

  const chip = (label: string, background: string, color: string) => (
    <span
      key={label}
      style={{
        background,
        color,
        borderRadius: 999,
        padding: "3px 9px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".02em",
      }}
    >
      {label}
    </span>
  );

  async function quickAdd() {
    if (busy) return;
    setBusy(true);
    try {
      const variant = await getQuickAddVariant({ data: { slug: storeSlug, productSlug: product.slug } });
      if (!variant) return void toast.error("Ürün şu anda satın alınamıyor");
      if (variant.variantCount > 1) {
        storefrontUI.openQuickView(product.slug);
        return;
      }
      if (variant.stock <= 0) return void toast.error("Bu ürün tükendi");
      cart.add({
        storeSlug,
        variantId: variant.variantId,
        productSlug: variant.productSlug,
        title: variant.title,
        variantTitle: variant.variantTitle,
        price: variant.price,
        currency: variant.currency,
        maxStock: variant.stock,
      });
      storefrontUI.openCart();
    } catch {
      toast.error("Sepete eklenemedi, tekrar dene");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: radius,
        padding: 14,
        position: "relative",
        display: view === "list" ? "grid" : "block",
        gridTemplateColumns: view === "list" ? "minmax(0,160px) minmax(0,1fr)" : undefined,
        gap: view === "list" ? 16 : undefined,
        transition: "box-shadow .2s ease, transform .2s ease",
        boxShadow: hover ? "0 18px 40px -26px rgba(15,23,42,.5)" : "none",
      }}
    >
      <div style={{ position: "absolute", top: 18, left: 18, zIndex: 2, display: "flex", gap: 6 }}>
        {off ? chip(`-%${off}`, "#d92d20", "#fff") : null}
        {soldOut ? chip("Tükendi", "rgba(17,17,17,.82)", "#fff") : null}
      </div>

      <FavoriteButton
        item={{
          storeSlug,
          productSlug: product.slug,
          title: product.title,
          price,
          currency: product.currency,
          image: product.coverUrl ?? null,
        }}
        border={border}
        cardBg={cardBg}
        accent={t.accent_color}
        muted={muted}
      />

      <Link
        to="/s/$slug/p/$productSlug"
        params={{ slug: storeSlug, productSlug: product.slug }}
        style={{ display: "block", textDecoration: "none", color: "inherit" }}
      >
        <div
          style={{
            height: view === "list" ? 160 : 210,
            borderRadius: radius,
            overflow: "hidden",
            background: dark
              ? "linear-gradient(140deg, rgba(255,255,255,.12), rgba(255,255,255,.03))"
              : `linear-gradient(140deg, ${t.accent_color}22, ${t.primary_color}12)`,
            marginBottom: 12,
          }}
        >
          {product.coverUrl ? (
            <img
              src={product.coverUrl}
              alt={product.title}
              loading="lazy"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                transform: hover ? "scale(1.07)" : "scale(1)",
                transition: "transform .45s ease",
              }}
            />
          ) : null}
        </div>
      </Link>

      <div style={{ minWidth: 0 }}>
        {product.product_type ? (
          <div style={{ color: muted, fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em" }}>
            {product.product_type}
          </div>
        ) : null}
        <Link
          to="/s/$slug/p/$productSlug"
          params={{ slug: storeSlug, productSlug: product.slug }}
          style={{
            display: "block",
            marginTop: 4,
            fontFamily: fonts.heading,
            fontWeight: 600,
            fontSize: 15,
            color: "inherit",
            textDecoration: "none",
          }}
        >
          {product.title}
        </Link>

        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700 }}>{formatMoney(price, product.currency)}</span>
          {compareAt ? (
            <span style={{ color: muted, textDecoration: "line-through", fontSize: 13 }}>
              {formatMoney(compareAt, product.currency)}
            </span>
          ) : null}
        </div>

        {swatches.length ? (
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {swatches.map((swatch) => (
              <span
                key={swatch.tag}
                title={swatch.tag}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: swatch.hex,
                  border: `1px solid ${border}`,
                  display: "inline-block",
                }}
              />
            ))}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            type="button"
            onClick={quickAdd}
            disabled={busy || soldOut}
            style={{
              flex: 1,
              padding: "9px 12px",
              borderRadius: 10,
              border: "none",
              background: soldOut ? border : t.accent_color,
              color: soldOut ? muted : accentContrast,
              fontWeight: 600,
              fontSize: 13,
              cursor: soldOut ? "not-allowed" : busy ? "wait" : "pointer",
            }}
          >
            {soldOut ? "Tükendi" : busy ? "Ekleniyor…" : "Sepete ekle"}
          </button>
          <button
            type="button"
            onClick={() => storefrontUI.openQuickView(product.slug)}
            aria-label="Hızlı bakış"
            style={{
              padding: "9px 12px",
              borderRadius: 10,
              border: `1px solid ${border}`,
              background: "transparent",
              color: "inherit",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Hızlı bakış
          </button>
          <button
            type="button"
            aria-label="Karşılaştırmaya ekle"
            onClick={() => {
              const result = compare.toggle({ storeSlug, productSlug: product.slug });
              if (result === null) toast.info(`En fazla ${compare.limit} ürün karşılaştırılabilir`);
            }}
            style={{
              padding: "9px 11px",
              borderRadius: 10,
              border: `1px solid ${selected ? t.accent_color : border}`,
              background: selected ? `${t.accent_color}22` : "transparent",
              color: "inherit",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            ⇄
          </button>
        </div>
      </div>
    </div>
  );
}
