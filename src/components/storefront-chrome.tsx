import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { useCart } from "@/lib/cart";
import { useCompare } from "@/lib/compare";
import { useFavorites } from "@/lib/favorites";
import { storefrontMenuQuery, type MenuItem } from "@/lib/menus-queries";
import { fontStack } from "@/lib/theme-presets";

/** Menü bağlantısını vitrin adresine çevirir. */
export function menuHref(slug: string, item: Pick<MenuItem, "kind" | "target">) {
  const base = `/s/${slug}`;
  const target = item.target?.trim() ?? "";
  switch (item.kind) {
    case "home":
      return base;
    case "cart":
      return `${base}/cart`;
    case "account":
      return `${base}/account`;
    case "collection":
      return `${base}/c/${target}`;
    case "page":
      return `${base}/page/${target}`;
    case "product":
      return `${base}/p/${target}`;
    default:
      return target.startsWith("http") ? target : `${base}${target.startsWith("/") ? target : `/${target}`}`;
  }
}


export type StoreTheme = {
  primary_color: string;
  accent_color: string;
  background_color: string;
  font_pair: string;
  radius: number;
  layout: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta_label: string;
  announcement: string | null;
  show_announcement: boolean;
} | null;

export const FALLBACK_THEME = {
  primary_color: "#1f2933",
  accent_color: "#e0a136",
  background_color: "#fbf9f5",
  font_pair: "sora-manrope",
  radius: 0.75,
  layout: "hero-grid",
  hero_title: "Yeni sezon burada",
  hero_subtitle: "Seçilmiş ürünler, hızlı teslimat.",
  hero_cta_label: "Alışverişe başla",
  announcement: null,
  show_announcement: false,
};

