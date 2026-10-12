import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { isDark, storefrontTokens, type StoreTheme } from "@/components/storefront-chrome";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/display-currency";
import { storefrontProductQuery } from "@/lib/storefront-queries";
import { storefrontUI, useStorefrontUI } from "@/lib/storefront-ui";

/** Ürün sayfasından ayrılmadan varyant seçip sepete eklemeyi sağlayan hızlı bakış modalı. */
export function QuickViewModal({ theme, storeSlug }: { theme: StoreTheme; storeSlug: string }) {
  const { quickViewSlug } = useStorefrontUI();
  const { t, fonts, muted, border, radius, text } = storefrontTokens(theme);
  const cart = useCart();
  const [variantId, setVariantId] = useState<string | null>(null);

  const query = useQuery({
    ...storefrontProductQuery(storeSlug, quickViewSlug ?? ""),
    enabled: Boolean(quickViewSlug),
  });

  useEffect(() => {
    setVariantId(null);
  }, [quickViewSlug]);

  useEffect(() => {
    if (!quickViewSlug) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") storefrontUI.closeQuickView();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickViewSlug]);

  const data = query.data ?? null;
  const variants = useMemo(() => data?.variants ?? [], [data]);
  const active = variants.find((variant) => variant.id === variantId) ?? variants[0] ?? null;
  const accentContrast = isDark(t.accent_color) ? "#ffffff" : "#101418";

  if (!quickViewSlug) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, display: "grid", placeItems: "center", padding: 16 }}>
      <button
        type="button"
        aria-label="Kapat"
        onClick={() => storefrontUI.closeQuickView()}
        style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,.5)", border: "none" }}
      />
      <div
        role="dialog"
        aria-label="Hızlı ürün bakışı"
        style={{
          position: "relative",
          width: "min(760px, 100%)",
          maxHeight: "88vh",
          overflowY: "auto",
          background: t.background_color,
          color: text,
          fontFamily: fonts.body,
          border: `1px solid ${border}`,
          borderRadius: radius,
          padding: 20,
        }}
      >
        <button
          type="button"
          onClick={() => storefrontUI.closeQuickView()}
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            background: "none",
            border: "none",
            color: muted,
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          ×
        </button>

        {query.isLoading ? (
          <p style={{ color: muted, fontSize: 14 }}>Ürün yükleniyor…</p>
        ) : !data ? (
          <p style={{ color: muted, fontSize: 14 }}>Ürün bulunamadı.</p>
        ) : (
          <div className="sf-quickview" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20 }}>
            <div
              style={{
                borderRadius: radius,
                overflow: "hidden",
                minHeight: 240,
                background: `linear-gradient(140deg, ${t.accent_color}22, ${t.primary_color}12)`,
              }}
            >
              {(active?.imageUrl ?? data.images[0]?.url) ? (
                <img
                  src={active?.imageUrl ?? data.images[0]?.url ?? ""}
                  alt={data.product.title}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
              ) : null}
            </div>

            <div style={{ minWidth: 0 }}>
              <h2 style={{ fontFamily: fonts.heading, fontSize: 22, margin: "0 0 6px" }}>{data.product.title}</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                <strong style={{ fontSize: 18 }}>
                  {formatMoney(Number(active?.price ?? data.product.base_price), data.product.currency)}
                </strong>
                {data.product.compare_at_price ? (
                  <span style={{ color: muted, textDecoration: "line-through", fontSize: 14 }}>
                    {formatMoney(Number(data.product.compare_at_price), data.product.currency)}
                  </span>
                ) : null}
              </div>

              {variants.length > 1 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                  {variants.map((variant) => {
                    const isActive = active?.id === variant.id;
                    const out = Number(variant.stock ?? 0) <= 0;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        disabled={out}
                        onClick={() => setVariantId(variant.id)}
                        style={{
                          padding: "7px 12px",
                          borderRadius: 999,
                          border: `1px solid ${isActive ? t.accent_color : border}`,
                          background: isActive ? `${t.accent_color}22` : "transparent",
                          color: out ? muted : "inherit",
                          fontSize: 13,
                          textDecoration: out ? "line-through" : "none",
                          cursor: out ? "not-allowed" : "pointer",
                        }}
                      >
                        {variant.title}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {active ? (
                <div style={{ color: muted, fontSize: 12, marginBottom: 12 }}>
                  {Number(active.stock ?? 0) > 0 ? `Stokta ${active.stock} adet` : "Bu seçenek tükendi"}
                </div>
              ) : null}

              <button
                type="button"
                disabled={!active || Number(active.stock ?? 0) <= 0}
                onClick={() => {
                  if (!active) return;
                  cart.add({
                    storeSlug,
                    variantId: active.id,
                    productSlug: data.product.slug,
                    title: data.product.title,
                    variantTitle: active.title,
                    price: Number(active.price ?? data.product.base_price),
                    currency: data.product.currency,
                    maxStock: Number(active.stock ?? 0),
                  });
                  storefrontUI.closeQuickView();
                  storefrontUI.openCart();
                  toast.success("Ürün sepete eklendi");
                }}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: radius,
                  border: "none",
                  background: t.accent_color,
                  color: accentContrast,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Sepete ekle
              </button>

              <Link
                to="/s/$slug/p/$productSlug"
                params={{ slug: storeSlug, productSlug: data.product.slug }}
                onClick={() => storefrontUI.closeQuickView()}
                style={{
                  display: "block",
                  marginTop: 10,
                  textAlign: "center",
                  fontSize: 13,
                  color: muted,
                  textDecoration: "underline",
                }}
              >
                Tüm ürün detaylarını gör
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
