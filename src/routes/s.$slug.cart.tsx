import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { RecentlyViewed } from "@/components/recently-viewed";
import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/mefti";
import { storefrontQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/cart")({
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
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const cart = useCart();

  if (!data) return null;
  const { store, theme } = data;
  const { t, fonts, muted, cardBg, border, radius } = storefrontTokens(theme);
  const lines = cart.linesFor(slug);
  const subtotal = cart.subtotalFor(slug);

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
