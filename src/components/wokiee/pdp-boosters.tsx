import { useEffect, useMemo, useState } from "react";

import { isDark, storefrontTokens, type StoreTheme } from "@/components/storefront-chrome";
import { formatMoney } from "@/lib/mefti";
import type { StorefrontCommerce } from "@/lib/storefront-commerce";

/** Ürün detayında dönüşümü artıran widget'lar: canlı izleyici, stok çubuğu, teslimat hesabı. */
export function ConversionBoosters({
  theme,
  productId,
  stock,
  commerce,
}: {
  theme: StoreTheme;
  productId: string;
  stock: number;
  commerce?: StorefrontCommerce | undefined;
}) {
  const { t, muted, border, radius, cardBg } = storefrontTokens(theme);
  const [viewers, setViewers] = useState(0);
  const [city, setCity] = useState("");

  // Canlı izleyici sayısı: ürün kimliğinden türetilen sabit taban + küçük dalgalanma.
  const base = useMemo(() => {
    let hash = 0;
    for (const char of productId) hash = (hash * 31 + char.charCodeAt(0)) % 997;
    return 6 + (hash % 22);
  }, [productId]);

  useEffect(() => {
    setViewers(base);
    const timer = setInterval(() => {
      setViewers((current) => Math.max(3, current + (Math.random() > 0.5 ? 1 : -1)));
    }, 6000);
    return () => clearInterval(timer);
  }, [base]);

  const lowStock = stock > 0 && stock <= 10;
  const stockPercent = stock > 0 ? Math.min(100, Math.round((stock / 20) * 100)) : 0;
  const eta = commerce?.fastestEtaDays ?? null;
  const delivery = useMemo(() => {
    if (!eta) return null;
    const days = city.trim().length > 2 ? eta : eta + 1;
    const date = new Date(Date.now() + days * 86400000);
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long" });
  }, [eta, city]);

  return (
    <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
      <div style={{ fontSize: 13, color: muted }}>
        👁 Şu an bu ürünü <strong style={{ color: t.accent_color }}>{viewers} kişi</strong> inceliyor
      </div>

      {lowStock ? (
        <div>
          <div style={{ fontSize: 13, marginBottom: 6 }}>
            Acele et! Stokta sadece <strong>{stock} adet</strong> kaldı
          </div>
          <div style={{ height: 6, borderRadius: 999, background: border, overflow: "hidden" }}>
            <div style={{ width: `${stockPercent}%`, height: "100%", background: "#d92d20" }} />
          </div>
        </div>
      ) : null}

      {eta ? (
        <div
          style={{
            background: cardBg,
            border: `1px solid ${border}`,
            borderRadius: radius,
            padding: 12,
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600 }}>Tahmini teslimat</div>
          <input
            value={city}
            onChange={(event) => setCity(event.target.value.slice(0, 40))}
            placeholder="İl / ilçe gir"
            aria-label="Teslimat için il gir"
            style={{
              background: "transparent",
              color: "inherit",
              border: `1px solid ${border}`,
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: 13,
              fontFamily: "inherit",
            }}
          />
          <div style={{ fontSize: 13, color: muted }}>
            {delivery ? `Kargoya bugün verilirse tahmini teslim: ${delivery}` : "Teslimat süresi hesaplanıyor…"}
          </div>
          {commerce?.freeShippingThreshold ? (
            <div style={{ fontSize: 12, color: muted }}>
              {formatMoney(commerce.freeShippingThreshold, commerce.currency)} üzeri siparişlerde kargo ücretsiz.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Sayfa kaydırıldığında ekranın altında sabitlenen mini satın alma barı. */
export function StickyAddToCartBar({
  theme,
  title,
  price,
  currency,
  disabled,
  onAdd,
}: {
  theme: StoreTheme;
  title: string;
  price: number;
  currency: string;
  disabled?: boolean;
  onAdd: () => void;
}) {
  const { t, border, muted } = storefrontTokens(theme);
  const [visible, setVisible] = useState(false);
  const accentContrast = isDark(t.accent_color) ? "#ffffff" : "#101418";

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 520);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="sf-sticky-atc"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 65,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 18px",
        background: t.background_color,
        borderTop: `1px solid ${border}`,
        boxShadow: "0 -12px 30px -22px rgba(15,23,42,.5)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12, color: muted }}>{formatMoney(price, currency)}</div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        style={{
          padding: "10px 18px",
          borderRadius: 999,
          border: "none",
          background: disabled ? border : t.accent_color,
          color: disabled ? muted : accentContrast,
          fontWeight: 600,
          fontSize: 13,
          cursor: disabled ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Sepete ekle
      </button>
    </div>
  );
}
