import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { z } from "zod";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { getOrderStatus } from "@/lib/checkout.functions";
import { formatDateTime, formatMoney, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/mefti";
import { SHIPMENT_STATUS_LABELS, type ShipmentStatus } from "@/lib/shipments-queries";
import { storefrontQuery } from "@/lib/storefront-queries";

type OrderStatus = Awaited<ReturnType<typeof getOrderStatus>>;

export const Route = createFileRoute("/s/$slug/order")({
  validateSearch: z.object({ no: z.string().optional(), email: z.string().optional() }),
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.store.name };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.name ?? "Mağaza";
    const title = `Sipariş durumu — ${name}`;
    const description = `${name} siparişinin durumunu, tutarını ve kargo bilgisini sipariş numarasıyla sorgula.`;
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
  component: OrderPage,
});

function OrderPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const { data } = useSuspenseQuery(storefrontQuery(slug));

  const [orderNumber, setOrderNumber] = useState(search.no ?? "");
  const [email, setEmail] = useState(search.email ?? "");
  const [result, setResult] = useState<OrderStatus>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function lookup(no: string, mail: string) {
    if (!no.trim() || !mail.trim()) {
      setMessage("Sipariş numarası ve e-posta gerekli.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const found = await getOrderStatus({ data: { slug, orderNumber: no.trim(), email: mail.trim() } });
      setResult(found);
      if (!found) setMessage("Bu bilgilerle bir sipariş bulunamadı.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sipariş sorgulanamadı");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (search.no && search.email) void lookup(search.no, search.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.no, search.email]);

  if (!data) return null;
  const { store, theme } = data;
  const { t, fonts, muted, cardBg, border, radius } = storefrontTokens(theme);

  const inputStyle = {
    width: "100%",
    background: "transparent",
    color: "inherit",
    border: `1px solid ${border}`,
    borderRadius: radius,
    padding: "10px 12px",
    fontSize: 14,
    fontFamily: "inherit",
  } as const;

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug}>
      <h1 style={{ fontFamily: fonts.heading, fontSize: 30, margin: "40px 0 8px", fontWeight: 700 }}>
        {result ? "Siparişiniz alındı" : "Sipariş durumu"}
      </h1>
      <p style={{ color: muted, marginTop: 0, fontSize: 14 }}>
        {result
          ? `Sipariş numaranız ${result.order.order_number}. Detaylar e-posta adresinize de kayıtlıdır.`
          : "Sipariş numaranız ve e-posta adresiniz ile siparişinizi görüntüleyin."}
      </p>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "minmax(0,1.4fr) minmax(260px,.8fr)", marginTop: 20 }}>
        <div style={{ display: "grid", gap: 16 }}>
          {result ? (
            <section style={{ border: `1px solid ${border}`, borderRadius: radius, background: cardBg, padding: 20 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
                <Badge text={ORDER_STATUS_LABELS[result.order.status] ?? result.order.status} accent={t.accent_color} radius={radius} />
                <Badge
                  text={PAYMENT_STATUS_LABELS[result.order.payment_status] ?? result.order.payment_status}
                  accent={t.primary_color}
                  radius={radius}
                />
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {result.items.map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                    <span style={{ color: muted }}>
                      {item.title}
                      {item.variant_title ? ` · ${item.variant_title}` : ""} × {item.quantity}
                    </span>
                    <span>{formatMoney(Number(item.line_total), result.order.currency)}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
                <Row label="Ara toplam" value={formatMoney(Number(result.order.subtotal), result.order.currency)} muted={muted} />
                {Number(result.order.discount_total) > 0 ? (
                  <Row label="İndirim" value={`− ${formatMoney(Number(result.order.discount_total), result.order.currency)}`} muted={muted} />
                ) : null}
                <Row label="Kargo" value={formatMoney(Number(result.order.shipping_total), result.order.currency)} muted={muted} />
                <Row label="Vergi / hizmet" value={formatMoney(Number(result.order.tax_total), result.order.currency)} muted={muted} />
                <Row label="Genel toplam" value={formatMoney(Number(result.order.grand_total), result.order.currency)} muted={muted} strong />
              </div>
              <p style={{ marginTop: 14, fontSize: 12, color: muted }}>
                Sipariş tarihi: {formatDateTime(result.order.placed_at)}
                {result.order.shipping_carrier ? ` · Kargo: ${result.order.shipping_carrier}` : ""}
                {result.order.tracking_number ? ` · Takip: ${result.order.tracking_number}` : ""}
              </p>
            </section>
          ) : null}

          {result && result.shipments.length > 0 ? (
            <section style={{ border: `1px solid ${border}`, borderRadius: radius, background: cardBg, padding: 20 }}>
              <h2 style={{ fontFamily: fonts.heading, fontSize: 16, margin: "0 0 14px" }}>Kargo takibi</h2>
              <div style={{ display: "grid", gap: 12 }}>
                {result.shipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    style={{ border: `1px solid ${border}`, borderRadius: radius, padding: 14 }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                      <strong style={{ fontSize: 14 }}>{shipment.carrier}</strong>
                      <Badge
                        text={SHIPMENT_STATUS_LABELS[shipment.status as ShipmentStatus] ?? shipment.status}
                        accent={t.accent_color}
                        radius={radius}
                      />
                    </div>
                    <p style={{ fontSize: 13, color: muted, margin: "8px 0 0" }}>
                      Takip no: {shipment.tracking_number ?? "—"}
                      {shipment.shipped_at ? ` · Çıkış: ${formatDateTime(shipment.shipped_at)}` : ""}
                      {shipment.delivered_at ? ` · Teslim: ${formatDateTime(shipment.delivered_at)}` : ""}
                    </p>
                    {shipment.tracking_url ? (
                      <a
                        href={shipment.tracking_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "inline-block", marginTop: 10, fontSize: 13, color: t.primary_color }}
                      >
                        Kargo firmasında takip et →
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}


          <section style={{ border: `1px solid ${border}`, borderRadius: radius, background: cardBg, padding: 20 }}>
            <h2 style={{ fontFamily: fonts.heading, fontSize: 16, margin: "0 0 14px" }}>Sipariş sorgula</h2>
            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))" }}>
              <input style={inputStyle} placeholder="MEF-XXXXXX" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
              <input style={inputStyle} placeholder="E-posta" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button
              type="button"
              onClick={() => void lookup(orderNumber, email)}
              disabled={loading}
              style={{
                marginTop: 12,
                background: t.accent_color,
                color: "#12181f",
                border: "none",
                borderRadius: radius,
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {loading ? "Sorgulanıyor…" : "Sorgula"}
            </button>
            {message ? <p style={{ fontSize: 13, color: muted, marginBottom: 0 }}>{message}</p> : null}
          </section>
        </div>

        <aside style={{ border: `1px solid ${border}`, borderRadius: radius, background: cardBg, padding: 20, height: "fit-content" }}>
          <h2 style={{ fontFamily: fonts.heading, fontSize: 16, margin: "0 0 10px" }}>Alışverişe devam</h2>
          <p style={{ fontSize: 13, color: muted, marginTop: 0 }}>Vitrindeki diğer ürünlere göz atın.</p>
          <Link
            to="/s/$slug"
            params={{ slug }}
            style={{
              display: "inline-block",
              marginTop: 8,
              border: `1px solid ${border}`,
              borderRadius: radius,
              padding: "9px 16px",
              fontSize: 14,
              color: "inherit",
              textDecoration: "none",
            }}
          >
            {store.name} vitrini
          </Link>
        </aside>
      </div>
    </StorefrontChrome>
  );
}

function Row({ label, value, muted, strong }: { label: string; value: string; muted: string; strong?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: strong ? 15 : 14, padding: "3px 0" }}>
      <span style={{ color: muted }}>{label}</span>
      <span style={{ fontWeight: strong ? 700 : 600 }}>{value}</span>
    </div>
  );
}

function Badge({ text, accent, radius }: { text: string; accent: string; radius: string }) {
  return (
    <span style={{ background: `${accent}22`, border: `1px solid ${accent}`, borderRadius: radius, padding: "5px 12px", fontSize: 12 }}>
      {text}
    </span>
  );
}
