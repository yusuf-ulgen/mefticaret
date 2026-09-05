import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteKitScripts } from "@/components/site-kit-scripts";
import { CookieConsent } from "@/components/cookie-consent";

import { useCart } from "@/lib/cart";
import { useCompare } from "@/lib/compare";
import { useFavorites } from "@/lib/favorites";
import { formatMoney } from "@/lib/mefti";
import { storefrontMenuQuery, type MenuItem } from "@/lib/menus-queries";
import { LanguageSwitcher } from "@/components/storefront-language";

import type { StorefrontCommerce } from "@/lib/storefront-commerce";
import { fontStack } from "@/lib/theme-presets";
import { designCss, resolveDesignTokens } from "@/lib/theme-design";
import { trackEvent } from "@/lib/track";
import type { ResolvedSection } from "@/lib/theme-sections";


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
  logo_url?: string | null;
  button_style?: string | null;
  card_style?: string | null;
  content_width?: number | null;
  section_spacing?: number | null;
  /** Tasarım sistemi tokenları (renk/tipografi/boşluk/hareket). */
  design_tokens?: unknown;
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
  logo_url: null,
  button_style: "solid",
  card_style: "soft",
  content_width: 1140,
  section_spacing: 48,
  design_tokens: {},
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
  const design = resolveDesignTokens((t as { design_tokens?: unknown }).design_tokens);
  return {
    t,
    fonts,
    dark,
    design,
    text: dark ? "#f8fafc" : t.primary_color,
    muted: dark ? "rgba(248,250,252,.72)" : "rgba(31,41,51,.68)",
    cardBg: dark ? "rgba(255,255,255,.06)" : "#ffffff",
    border: dark ? "rgba(255,255,255,.12)" : "rgba(31,41,51,.10)",
    radius: `${t.radius}rem`,
    logoUrl: t.logo_url ?? null,
    buttonStyle: t.button_style ?? "solid",
    cardStyle: t.card_style ?? "soft",
    contentWidth: Number(t.content_width ?? 1140),
    sectionSpacing: Number(t.section_spacing ?? 48),
  };
}

/** Buton stiline göre inline stil üretir (solid / outline / pill / ghost). */
export function buttonStyles(theme: StoreTheme): Record<string, string | number> {
  const { t, buttonStyle, radius, text } = storefrontTokens(theme);
  const base = {
    display: "inline-block",
    padding: "12px 22px",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
    borderRadius: buttonStyle === "pill" ? "999px" : buttonStyle === "square" ? "0px" : radius,
  } as Record<string, string | number>;
  if (buttonStyle === "outline") {
    return { ...base, background: "transparent", color: text, border: `1.5px solid ${t.accent_color}` };
  }
  if (buttonStyle === "ghost") {
    return { ...base, background: `${t.accent_color}1f`, color: text, border: "1px solid transparent" };
  }
  return {
    ...base,
    background: t.accent_color,
    color: isDark(t.accent_color) ? "#ffffff" : "#12181f",
    border: "1px solid transparent",
  };
}

/** Ürün kartı stiline göre inline stil üretir (soft / bordered / flat / shadow). */
export function cardStyles(theme: StoreTheme): Record<string, string | number> {
  const { cardBg, border, radius, cardStyle } = storefrontTokens(theme);
  if (cardStyle === "flat") {
    return { background: "transparent", border: "1px solid transparent", borderRadius: radius, padding: 4 };
  }
  if (cardStyle === "bordered") {
    return { background: "transparent", border: `1.5px solid ${border}`, borderRadius: radius, padding: 16 };
  }
  if (cardStyle === "shadow") {
    return {
      background: cardBg,
      border: "1px solid transparent",
      borderRadius: radius,
      padding: 16,
      boxShadow: "0 18px 40px -24px rgba(15,23,42,.45)",
    };
  }
  return { background: cardBg, border: `1px solid ${border}`, borderRadius: radius, padding: 16 };
}

