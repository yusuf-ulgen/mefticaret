import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SmartImage } from "@/components/smart-image";

import { isDark, storefrontTokens, type StoreTheme } from "@/components/storefront-chrome";
import { useCart } from "@/lib/cart";
import { GeorgiaCustomsNotice, formatMoney } from "@/lib/display-currency";
import { storefrontUI, useStorefrontUI } from "@/lib/storefront-ui";
import type { StorefrontCommerce } from "@/lib/storefront-commerce";
import { resolveDesignTokens } from "@/lib/theme-design";
import { storefrontQuery } from "@/lib/storefront-queries";

const NOTE_KEY = "mefti-cart-note-v1";

/** Sağdan kayan AJAX sepet çekmecesi: ücretsiz kargo barı, adet değişimi, not ve hediye paketi. */
export function CartDrawer({
  theme,
  storeSlug,
  currency,
  commerce,
}: {
  theme: StoreTheme;
  storeSlug: string;
  currency: string;
  commerce?: StorefrontCommerce | undefined;
}) {
  const { cartOpen } = useStorefrontUI();
  const cart = useCart();
  const { t, fonts, muted, border, radius, text } = storefrontTokens(theme);
  const [note, setNote] = useState("");
  const [gift, setGift] = useState(false);
  const storefront = useQuery(storefrontQuery(storeSlug));

  const lines = cart.linesFor(storeSlug);
  const subtotal = cart.subtotalFor(storeSlug);
  const design = resolveDesignTokens((theme as { design_tokens?: unknown } | null | undefined)?.design_tokens).commerce;
  const override = design['freeShippingThreshold'] > 0 ? design['freeShippingThreshold'] : null;
  const threshold = design['freeShippingBar'] ? (override ?? commerce?.freeShippingThreshold ?? null) : null;
  const remaining = threshold ? Math.max(0, threshold - subtotal) : 0;
  const progress = threshold ? Math.min(100, Math.round((subtotal / threshold) * 100)) : 0;
  const accentContrast = isDark(t.accent_color) ? "#ffffff" : "#101418";
  const cartSlugs = new Set(lines.map((line) => line.productSlug));
  const recommendations = (storefront.data?.products ?? []).filter((product) => !cartSlugs.has(product.slug)).slice(0, 3);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`${NOTE_KEY}:${storeSlug}`);
      if (raw) {
        const parsed = JSON.parse(raw) as { note?: string; gift?: boolean };
        setNote(parsed.note ?? "");
        setGift(Boolean(parsed.gift));
      }
    } catch {
      /* yoksay */
    }
  }, [storeSlug]);

  useEffect(() => {
    try {
      window.localStorage.setItem(`${NOTE_KEY}:${storeSlug}`, JSON.stringify({ note, gift }));
    } catch {
      /* kota dolu olabilir */
    }
  }, [note, gift, storeSlug]);

  useEffect(() => {
    if (!cartOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") storefrontUI.closeCart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cartOpen]);

  if (!cartOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80 }}>
      <button
        type="button"
        aria-label="Sepeti kapat"
        onClick={() => storefrontUI.closeCart()}
        style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,.45)", border: "none" }}
      />
      <aside
        role="dialog"
        aria-label="Sepet"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(400px, 92vw)",
          background: t.background_color,
          color: text,
          fontFamily: fonts.body,
          borderLeft: `1px solid ${border}`,
          display: "flex",
          flexDirection: "column",
          animation: "sfSlideIn .25s ease",
        }}
      >
        <style>{`@keyframes sfSlideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 18px",
            borderBottom: `1px solid ${border}`,
          }}
        >
          <strong style={{ fontFamily: fonts.heading, fontSize: 16 }}>Sepetim ({lines.length})</strong>
          <button
            type="button"
            onClick={() => storefrontUI.closeCart()}
            style={{ background: "none", border: "none", color: muted, fontSize: 20, cursor: "pointer" }}
          >
            ×
          </button>
        </header>

        {threshold ? (
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
            <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>
              {remaining > 0
                ? `${formatMoney(remaining, currency)} daha ekle, kargo ücretsiz olsun!`
                : "Tebrikler, kargo ücretsiz!"}
            </div>
            <div style={{ height: 6, borderRadius: 999, background: border, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", background: t.accent_color }} />
            </div>
          </div>
        ) : null}

        <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "grid", gap: 14 }}>
          {lines.length === 0 ? (
            <p style={{ color: muted, fontSize: 14 }}>Sepetin şu anda boş.</p>
          ) : (
            lines.map((line) => (
              <div key={line.variantId} style={{ display: "grid", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{line.title}</div>
                    <div style={{ color: muted, fontSize: 12 }}>{line.variantTitle}</div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap" }}>
                    {formatMoney(line.price * line.quantity, line.currency)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", border: `1px solid ${border}`, borderRadius: 8 }}>
                    <button
                      type="button"
                      aria-label="Adet azalt"
                      onClick={() => cart.setQuantity(line.variantId, line.quantity - 1)}
                      style={{ background: "none", border: "none", color: "inherit", padding: "4px 10px", cursor: "pointer" }}
                    >
                      −
                    </button>
                    <span style={{ fontSize: 13, minWidth: 22, textAlign: "center" }}>{line.quantity}</span>
                    <button
                      type="button"
                      aria-label="Adet artır"
                      onClick={() => cart.setQuantity(line.variantId, line.quantity + 1)}
                      style={{ background: "none", border: "none", color: "inherit", padding: "4px 10px", cursor: "pointer" }}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => cart.remove(line.variantId)}
                    style={{ background: "none", border: "none", color: muted, fontSize: 12, cursor: "pointer" }}
                  >
                    Kaldır
                  </button>
                </div>
              </div>
            ))
          )}

          {lines.length ? (
            <div style={{ borderTop: `1px solid ${border}`, paddingTop: 14, display: "grid", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: muted }}>
                <input type="checkbox" checked={gift} onChange={(event) => setGift(event.target.checked)} />
                Hediye paketi istiyorum
              </label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, 300))}
                placeholder="Sipariş notu (opsiyonel)"
                rows={2}
                style={{
                  background: "transparent",
                  color: "inherit",
                  border: `1px solid ${border}`,
                  borderRadius: radius,
                  padding: 10,
                  fontSize: 13,
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </div>
          ) : null}

          {lines.length && recommendations.length ? (
            <section style={{ borderTop: `1px solid ${border}`, paddingTop: 14 }}>
              <strong style={{ fontFamily: fonts.heading, fontSize: 13 }}>Bunlar da hoşuna gidebilir</strong>
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {recommendations.map((product) => (
                  <Link
                    key={product.id}
                    to="/s/$slug/p/$productSlug"
                    params={{ slug: storeSlug, productSlug: product.slug }}
                    onClick={() => storefrontUI.closeCart()}
                    style={{ display: "grid", gridTemplateColumns: "52px 1fr", gap: 10, color: "inherit", textDecoration: "none", alignItems: "center" }}
                  >
                    <SmartImage src={product.coverUrl} alt={product.title} width={104} style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8 }} />
                    <span style={{ minWidth: 0, fontSize: 12 }}><strong style={{ display: "block" }}>{product.title}</strong><span style={{ color: muted }}>{formatMoney(Number(product.livePrice ?? product.base_price), product.currency ?? currency)}</span></span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <footer style={{ padding: 18, borderTop: `1px solid ${border}`, display: "grid", gap: 10 }}>
          <GeorgiaCustomsNotice amount={subtotal} currency={currency} />
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>Ara toplam</span>
            <span>{formatMoney(subtotal, currency)}</span>
          </div>
          <Link
            to="/s/$slug/cart"
            params={{ slug: storeSlug }}
            onClick={() => storefrontUI.closeCart()}
            style={{
              textAlign: "center",
              padding: "12px 16px",
              borderRadius: radius,
              background: t.accent_color,
              color: accentContrast,
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Sepete git ve öde
          </Link>
          <button
            type="button"
            onClick={() => storefrontUI.closeCart()}
            style={{
              padding: "10px 16px",
              borderRadius: radius,
              border: `1px solid ${border}`,
              background: "transparent",
              color: "inherit",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Alışverişe devam et
          </button>
        </footer>
      </aside>
    </div>
  );
}
