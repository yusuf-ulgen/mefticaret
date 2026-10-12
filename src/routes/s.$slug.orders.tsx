import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { Breadcrumb, StorefrontFallback } from "@/components/storefront-parts";
import { myOrdersQuery } from "@/lib/account-queries";
import { useAuth } from "@/lib/auth-context";
import {
  formatDateTime,
  formatMoney,
  FULFILLMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/mefti";
import { storefrontQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/orders")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { storeName: data.store.name };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Mağaza bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Siparişlerim — ${loaderData.storeName}`;
    const description = `${loaderData.storeName} sipariş geçmişin: ödeme ve kargo durumu, tutarlar ve sipariş detayları.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  errorComponent: () => <StorefrontFallback text="Siparişler şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: OrdersPage,
});

function OrdersPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const { user, loading } = useAuth();

  if (!data) return <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme, footerPages } = data;

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      <Breadcrumb theme={theme} slug={slug} storeName={store.name} current="Siparişlerim" />
      <OrdersBody slug={slug} storeId={store.id} theme={theme} enabled={Boolean(user)} loading={loading} />
    </StorefrontChrome>
  );
}

function OrdersBody({
  slug,
  storeId,
  theme,
  enabled,
  loading,
}: {
  slug: string;
  storeId: string;
  theme: Parameters<typeof storefrontTokens>[0];
  enabled: boolean;
  loading: boolean;
}) {
  const { fonts, muted, cardBg, border, radius } = storefrontTokens(theme);
  const orders = useQuery(myOrdersQuery(storeId, enabled));

  return (
    <section style={{ padding: "22px 0 64px", maxWidth: 820 }}>
      <h1 style={{ fontFamily: fonts.heading, fontSize: 32, fontWeight: 700, margin: 0 }}>Siparişlerim</h1>
      <p style={{ color: muted, marginTop: 10, fontSize: 14 }}>
        Hesabınla verdiğin tüm siparişler, ödeme ve kargo durumlarıyla birlikte listelenir.
      </p>

      {loading ? (
        <p style={{ color: muted, marginTop: 24 }}>Yükleniyor…</p>
      ) : !enabled ? (
        <div
          style={{
            marginTop: 22,
            background: cardBg,
            border: `1px solid ${border}`,
            borderRadius: radius,
            padding: 18,
            fontSize: 14,
          }}
        >
          Siparişlerini görmek için{" "}
          <Link to="/s/$slug/login" params={{ slug }} style={{ color: "inherit", fontWeight: 600 }}>
            giriş yap
          </Link>{" "}
          ya da{" "}
          <Link to="/s/$slug/order" params={{ slug }} style={{ color: "inherit", fontWeight: 600 }}>
            sipariş numaranla sorgula
          </Link>
          .
        </div>
      ) : orders.isLoading ? (
        <p style={{ color: muted, marginTop: 24 }}>Siparişler getiriliyor…</p>
      ) : !orders.data?.orders.length ? (
        <p style={{ color: muted, marginTop: 24 }}>Henüz bir siparişin yok.</p>
      ) : (
        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
          {orders.data.orders.map((order) => (
            <article
              key={order.id}
              style={{
                background: cardBg,
                border: `1px solid ${border}`,
                borderRadius: radius,
                padding: "16px 18px",
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong style={{ fontSize: 15 }}>#{order.order_number}</strong>
                <span style={{ fontWeight: 700 }}>{formatMoney(Number(order.grand_total), order.currency)}</span>
              </div>
              <p style={{ margin: 0, color: muted, fontSize: 13 }}>{formatDateTime(order.placed_at)}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 12, color: muted }}>
                <span style={{ border: `1px solid ${border}`, borderRadius: 999, padding: "3px 10px" }}>
                  {ORDER_STATUS_LABELS[order.status] ?? order.status}
                </span>
                <span style={{ border: `1px solid ${border}`, borderRadius: 999, padding: "3px 10px" }}>
                  Ödeme: {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}
                </span>
                <span style={{ border: `1px solid ${border}`, borderRadius: 999, padding: "3px 10px" }}>
                  Kargo: {FULFILLMENT_STATUS_LABELS[order.fulfillment_status] ?? order.fulfillment_status}
                </span>
              </div>
              {order.tracking_number ? (
                <p style={{ margin: 0, fontSize: 13 }}>
                  {order.shipping_carrier ?? "Kargo"} takip no:{" "}
                  <strong>{order.tracking_number}</strong>
                  {order.shipping_carrier === "Aras Kargo" ? (
                    <>
                      {" · "}
                      <a
                        href={`https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${encodeURIComponent(
                          order.tracking_number,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "inherit", fontWeight: 600 }}
                      >
                        Kargoyu takip et
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
              <Link
                to="/s/$slug/account"
                params={{ slug }}
                style={{ color: "inherit", fontSize: 13, fontWeight: 600, justifySelf: "start" }}
              >
                Detay ve iade talepleri →
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