/** Kiracıya özel tema ile render edilen vitrin kabuğu (panel temasından bağımsız). */
export function StorefrontChrome({
  theme,
  storeName,
  storeSlug,
  footerPages,
  commerce,
  sections,
  customCss,
  customJs,
  children,
}: {
  theme: StoreTheme;
  storeName: string;
  storeSlug: string;
  footerPages?: { title: string; slug: string }[];
  /** Mağazanın gerçek kargo/ödeme verisi; footer bilgi şeridinde gösterilir. */
  commerce?: StorefrontCommerce | undefined;
  /** Modüler tema bileşenleri (header/footer/duyuru çubuğu ayarları buradan okunur). */
  sections?: ResolvedSection[] | undefined;
  customCss?: string | null | undefined;
  customJs?: string | null | undefined;
  children: ReactNode;
}) {
  const { t, fonts, text, muted, border, radius, logoUrl, contentWidth, design } = storefrontTokens(theme);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
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

  // Analitik: her vitrin sayfası görüntülemesini ziyaretçi/oturum bazında kaydet.
  useEffect(() => {
    trackEvent(storeSlug, "page_view", { path: pathname });
  }, [storeSlug, pathname]);

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
      className="sf-root"
      style={{
        background: t.background_color,
        color: text,
        fontFamily: fonts.body,
        minHeight: "100vh",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: designCss(design) }} />
      {customCss?.trim() ? <style dangerouslySetInnerHTML={{ __html: customCss }} /> : null}
      <CookieConsent storeSlug={storeSlug} />
      <SiteKitScripts storeSlug={storeSlug} />

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
        className="sf-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 24px",
          borderBottom: `1px solid ${border}`,
          maxWidth: contentWidth,
          margin: "0 auto",
          position: flag(headerCfg, "sticky", false) ? "sticky" : undefined,
          top: flag(headerCfg, "sticky", false) ? 0 : undefined,
          zIndex: flag(headerCfg, "sticky", false) ? 20 : undefined,
          background: flag(headerCfg, "sticky", false) ? t.background_color : undefined,
        }}
      >
        <div>
          <Link
            to="/s/$slug"
            params={{ slug: storeSlug }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontFamily: fonts.heading,
              fontWeight: 700,
              fontSize: 20,
              color: text,
              textDecoration: "none",
            }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt={storeName} style={{ height: 34, width: "auto", display: "block" }} />
            ) : null}
            {storeName}
          </Link>
          {value(headerCfg, "tagline") ? (
            <div style={{ color: muted, fontSize: 12, marginTop: 2 }}>{value(headerCfg, "tagline")}</div>
          ) : null}
        </div>
        <nav className="sf-header-nav" style={{ display: "flex", gap: 18, fontSize: 13, color: muted }}>
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

          {flag(headerCfg, "showSearch") ? (
            <Link
              to="/s/$slug/search"
              params={{ slug: storeSlug }}
              style={{ color: muted, textDecoration: "none" }}
            >
              Arama
            </Link>
          ) : null}

          {flag(headerCfg, "showFavorites") ? (
            <Link
              to="/s/$slug/favorites"
              params={{ slug: storeSlug }}
              style={{ color: muted, textDecoration: "none" }}
            >
              Favoriler{favoriteCount ? ` (${favoriteCount})` : ""}
            </Link>
          ) : null}


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

          {flag(headerCfg, "showCart") ? (
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
          ) : null}

          <LanguageSwitcher storeSlug={storeSlug} color={muted} />
        </nav>

      </header>

      <main className="sf-main" style={{ maxWidth: contentWidth, margin: "0 auto", padding: "0 24px 64px" }}>
        {children}
      </main>

      <footer
        style={{
          borderTop: `1px solid ${border}`,
          padding: "24px",
          textAlign: "center",
          fontSize: 12,
          color: muted,
        }}
      >
        {value(footerCfg, "about") ? (
          <p style={{ maxWidth: 620, margin: "0 auto 14px", fontSize: 13, lineHeight: 1.7 }}>
            {value(footerCfg, "about")}
          </p>
        ) : null}

        {value(footerCfg, "email") || value(footerCfg, "phone") ? (
          <div style={{ marginBottom: 14, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {value(footerCfg, "email") ? <span>{value(footerCfg, "email")}</span> : null}
            {value(footerCfg, "phone") ? <span>{value(footerCfg, "phone")}</span> : null}
          </div>
        ) : null}

        {flag(footerCfg, "showPages") && (footerItems.length || footerPages?.length) ? (
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

        {flag(footerCfg, "showLegalLinks") ? (
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
        ) : null}

        {commerce && (commerce.payments.length || commerce.shipping.length) ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              justifyContent: "center",
              marginBottom: 14,
              fontSize: 13,
              color: muted,
            }}
          >
            {commerce.payments.map((payment) => (
              <span
                key={payment.displayName}
                style={{ border: `1px solid ${border}`, borderRadius: 999, padding: "4px 12px" }}
              >
                {payment.displayName}
              </span>
            ))}
            {commerce.freeShippingThreshold ? (
              <span style={{ border: `1px solid ${border}`, borderRadius: 999, padding: "4px 12px" }}>
                {formatMoney(commerce.freeShippingThreshold, commerce.currency)} üzeri ücretsiz kargo
              </span>
            ) : null}
            {commerce.fastestEtaDays ? (
              <span style={{ border: `1px solid ${border}`, borderRadius: 999, padding: "4px 12px" }}>
                {commerce.fastestEtaDays} iş günü teslim
              </span>
            ) : null}
          </div>
        ) : null}

        {value(footerCfg, "copyright") || `${storeName} — Mefticaret altyapısıyla çalışır.`}
      </footer>

    </div>
  );
}
