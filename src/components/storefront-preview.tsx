import { fontStack } from "@/lib/theme-presets";
import { formatMoney } from "@/lib/mefti";

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
  logoUrl?: string;
  buttonStyle?: string;
  cardStyle?: string;
  contentWidth?: number;
  sectionSpacing?: number;
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
  device = "desktop",
}: {
  theme: ThemeDraft;
  storeName: string;
  products: PreviewProduct[];
  device?: "desktop" | "tablet" | "mobile";
}) {
  const fonts = fontStack(theme.fontPair);
  const dark = isDark(theme.backgroundColor);
  const text = dark ? "#f8fafc" : theme.primaryColor;
  const muted = dark ? "rgba(248,250,252,.72)" : "rgba(31,41,51,.68)";
  const cardBg = dark ? "rgba(255,255,255,.06)" : "#ffffff";
  const border = dark ? "rgba(255,255,255,.12)" : "rgba(31,41,51,.10)";
  const radius = `${theme.radius}rem`;
  const split = theme.layout === "split-screen" && device === "desktop";
  const gridCount = device === "mobile" ? 1 : device === "tablet" ? 2 : theme.layout === "magazine" ? 2 : 3;
  const columns = `repeat(${gridCount}, minmax(0,1fr))`;
  const spacing = theme.sectionSpacing ?? 48;
  const buttonStyle = theme.buttonStyle ?? "solid";
  const cardStyle = theme.cardStyle ?? "soft";
  const buttonRadius = buttonStyle === "pill" ? "999px" : buttonStyle === "square" ? "0px" : radius;
  const buttonSkin =
    buttonStyle === "outline"
      ? { background: "transparent", color: text, border: `1.5px solid ${theme.accentColor}` }
      : buttonStyle === "ghost"
        ? { background: `${theme.accentColor}1f`, color: text, border: "1px solid transparent" }
        : {
            background: theme.accentColor,
            color: isDark(theme.accentColor) ? "#fff" : "#12181f",
            border: "1px solid transparent",
          };
  const cardSkin =
    cardStyle === "flat"
      ? { background: "transparent", border: "1px solid transparent" }
      : cardStyle === "bordered"
        ? { background: "transparent", border: `1.5px solid ${border}` }
        : cardStyle === "shadow"
          ? {
              background: cardBg,
              border: "1px solid transparent",
              boxShadow: "0 18px 40px -24px rgba(15,23,42,.45)",
            }
          : { background: cardBg, border: `1px solid ${border}` };

  return (
    <div
      aria-label="Vitrin önizlemesi"
      style={{
        background: theme.backgroundColor,
        color: text,
        fontFamily: fonts.body,
        borderRadius: radius,
        maxWidth: theme.contentWidth ? Math.min(theme.contentWidth, 2000) : undefined,
        marginInline: "auto",
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
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: fonts.heading,
            fontWeight: 700,
            fontSize: 18,
          }}
        >
          {theme.logoUrl ? (
            <img src={theme.logoUrl} alt={storeName} style={{ height: 26, width: "auto", display: "block" }} />
          ) : null}
          {storeName}
        </span>
        {device === "mobile" ? (
          <span style={{ fontSize: 18, color: muted }}>≡</span>
        ) : (
          <nav style={{ display: "flex", gap: 16, fontSize: 13, color: muted }}>
            <span>Ürünler</span>
            <span>Koleksiyonlar</span>
            <span>İletişim</span>
          </nav>
        )}
      </header>

      <section
        style={{
          display: split ? "grid" : "block",
          gridTemplateColumns: split ? "1.1fr .9fr" : undefined,
          gap: 20,
          padding: `${spacing}px 20px`,
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
              ...buttonSkin,
              padding: "10px 18px",
              borderRadius: buttonRadius,
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

      <section style={{ padding: `0 20px ${spacing}px` }}>
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
                style={{ ...cardSkin, borderRadius: radius, overflow: "hidden" }}
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
                    {formatMoney(Number(product.base_price), product.currency)}
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
