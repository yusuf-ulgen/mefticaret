import { Link } from "@tanstack/react-router";

import { storefrontTokens, type StoreTheme } from "@/components/storefront-chrome";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import { storefrontUI } from "@/lib/storefront-ui";

/** Mobilde uygulama hissi veren sabit alt gezinme barı. */
export function MobileBottomNav({ theme, storeSlug }: { theme: StoreTheme; storeSlug: string }) {
  const { t, muted, border } = storefrontTokens(theme);
  const cart = useCart();
  const favorites = useFavorites();
  const cartCount = cart.countFor(storeSlug);
  const favoriteCount = favorites.countFor(storeSlug);

  const itemStyle = {
    display: "grid",
    justifyItems: "center",
    gap: 2,
    fontSize: 10,
    color: muted,
    textDecoration: "none",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
  } as const;

  const badge = (count: number) =>
    count ? (
      <span
        style={{
          position: "absolute",
          top: 2,
          right: "50%",
          transform: "translateX(16px)",
          background: t.accent_color,
          color: "#101418",
          borderRadius: 999,
          fontSize: 9,
          fontWeight: 700,
          padding: "1px 5px",
        }}
      >
        {count}
      </span>
    ) : null;

  return (
    <nav
      className="sf-bottom-nav"
      aria-label="Mobil gezinme"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 70,
        display: "none",
        gridTemplateColumns: "repeat(5, 1fr)",
        alignItems: "center",
        padding: "8px 4px calc(8px + env(safe-area-inset-bottom))",
        background: t.background_color,
        borderTop: `1px solid ${border}`,
      }}
    >
      <Link to="/s/$slug" params={{ slug: storeSlug }} style={itemStyle}>
        <span style={{ fontSize: 17 }}>⌂</span>
        Ana sayfa
      </Link>
      <Link to="/s/$slug/categories" params={{ slug: storeSlug }} style={itemStyle}>
        <span style={{ fontSize: 17 }}>☰</span>
        Kategoriler
      </Link>
      <Link to="/s/$slug/search" params={{ slug: storeSlug }} style={itemStyle}>
        <span style={{ fontSize: 17 }}>⌕</span>
        Ara
      </Link>
      <Link to="/s/$slug/favorites" params={{ slug: storeSlug }} style={{ ...itemStyle, position: "relative" }}>
        {badge(favoriteCount)}
        <span style={{ fontSize: 17 }}>♡</span>
        Favoriler
      </Link>
      <button type="button" onClick={() => storefrontUI.openCart()} style={{ ...itemStyle, position: "relative" }}>
        {badge(cartCount)}
        <span style={{ fontSize: 17 }}>⛭</span>
        Sepet
      </button>
    </nav>
  );
}
