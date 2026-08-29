import { fontStack } from "@/lib/theme-presets";
import { formatCurrency } from "@/lib/mefti";

export type ThemeDraft = {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fontPair: string;
  radius: number;
  layout: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaLabel: string;
  announcement: string;
  showAnnouncement: boolean;
};

type PreviewProduct = { id: string; title: string; base_price: number; currency: string };

function isDark(hex: string) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return false;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

/**
 * Vitrin canlı önizlemesi. Tema token'ları inline style ile uygulanır çünkü
 * bu bileşen panel temasından bağımsız, kiracıya özel tema render eder.
 */
export function StorefrontPreview({
  theme,
  storeName,
  products,
}: {
  theme: ThemeDraft;
  storeName: string;
  products: PreviewProduct[];
}) {
  const fonts = fontStack(theme.fontPair);
  const dark = isDark(theme.backgroundColor);
  const text = dark ? "#f8fafc" : theme.primaryColor;
  const muted = dark ? "rgba(248,250,252,.72)" : "rgba(31,41,51,.68)";
  const cardBg = dark ? "rgba(255,255,255,.06)" : "#ffffff";
  const border = dark ? "rgba(255,255,255,.12)" : "rgba(31,41,51,.10)";
  const radius = `${theme.radius}rem`;
  const split = theme.layout === "split-screen";
  const columns =
    theme.layout === "magazine" ? "repeat(2, minmax(0,1fr))" : "repeat(3, minmax(0,1fr))";

  return (
    <div
      aria-label="Vitrin önizlemesi"
      style={{
        background: theme.backgroundColor,
        color: text,
        fontFamily: fonts.body,
        borderRadius: radius,
        border: `1px solid ${border}`,
        overflow: "hidden",
      }}
    >
      {theme.showAnnouncement && theme.announcement ? (
        <div
          style={{
            background: theme.primaryColor,
            color: "#fff",
            fontSize: 12,
            letterSpacing: ".04em",
            textAlign: "center",
            padding: "8px 12px",
          }}
        >
          {theme.announcement}
        </div>
      ) : null}

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: `1px solid ${border}`,
        }}
      >
        <span style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 18 }}>{storeName}</span>
        <nav style={{ display: "flex", gap: 16, fontSize: 13, color: muted }}>
          <span>Ürünler</span>
          <span>Koleksiyonlar</span>
          <span>İletişim</span>
        </nav>
      </header>

      <section
        style={{
          display: split ? "grid" : "block",
          gridTemplateColumns: split ? "1.1fr .9fr" : undefined,
          gap: 20,
          padding: "32px 20px",
        }}
      >
        <div style={{ maxWidth: split ? undefined : 520 }}>
          <h2
            style={{
              fontFamily: fonts.heading,
              fontSize: 30,
              lineHeight: 1.1,
              fontWeight: 700,
              margin: 0,
            }}
          >
            {theme.heroTitle}
          </h2>
          <p style={{ color: muted, marginTop: 12, fontSize: 14 }}>{theme.heroSubtitle}</p>
          <span
            style={{
              display: "inline-block",
              marginTop: 20,
              background: theme.accentColor,
              color: isDark(theme.accentColor) ? "#fff" : "#12181f",
              padding: "10px 18px",
              borderRadius: radius,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {theme.heroCtaLabel}
          </span>
        </div>
        {split ? (
          <div
            style={{
              background: `linear-gradient(140deg, ${theme.primaryColor}, ${theme.accentColor})`,
              borderRadius: radius,
              minHeight: 160,
            }}
          />
        ) : null}
      </section>

      <section style={{ padding: "0 20px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: columns, gap: 14 }}>
          {(products.length
            ? products
            : [
                { id: "a", title: "Örnek Ürün", base_price: 1290, currency: "TRY" },
                { id: "b", title: "Örnek Ürün 2", base_price: 890, currency: "TRY" },
                { id: "c", title: "Örnek Ürün 3", base_price: 2490, currency: "TRY" },
              ]
          )
            .slice(0, 6)
            .map((product) => (
              <article
                key={product.id}
                style={{
                  background: cardBg,
                  border: `1px solid ${border}`,
                  borderRadius: radius,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: 96,
                    background: `linear-gradient(160deg, ${theme.accentColor}33, ${theme.primaryColor}22)`,
                  }}
                />
                <div style={{ padding: 12 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{product.title}</p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: muted }}>
                    {formatCurrency(Number(product.base_price), product.currency)}
                  </p>
                </div>
              </article>
            ))}
        </div>
      </section>

      <footer
        style={{
          borderTop: `1px solid ${border}`,
          padding: "14px 20px",
          fontSize: 12,
          color: muted,
        }}
      >
        © {new Date().getFullYear()} {storeName} — Mefticaret altyapısı
      </footer>
    </div>
  );
}
