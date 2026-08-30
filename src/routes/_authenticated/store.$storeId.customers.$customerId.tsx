import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Package, RotateCcw } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { customerDetailQuery } from "@/lib/sales-queries";
import { RETURN_STATUS_LABELS, type ReturnStatus } from "@/lib/returns-queries";
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDate,
  formatMoney,
} from "@/lib/mefti";

export const Route = createFileRoute(
  "/_authenticated/store/$storeId/customers/$customerId",
)({
  head: () => ({
    meta: [
      { title: "Müşteri profili — Mefticaret" },
      {
        name: "description",
        content:
          "Müşterinin sipariş geçmişi, iade talepleri, adres defteri ve yaşam boyu değeri tek ekranda.",
      },
      { property: "og:title", content: "Müşteri profili — Mefticaret" },
      {
        property: "og:description",
        content: "Sipariş geçmişi, iadeler, adresler ve müşteri değeri özeti.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { storeId, customerId } = Route.useParams();
  const { data, isLoading } = useQuery(customerDetailQuery(customerId));

  const customer = data?.customer;
  const orders = data?.orders ?? [];
  const returns = data?.returns ?? [];
  const spent = orders.reduce((sum, order) => sum + Number(order.grand_total), 0);
  const avg = orders.length > 0 ? spent / orders.length : 0;

  return (
    <AppShell
      storeId={storeId}
      title={customer?.full_name ?? "Müşteri profili"}
      description="Sipariş geçmişi, iade talepleri ve adres defteri."
    >
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="gap-2">
          <Link to="/store/$storeId/customers" params={{ storeId }}>
            <ArrowLeft className="size-4" />
            Müşteri listesi
          </Link>
        </Button>

        {isLoading ? (
          <p className="text-muted-foreground">Yükleniyor…</p>
        ) : !customer ? (
          <div className="surface-card p-10 text-center">
            <p className="font-medium">Müşteri bulunamadı</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Toplam harcama" value={formatMoney(spent)} />
              <StatCard label="Sipariş sayısı" value={String(orders.length)} />
              <StatCard label="Ortalama sepet" value={formatMoney(avg)} />
              <StatCard label="İade talebi" value={String(returns.length)} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="surface-card space-y-3 p-6">
                <h2 className="text-lg font-semibold">İletişim</h2>
                <InfoRow label="E-posta" value={customer.email ?? "—"} />
                <InfoRow label="Telefon" value={customer.phone ?? "—"} />
                <InfoRow label="Kayıt" value={formatDate(customer.created_at)} />
                <InfoRow
                  label="Pazarlama izni"
                  value={customer.accepts_marketing ? "Var" : "Yok"}
                />
                {customer.notes ? (
                  <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                    {customer.notes}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-1">
                  {(customer.tags ?? []).map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-[0.65rem]">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="surface-card space-y-3 p-6 lg:col-span-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <MapPin className="size-4" /> Adres defteri
                </h2>
                {(customer.customer_addresses ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">Kayıtlı adres yok.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(customer.customer_addresses ?? []).map((address) => (
                      <div key={address.id} className="rounded-lg border border-border p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{address.recipient}</span>
                          {address.is_default ? (
                            <Badge variant="outline" className="text-[0.65rem]">
                              varsayılan
                            </Badge>
                          ) : null}
                        </div>
                        <p className="pt-1 text-muted-foreground">
                          {address.line1}
                          {address.line2 ? `, ${address.line2}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[address.district, address.city, address.postal_code, address.country]
                            .filter(Boolean)
                            .join(" / ")}
                        </p>
                        {address.phone ? (
                          <p className="text-xs text-muted-foreground">{address.phone}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <section className="surface-card overflow-x-auto">
              <h2 className="flex items-center gap-2 p-6 pb-3 text-lg font-semibold">
                <Package className="size-4" /> Siparişler
              </h2>
              {orders.length === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">
                  Bu müşterinin siparişi yok.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Sipariş</th>
                      <th className="px-4 py-3">Durum</th>
                      <th className="px-4 py-3">Ödeme</th>
                      <th className="px-4 py-3 text-right">Tutar</th>
                      <th className="px-4 py-3">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3">
                          <Link
                            className="font-medium underline-offset-4 hover:underline"
                            to="/store/$storeId/orders/$orderId"
                            params={{ storeId, orderId: order.id }}
                          >
                            {order.order_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">
                            {ORDER_STATUS_LABELS[order.status] ?? order.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatMoney(Number(order.grand_total), order.currency)}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {formatDate(order.placed_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="surface-card p-6">
              <h2 className="flex items-center gap-2 pb-3 text-lg font-semibold">
                <RotateCcw className="size-4" /> İade talepleri
              </h2>
              {returns.length === 0 ? (
                <p className="text-sm text-muted-foreground">İade talebi yok.</p>
              ) : (
                <ul className="space-y-2">
                  {returns.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                    >
                      <span className="font-medium">{item.return_number}</span>
                      <Badge variant="secondary">
                        {RETURN_STATUS_LABELS[item.status as ReturnStatus] ?? item.status}
                      </Badge>
                      <span className="font-semibold">
                        {formatMoney(Number(item.refund_amount), item.currency)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(item.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="pt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
