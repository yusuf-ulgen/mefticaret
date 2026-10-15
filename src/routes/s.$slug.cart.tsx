import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { getAbandonedCartByToken } from "@/lib/abandoned.functions";
import { setCartToken } from "@/lib/cart-token";
import { estimatedDeliveryLabel, getCartPrefs, setCartPrefs } from "@/lib/cart-prefs";
import { previewCheckoutDiscount } from "@/lib/checkout.functions";

import { RecentlyViewed } from "@/components/recently-viewed";
import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { useCart } from "@/lib/cart";
import { GeorgiaCustomsNotice, formatMoney } from "@/lib/display-currency";
import { checkoutOptionsQuery, storefrontQuery } from "@/lib/storefront-queries";


const cartSearchSchema = z.object({
  recover: z.string().trim().min(16).max(128).optional(),
});

export const Route = createFileRoute("/s/$slug/cart")({
  validateSearch: (search) => cartSearchSchema.parse(search),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.store.name };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.name ?? "Mağaza";
    const title = `Sepet — ${name}`;
    const description = `${name} sepetindeki ürünleri gözden geçir, adetleri güncelle ve güvenli ödemeye geç.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: CartPage,
});

function CartPage() {
  const { slug } = Route.useParams();
  const { recover } = Route.useSearch();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const cart = useCart();
  const restored = useRef<string | null>(null);
  const options = useQuery(checkoutOptionsQuery(slug));

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; label: string; discountTotal: number; freeShipping: boolean } | null>(
    null,
  );
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [shippingRateId, setShippingRateId] = useState("");
  const prefsLoaded = useRef(false);


  // Kurtarma linki: panelden gönderilen token ile sepet satırlarını geri yükle.
  useEffect(() => {
    if (!recover || restored.current === recover) return;
    restored.current = recover;
    let cancelled = false;
    void getAbandonedCartByToken({ data: { slug, cartToken: recover } })
      .then((snapshot) => {
        if (cancelled || !snapshot || snapshot.items.length === 0) return;
        setCartToken(slug, recover);
        for (const item of snapshot.items) {
          cart.add(
            {
              storeSlug: slug,
              variantId: item.variantId,
              productSlug: item.productSlug,
              title: item.title,
              variantTitle: item.variantTitle,
              price: item.price,
              currency: snapshot.currency,
              maxStock: 99,
            },
            item.quantity,
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recover, slug, cart]);
  // Kupon / kargo tercihlerini tarayıcıdan geri yükle (kasa ile paylaşılır).
  useEffect(() => {
    if (prefsLoaded.current) return;
    prefsLoaded.current = true;
    const prefs = getCartPrefs(slug);
    if (prefs.couponCode) setCouponInput(prefs.couponCode);
    if (prefs.shippingRateId) setShippingRateId(prefs.shippingRateId);
  }, [slug]);

  if (!data) return null;
  const { store, theme } = data;
  const { t, fonts, muted, cardBg, border, radius } = storefrontTokens(theme);
  const lines = cart.linesFor(slug);
  const subtotal = cart.subtotalFor(slug);
  const currency = store.currency;

  const rates = options.data?.shippingRates ?? [];
  const settings = options.data?.settings ?? null;

  // Ücretsiz kargo eşiği: aktif kargo tarifelerindeki en düşük "free_over" değeri.
  const freeShippingThreshold = (() => {
    const values = rates.map((rate) => Number(rate.free_over ?? 0)).filter((value) => value > 0);
    return values.length ? Math.min(...values) : null;
  })();
  const freeShippingRemaining = freeShippingThreshold ? Math.max(0, freeShippingThreshold - subtotal) : 0;
  const freeShippingProgress = freeShippingThreshold
    ? Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100))
    : 0;

  // Tutarlar: indirim -> kargo -> vergi -> genel toplam (kasada sunucuda tekrar doğrulanır).
  const discountTotal = Math.min(subtotal, coupon?.discountTotal ?? 0);
  const selectedRate = rates.find((rate) => rate.id === shippingRateId) ?? null;
  const shippingTotal = (() => {
    if (!selectedRate) return 0;
    if (coupon?.freeShipping) return 0;
    if (selectedRate.free_over !== null && subtotal - discountTotal >= Number(selectedRate.free_over)) return 0;
    return Number(selectedRate.price);
  })();
  const taxRate = Number(settings?.default_tax_rate ?? 0);
  const taxIncluded = Boolean(settings?.tax_included_prices);
  const taxable = Math.max(0, subtotal - discountTotal);
  const taxTotal = taxIncluded ? 0 : Number(((taxable * taxRate) / 100).toFixed(2));
  const grandTotal = Number((taxable + shippingTotal + taxTotal).toFixed(2));
  const deliveryLabel = estimatedDeliveryLabel(selectedRate?.eta_days ?? null);

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const preview = await previewCheckoutDiscount({ data: { slug, code, subtotal } });
      setCoupon({
        code: preview.code,
        label: preview.label,
        discountTotal: preview.discountTotal,
        freeShipping: preview.freeShipping,
      });
      setCartPrefs(slug, { couponCode: preview.code });
    } catch (error) {
      setCoupon(null);
      setCouponError(error instanceof Error ? error.message : "Kupon uygulanamadı");
    } finally {
      setCouponLoading(false);
    }
  };

  const clearCoupon = () => {
    setCoupon(null);
    setCouponInput("");
    setCouponError(null);
    setCartPrefs(slug, { couponCode: "" });
  };

  const chooseRate = (id: string) => {
    setShippingRateId(id);
    setCartPrefs(slug, { shippingRateId: id });
  };



  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug}>
      <h1 style={{ fontFamily: fonts.heading, fontSize: 30, margin: "40px 0 20px", fontWeight: 700 }}>Sepet</h1>

      {lines.length === 0 ? (
        <div style={{ border: `1px solid ${border}`, borderRadius: radius, background: cardBg, padding: 32 }}>
          <p style={{ margin: 0, color: muted }}>Sepetiniz şu anda boş.</p>
          <Link
            to="/s/$slug"
            params={{ slug }}
            style={{
              display: "inline-block",
              marginTop: 16,
              background: t.accent_color,
              color: "#12181f",
              padding: "10px 18px",
              borderRadius: radius,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Ürünleri keşfet
          </Link>
        </div>
      ) : (
        <div className="sf-cart-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(260px,.9fr)", gap: 24 }}>
          <div style={{ display: "grid", gap: 12 }}>
            {lines.map((line) => (
              <div
                key={line.variantId}
                className="sf-cart-line"
                style={{
                  border: `1px solid ${border}`,
                  borderRadius: radius,
                  background: cardBg,
                  padding: 14,
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <Link
                  to="/s/$slug/p/$productSlug"
                  params={{ slug, productSlug: line.productSlug }}
                  aria-label={line.title}
                  style={{
                    width: 68,
                    height: 68,
                    flex: "0 0 auto",
                    borderRadius: radius,
                    overflow: "hidden",
                    border: `1px solid ${border}`,
                    display: "grid",
                    placeItems: "center",
                    textDecoration: "none",
                    color: muted,
                    fontWeight: 700,
                    fontSize: 20,
                  }}
                >
                  {line.imageUrl ? (
                    <img
                      src={line.imageUrl}
                      alt={line.title}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <span aria-hidden>{line.title.slice(0, 1).toUpperCase()}</span>
                  )}
                </Link>
                <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                  <Link
                    to="/s/$slug/p/$productSlug"
                    params={{ slug, productSlug: line.productSlug }}
                    style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}
                  >
                    {line.title}
                  </Link>
                  <div style={{ fontSize: 13, color: muted, marginTop: 4 }}>
                    {line.variantTitle} · {formatMoney(line.price, line.currency)}
                  </div>
                  {line.maxStock > 0 && line.maxStock <= 5 ? (
                    <div style={{ fontSize: 12, color: "#e5484d", marginTop: 4 }}>Son {line.maxStock} adet</div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => cart.remove(line.variantId)}
                    style={{
                      background: "none",
                      border: "none",
                      padding: "6px 0 0",
                      color: muted,
                      cursor: "pointer",
                      fontSize: 13,
                      textDecoration: "underline",
                    }}
                  >
                    Kaldır
                  </button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <QtyButton
                    label="−"
                    onClick={() => cart.setQuantity(line.variantId, line.quantity - 1)}
                    border={border}
                    radius={radius}
                  />
                  <span style={{ minWidth: 28, textAlign: "center", fontSize: 15, fontWeight: 600 }}>{line.quantity}</span>
                  <QtyButton
                    label="+"
                    disabled={line.quantity >= line.maxStock}
                    onClick={() => cart.setQuantity(line.variantId, line.quantity + 1)}
                    border={border}
                    radius={radius}
                  />
                </div>
                <div style={{ minWidth: 90, textAlign: "right", fontWeight: 700, flex: "0 0 auto" }}>
                  {formatMoney(line.price * line.quantity, line.currency)}
                </div>
              </div>
            ))}
          </div>


          <aside
            style={{
              border: `1px solid ${border}`,
              borderRadius: radius,
              background: cardBg,
              padding: 20,
              height: "fit-content",
            }}
          >
            <h2 style={{ fontFamily: fonts.heading, fontSize: 16, margin: "0 0 12px" }}>Özet</h2>

            {/* Kupon */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12.5, color: muted, display: "block", marginBottom: 6 }}>İndirim kuponu</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={couponInput}
                  onChange={(event) => setCouponInput(event.target.value)}
                  placeholder="KUPONKODU"
                  disabled={Boolean(coupon)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "9px 10px",
                    border: `1px solid ${border}`,
                    borderRadius: radius,
                    background: "transparent",
                    color: "inherit",
                    fontSize: 13,
                    textTransform: "uppercase",
                  }}
                />
                <button
                  type="button"
                  onClick={coupon ? clearCoupon : () => void applyCoupon()}
                  disabled={couponLoading || (!coupon && !couponInput.trim())}
                  style={{
                    border: `1px solid ${border}`,
                    background: coupon ? "transparent" : t.accent_color,
                    color: coupon ? "inherit" : "#12181f",
                    borderRadius: radius,
                    padding: "9px 12px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: couponLoading ? "wait" : "pointer",
                  }}
                >
                  {couponLoading ? "..." : coupon ? "Kaldır" : "Uygula"}
                </button>
              </div>
              {coupon ? (
                <p style={{ fontSize: 12, margin: "6px 0 0", color: t.accent_color }}>
                  {coupon.code} · {coupon.label}
                </p>
              ) : null}
              {couponError ? <p style={{ fontSize: 12, margin: "6px 0 0", color: "#e5484d" }}>{couponError}</p> : null}
            </div>

            {/* Kargo seçimi */}
            {rates.length ? (
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 12.5, color: muted, display: "block", marginBottom: 6 }}>Kargo yöntemi</span>
                <div style={{ display: "grid", gap: 6 }}>
                  {rates.map((rate) => {
                    const active = shippingRateId === rate.id;
                    const eta = estimatedDeliveryLabel(rate.eta_days);
                    return (
                      <button
                        key={rate.id}
                        type="button"
                        onClick={() => chooseRate(rate.id)}
                        style={{
                          textAlign: "left",
                          border: `1px solid ${active ? t.accent_color : border}`,
                          background: "transparent",
                          color: "inherit",
                          borderRadius: radius,
                          padding: "9px 11px",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          fontSize: 13,
                        }}
                      >
                        <span>
                          {rate.title}
                          {eta ? <span style={{ display: "block", color: muted, fontSize: 11.5 }}>{eta}</span> : null}
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {Number(rate.price) === 0 ? "Ücretsiz" : formatMoney(Number(rate.price), currency)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <GeorgiaCustomsNotice amount={subtotal} currency={currency} />

            <Row label="Ara toplam" value={formatMoney(subtotal, currency)} muted={muted} />
            {discountTotal > 0 ? (
              <Row label="İndirim" value={`- ${formatMoney(discountTotal, currency)}`} muted={muted} />
            ) : null}
            <Row
              label="Kargo"
              value={
                selectedRate
                  ? shippingTotal === 0
                    ? "Ücretsiz"
                    : formatMoney(shippingTotal, currency)
                  : "Yöntem seçin"
              }
              muted={muted}
            />
            <Row
              label={taxIncluded ? `Vergi (fiyatlara dahil, %${taxRate})` : `Vergi (%${taxRate})`}
              value={taxIncluded ? "Dahil" : formatMoney(taxTotal, currency)}
              muted={muted}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                borderTop: `1px solid ${border}`,
                marginTop: 8,
                paddingTop: 10,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              <span>Genel toplam</span>
              <span>{formatMoney(grandTotal, currency)}</span>
            </div>
            <p style={{ fontSize: 12, color: muted, marginTop: 8 }}>
              {deliveryLabel ? `Tahmini teslimat: ${deliveryLabel}` : "Tahmini teslimat için kargo yöntemi seçin."}
            </p>
            {freeShippingThreshold ? (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 12.5, margin: 0 }}>
                  {freeShippingRemaining > 0
                    ? `Ücretsiz kargoya ${formatMoney(freeShippingRemaining, currency)} kaldı`
                    : "Ücretsiz kargo kazandın 🎉"}
                </p>
                <div
                  style={{
                    marginTop: 8,
                    height: 6,
                    borderRadius: 999,
                    background: border,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${freeShippingProgress}%`,
                      height: "100%",
                      background: t.accent_color,
                      transition: "width .3s ease",
                    }}
                  />
                </div>
              </div>
            ) : null}

            <Link
              to="/s/$slug/checkout"
              params={{ slug }}
              style={{
                display: "block",
                marginTop: 16,
                background: t.accent_color,
                color: "#12181f",
                padding: "12px 18px",
                borderRadius: radius,
                fontSize: 14,
                fontWeight: 600,
                textAlign: "center",
                textDecoration: "none",
              }}
            >
              Ödemeye geç
            </Link>
          </aside>

          {/* Mobil: özet kartı ekranın altına inince görünen sabit ödeme şeridi */}
          <div
            className="sf-cart-bar"
            style={{
              position: "fixed",
              left: 12,
              right: 12,
              bottom: 12,
              zIndex: 65,
              display: "none",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 12px",
              background: cardBg,
              border: `1px solid ${border}`,
              borderRadius: radius,
              boxShadow: "0 10px 30px rgba(0,0,0,.18)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11.5, color: muted }}>
                {lines.reduce((sum, line) => sum + line.quantity, 0)} ürün · genel toplam
              </div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{formatMoney(grandTotal, currency)}</div>
            </div>
            <Link
              to="/s/$slug/checkout"
              params={{ slug }}
              style={{
                background: t.accent_color,
                color: "#12181f",
                padding: "12px 16px",
                borderRadius: radius,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              Ödemeye geç
            </Link>
          </div>
        </div>
      )}
      <RecentlyViewed
        storeSlug={store.slug}
        tokens={{ muted, border, cardBg, radius, headingFont: fonts.heading }}
      />
    </StorefrontChrome>
  );
}

function QtyButton({
  label,
  onClick,
  border,
  radius,
  disabled,
}: {
  label: string;
  onClick: () => void;
  border: string;
  radius: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: `1px solid ${border}`,
        background: "transparent",
        color: "inherit",
        borderRadius: radius,
        width: 30,
        height: 30,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "4px 0" }}>
      <span style={{ color: muted }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
