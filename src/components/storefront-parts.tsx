import { Link } from "@tanstack/react-router";

import { FavoriteButton } from "@/components/favorite-button";
import { QuickAddButton } from "@/components/quick-add-button";
import { SmartImage } from "@/components/smart-image";
import { storefrontTokens, type StoreTheme } from "@/components/storefront-chrome";
import { formatMoney } from "@/lib/display-currency";

export type StorefrontCard = {
  id: string;
  title: string;
  slug: string;
  base_price: number | string;
  compare_at_price?: number | string | null;
  currency?: string | null;
  product_type?: string | null;
  tags?: string[] | null;
  coverUrl?: string | null;
};

/** Vitrin sayfalarında ortak hata/boş durum ekranı. */
export function StorefrontFallback({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">{text}</h1>
      <Link to="/" className="text-sm underline">
        Mefticaret ana sayfası
      </Link>
    </div>
  );
}

/** Vitrin ürün kartı ızgarası (favori + hızlı ekle dahil). */
export function ProductGrid({
  theme,
  slug,
  storeCurrency,
  products,
  empty = "Ürün bulunamadı.",
}: {
  theme: StoreTheme;
  slug: string;
  storeCurrency: string;
  products: StorefrontCard[];
  empty?: string;
}) {
  const { t, muted, cardBg, border, radius } = storefrontTokens(theme);

  if (!products.length) {
    return <p style={{ color: muted, paddingBottom: 60 }}>{empty}</p>;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 18,
        paddingBottom: 64,
      }}
    >
      {products.map((product) => (
        <Link
          key={product.id}
          to="/s/$slug/p/$productSlug"
          params={{ slug, productSlug: product.slug }}
          style={{
            background: cardBg,
            border: `1px solid ${border}`,
            borderRadius: radius,
            overflow: "hidden",
            textDecoration: "none",
            color: "inherit",
            display: "block",
            position: "relative",
          }}
        >
          <FavoriteButton
            item={{
              storeSlug: slug,
              productSlug: product.slug,
              title: product.title,
              price: Number(product.base_price),
              currency: product.currency ?? storeCurrency,
              image: product.coverUrl ?? null,
            }}
            border={border}
            cardBg={cardBg}
            accent={t.accent_color}
            muted={muted}
          />
          <div style={{ aspectRatio: "1 / 1", background: border, overflow: "hidden" }}>
            <SmartImage
              src={product.coverUrl}
              alt={product.title}
              width={480}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          <div style={{ padding: 14 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>{product.title}</p>
            <p style={{ margin: "6px 0 0", color: muted, fontSize: 14 }}>
              {formatMoney(Number(product.base_price), product.currency ?? storeCurrency)}
            </p>
            <QuickAddButton storeSlug={slug} productSlug={product.slug} accent={t.accent_color} />
          </div>
        </Link>
      ))}
    </div>
  );
}

/** Bilgi/politika sayfaları için başlık + metin blokları. */
export function InfoSections({
  theme,
  title,
  intro,
  sections,
}: {
  theme: StoreTheme;
  title: string;
  intro?: string;
  sections: { heading: string; body: string }[];
}) {
  const { fonts, muted, cardBg, border, radius } = storefrontTokens(theme);
  return (
    <article style={{ padding: "36px 0 64px", maxWidth: 760 }}>
      <h1 style={{ fontFamily: fonts.heading, fontSize: 34, fontWeight: 700, margin: 0 }}>{title}</h1>
      {intro ? <p style={{ color: muted, marginTop: 12, fontSize: 15, lineHeight: 1.7 }}>{intro}</p> : null}
      <div style={{ display: "grid", gap: 14, marginTop: 26 }}>
        {sections.map((section) => (
          <section
            key={section.heading}
            style={{
              background: cardBg,
              border: `1px solid ${border}`,
              borderRadius: radius,
              padding: "16px 18px",
            }}
          >
            <h2 style={{ fontFamily: fonts.heading, fontSize: 17, fontWeight: 600, margin: 0 }}>{section.heading}</h2>
            <p style={{ color: muted, margin: "8px 0 0", fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-line" }}>
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </article>
  );
}

/** Vitrin içi kırıntı navigasyonu. */
export function Breadcrumb({
  theme,
  slug,
  storeName,
  current,
}: {
  theme: StoreTheme;
  slug: string;
  storeName: string;
  current: string;
}) {
  const { muted } = storefrontTokens(theme);
  return (
    <nav style={{ marginTop: 28, fontSize: 13, color: muted }}>
      <Link to="/s/$slug" params={{ slug }} style={{ color: "inherit" }}>
        {storeName}
      </Link>
      {" / "}
      <span>{current}</span>
    </nav>
  );
}