export function isDark(hex: string) {
  const value = hex.replace("#", "");
  if (value.length !== 6) return false;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

export function storefrontTokens(theme: StoreTheme) {
  const t = theme ?? FALLBACK_THEME;
  const dark = isDark(t.background_color);
  const fonts = fontStack(t.font_pair);
  return {
    t,
    fonts,
    dark,
    text: dark ? "#f8fafc" : t.primary_color,
    muted: dark ? "rgba(248,250,252,.72)" : "rgba(31,41,51,.68)",
    cardBg: dark ? "rgba(255,255,255,.06)" : "#ffffff",
    border: dark ? "rgba(255,255,255,.12)" : "rgba(31,41,51,.10)",
    radius: `${t.radius}rem`,
  };
}

/** Kiracıya özel tema ile render edilen vitrin kabuğu (panel temasından bağımsız). */
export function StorefrontChrome({
  theme,
  storeName,
  storeSlug,
  footerPages,
  sections,
  customCss,
  customJs,
  children,
}: {
  theme: StoreTheme;
  storeName: string;
  storeSlug: string;
  footerPages?: { title: string; slug: string }[];
  /** Modüler tema bileşenleri (header/footer/duyuru çubuğu ayarları buradan okunur). */
  sections?: ResolvedSection[] | undefined;
  customCss?: string | null | undefined;
  customJs?: string | null | undefined;
  children: ReactNode;
}) {
  const { t, fonts, text, muted, border, radius } = storefrontTokens(theme);
  const cart = useCart();
  const favorites = useFavorites();
  const compare = useCompare();
  const { data: menuItems } = useQuery(storefrontMenuQuery(storeSlug));
  const headerItems = (menuItems ?? []).filter((item) => item.location === "header");
  const footerItems = (menuItems ?? []).filter((item) => item.location === "footer");

  const cartCount = cart.countFor(storeSlug);
  const favoriteCount = favorites.countFor(storeSlug);
  const compareCount = compare.countFor(storeSlug);

  const chrome = (type: string) =>
    (sections ?? []).find((section) => section.type === type && section.isEnabled)?.settings ?? null;
  const headerCfg = chrome("header");
  const footerCfg = chrome("footer");
  const barCfg = chrome("announcement_bar");

  const flag = (settings: Record<string, string | number | boolean> | null, key: string, fallback = true) =>
    settings ? Boolean(settings[key]) : fallback;
  const value = (settings: Record<string, string | number | boolean> | null, key: string) =>
    settings ? String(settings[key] ?? "") : "";

  const barText = barCfg ? value(barCfg, "text") : t.show_announcement ? (t.announcement ?? "") : "";
  const barTone = barCfg ? value(barCfg, "tone") : "primary";
  const barBackground =
    barTone === "accent" ? t.accent_color : barTone === "soft" ? `${t.accent_color}22` : t.primary_color;

  // Özel JavaScript, mağaza sahibinin bilinçli tercihidir; yalnızca istemcide çalışır.
  useEffect(() => {
    if (!customJs?.trim()) return;
    const element = document.createElement("script");
    element.type = "text/javascript";
    element.text = customJs;
    document.body.appendChild(element);
    return () => {
      element.remove();
    };
  }, [customJs]);

  return (
    <div
      style={{
        background: t.background_color,
        color: text,
        fontFamily: fonts.body,
        minHeight: "100vh",
      }}
    >
      {customCss?.trim() ? <style dangerouslySetInnerHTML={{ __html: customCss }} /> : null}

      {barText ? (
        <div
          style={{
            background: barBackground,
            color: barTone === "soft" ? text : "#fff",
            fontSize: 12,
            letterSpacing: ".04em",
            textAlign: "center",
            padding: "10px 16px",
          }}
        >
          {barText}
          {barCfg && value(barCfg, "linkLabel") && value(barCfg, "linkUrl") ? (
            <>
              {" "}
              <a href={value(barCfg, "linkUrl")} style={{ color: "inherit", textDecoration: "underline" }}>
                {value(barCfg, "linkLabel")}
              </a>
            </>
          ) : null}
        </div>
      ) : null}


      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 24px",
          borderBottom: `1px solid ${border}`,
          maxWidth: 1140,
          margin: "0 auto",
        }}
      >
        <Link
          to="/s/$slug"
          params={{ slug: storeSlug }}
          style={{ fontFamily: fonts.heading, fontWeight: 700, fontSize: 20, color: text, textDecoration: "none" }}
        >
          {storeName}
        </Link>
        <nav style={{ display: "flex", gap: 18, fontSize: 13, color: muted }}>
          {headerItems.length ? (
            headerItems.map((item) => (
              <a
                key={item.id}
                href={menuHref(storeSlug, item)}
                style={{ color: muted, textDecoration: "none" }}
              >
                {item.label}
              </a>
            ))
          ) : (
            <>
              <Link
                to="/s/$slug/products"
                params={{ slug: storeSlug }}
                style={{ color: muted, textDecoration: "none" }}
              >
                Ürünler
              </Link>
              <Link
                to="/s/$slug/categories"
                params={{ slug: storeSlug }}
                style={{ color: muted, textDecoration: "none" }}
              >
                Kategoriler
              </Link>
              <Link
                to="/s/$slug/collections"
                params={{ slug: storeSlug }}
                style={{ color: muted, textDecoration: "none" }}
              >
                Koleksiyonlar
              </Link>
              <Link
                to="/s/$slug/blog"
                params={{ slug: storeSlug }}
                style={{ color: muted, textDecoration: "none" }}
              >
                Blog
              </Link>
              <Link
                to="/s/$slug/orders"
                params={{ slug: storeSlug }}
                style={{ color: muted, textDecoration: "none" }}
              >
                Siparişlerim
              </Link>
              <Link
                to="/s/$slug/account"
                params={{ slug: storeSlug }}
                style={{ color: muted, textDecoration: "none" }}
              >
                Hesabım
              </Link>

            </>
          )}

          <Link
            to="/s/$slug/search"
            params={{ slug: storeSlug }}
            style={{ color: muted, textDecoration: "none" }}
          >
            Arama
          </Link>

          <Link
            to="/s/$slug/favorites"
            params={{ slug: storeSlug }}
            style={{ color: muted, textDecoration: "none" }}
          >
            Favoriler{favoriteCount ? ` (${favoriteCount})` : ""}
          </Link>


          <Link
            to="/s/$slug/gift-card"
            params={{ slug: storeSlug }}
            style={{ color: muted, textDecoration: "none" }}
          >
            Hediye kartı
          </Link>



          {compareCount > 0 ? (
            <Link
              to="/s/$slug/compare"
              params={{ slug: storeSlug }}
              style={{ color: muted, textDecoration: "none" }}
            >
              Karşılaştır ({compareCount})
            </Link>
          ) : null}

          <Link
            to="/s/$slug/cart"
            params={{ slug: storeSlug }}
            style={{
              color: text,
              textDecoration: "none",
              border: `1px solid ${border}`,
              borderRadius: radius,
              padding: "5px 12px",
              fontWeight: 600,
            }}
          >
            Sepet{cartCount ? ` (${cartCount})` : ""}
          </Link>
        </nav>
      </header>

      <main style={{ maxWidth: 1140, margin: "0 auto", padding: "0 24px 64px" }}>{children}</main>

      <footer
        style={{
          borderTop: `1px solid ${border}`,
          padding: "24px",
          textAlign: "center",
          fontSize: 12,
          color: muted,
        }}
      >
        {footerItems.length || footerPages?.length ? (
          <nav
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            {footerItems.map((item) => (
              <a
                key={item.id}
                href={menuHref(storeSlug, item)}
                style={{ color: muted, textDecoration: "none" }}
              >
                {item.label}
              </a>
            ))}
            {footerPages?.map((page) => (
              <Link
                key={page.slug}
                to="/s/$slug/page/$pageSlug"
                params={{ slug: storeSlug, pageSlug: page.slug }}
                style={{ color: muted, textDecoration: "none" }}
              >
                {page.title}
              </Link>
            ))}
          </nav>
        ) : null}

        <nav
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "center",
            marginBottom: 14,
          }}
        >
          {[
            { to: "/s/$slug/about", label: "Hakkımızda" },
            { to: "/s/$slug/contact", label: "İletişim" },
            { to: "/s/$slug/faq", label: "SSS" },
            { to: "/s/$slug/returns", label: "İade politikası" },
            { to: "/s/$slug/privacy", label: "Gizlilik politikası" },
            { to: "/s/$slug/terms", label: "Kullanım şartları" },
          ].map((link) => (
            <Link
              key={link.label}
              to={link.to as "/s/$slug/about"}
              params={{ slug: storeSlug }}
              style={{ color: muted, textDecoration: "none" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {storeName} — Mefticaret altyapısıyla çalışır.
      </footer>

    </div>
  );
}
