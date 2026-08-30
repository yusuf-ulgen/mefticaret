import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { z } from "zod";

import { getAbandonedCartByToken } from "@/lib/abandoned.functions";
import { setCartToken } from "@/lib/cart-token";

import { RecentlyViewed } from "@/components/recently-viewed";
import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/mefti";
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

  if (!data) return null;
  const { store, theme } = data;
  const { t, fonts, muted, cardBg, border, radius } = storefrontTokens(theme);
  const lines = cart.linesFor(slug);
  const subtotal = cart.subtotalFor(slug);

  // Ücretsiz kargo eşiği: aktif kargo tarifelerindeki en düşük "free_over" değeri.
  const options = useQuery(checkoutOptionsQuery(slug));
  const freeShippingThreshold = (() => {
    const values = (options.data?.shippingRates ?? [])
      .map((rate) => Number(rate.free_over ?? 0))
      .filter((value) => value > 0);
    return values.length ? Math.min(...values) : null;
  })();
  const freeShippingRemaining = freeShippingThreshold ? Math.max(0, freeShippingThreshold - subtotal) : 0;
  const freeShippingProgress = freeShippingThreshold
    ? Math.min(100, Math.round((subtotal / freeShippingThreshold) * 100))
    : 0;

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
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(260px,.9fr)", gap: 24 }}>
          <div style={{ display: "grid", gap: 12 }}>
            {lines.map((line) => (
              <div
                key={line.variantId}
                style={{
                  border: `1px solid ${border}`,
                  borderRadius: radius,
                  background: cardBg,
                  padding: 16,
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
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
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <QtyButton label="−" onClick={() => cart.setQuantity(line.variantId, line.quantity - 1)} border={border} radius={radius} />
                  <span style={{ minWidth: 28, textAlign: "center", fontSize: 14 }}>{line.quantity}</span>
                  <QtyButton
                    label="+"
                    disabled={line.quantity >= line.maxStock}
                    onClick={() => cart.setQuantity(line.variantId, line.quantity + 1)}
                    border={border}
                    radius={radius}
                  />
                </div>
                <div style={{ width: 110, textAlign: "right", fontWeight: 600 }}>
                  {formatMoney(line.price * line.quantity, line.currency)}
                </div>
                <button
                  type="button"
                  onClick={() => cart.remove(line.variantId)}
                  style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 13 }}
                >
                  Kaldır
                </button>
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
            <Row label="Ara toplam" value={formatMoney(subtotal, store.currency)} muted={muted} />
            <p style={{ fontSize: 12, color: muted, marginTop: 8 }}>
              Kargo ve vergi kasada hesaplanır.
            </p>
            {freeShippingThreshold ? (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 12.5, margin: 0 }}>
                  {freeShippingRemaining > 0
                    ? `Ücretsiz kargoya ${formatMoney(freeShippingRemaining, store.currency)} kaldı`
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
