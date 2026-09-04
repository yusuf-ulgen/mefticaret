import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Banknote, PieChart } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import {
  overdueOrders,
  receivableAging,
  receivableSummary,
  statusBreakdown,
  statusLabel,
} from "@/lib/receivables";
import { receivablesQuery } from "@/lib/receivables-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/receivables")({
  head: () => ({
    meta: [
      { title: "Tahsilat Takibi — Mefticaret" },
      {
        name: "description",
        content:
          "Bekleyen ödemeler, tahsilat süresi, ödeme durumu dağılımı ve gecikmiş sipariş listesi ile nakit tahsilatını takip et.",
      },
      { property: "og:title", content: "Tahsilat Takibi — Mefticaret" },
      {
        property: "og:description",
        content: "Hangi siparişlerin ödemesi bekliyor, ne kadar gecikti? Tahsilat oranını ve riskleri gör.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReceivablesPage,
});

const RANGES = [30, 90, 180];

function daysLabel(days: number) {
  if (days <= 0) return "Aynı gün";
  return `${days.toFixed(days < 10 ? 1 : 0)} gün`;
}

function ReceivablesPage() {
  const { storeId } = Route.useParams();
  const [days, setDays] = useState(90);
  const { data, isLoading } = useQuery(receivablesQuery(storeId, days));
  const orders = data ?? [];

  const summary = useMemo(() => receivableSummary(orders), [orders]);
  const aging = useMemo(() => receivableAging(orders), [orders]);
  const breakdown = useMemo(() => statusBreakdown(orders), [orders]);
  const overdue = useMemo(() => overdueOrders(orders), [orders]);
  const maxAging = Math.max(1, ...aging.map((bucket) => bucket.amount));

  const exportOverdue = () => {
    downloadCsv(
      `tahsilat-gecikme-${storeId}.csv`,
      toCsv(
        ["Sipariş", "Müşteri", "Durum", "Tutar", "Sipariş tarihi", "Bekleme (gün)"],
        overdue.slice(0, 500).map((order) => [
          order.orderNumber,
          order.customerName,
          statusLabel(order.paymentStatus),
          order.grandTotal.toFixed(2),
          order.placedAt.slice(0, 10),
          order.ageDays,
        ]),
      ),
    );
  };

  return (
    <AppShell
      storeId={storeId}
      title="Tahsilat Takibi"
      description="Bekleyen ödemeleri, tahsilat hızını ve gecikmiş siparişleri tek ekranda izle."
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((range) => (
            <Button
              key={range}
              size="sm"
              variant={days === range ? "default" : "outline"}
              onClick={() => setDays(range)}
            >
              {range} gün
            </Button>
          ))}
          {overdue.length > 0 ? (
            <Button size="sm" variant="outline" className="ml-auto" onClick={exportOverdue}>
              Gecikme listesi (CSV)
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Tahsilat verileri hesaplanıyor…</p>
        ) : orders.length === 0 ? (
          <p className="text-muted-foreground text-sm">Bu dönemde sipariş bulunmuyor.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label="Tahsil edilen"
                value={formatMoney(summary.paidRevenue)}
                hint={`Tahsilat oranı %${summary.collectionRate.toFixed(1)}`}
              />
              <Kpi
                label="Bekleyen tahsilat"
                value={formatMoney(summary.openRevenue)}
                hint={`${formatNumber(summary.openCount)} sipariş`}
              />
              <Kpi
                label="Ort. tahsilat süresi"
                value={daysLabel(summary.avgCollectionDays)}
                hint={`Medyan ${daysLabel(summary.medianCollectionDays)}`}
              />
              <Kpi
                label="Başarısız / iade"
                value={formatMoney(summary.lostRevenue)}
                hint={`Sipariş oranı %${summary.failureRate.toFixed(1)}`}
              />
            </div>

            <section className="space-y-3 rounded-xl border p-5">
              <h3 className="font-display flex items-center gap-2 text-lg">
                <Banknote className="size-4 text-primary" /> Bekleyen ödeme yaşlandırması
              </h3>
              {aging.map((bucket) => (
                <div key={bucket.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{bucket.label}</span>
                    <span className="text-muted-foreground">
                      {formatMoney(bucket.amount)} · {formatNumber(bucket.count)} sipariş · %
                      {bucket.share.toFixed(1)}
                    </span>
                  </div>
                  <div className="bg-muted h-3 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${Math.round((bucket.amount / maxAging) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h3 className="font-display flex items-center gap-2 text-lg">
                <PieChart className="size-4 text-primary" /> Ödeme durumu dağılımı
              </h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3">Durum</th>
                      <th className="p-3 text-right">Sipariş</th>
                      <th className="p-3 text-right">Tutar</th>
                      <th className="p-3 text-right">Ciro payı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((row) => (
                      <tr key={row.paymentStatus} className="border-t">
                        <td className="p-3 font-medium">{statusLabel(row.paymentStatus)}</td>
                        <td className="p-3 text-right">{formatNumber(row.count)}</td>
                        <td className="p-3 text-right">{formatMoney(row.amount)}</td>
                        <td className="p-3 text-right">%{row.share.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-display flex items-center gap-2 text-lg">
                <AlertTriangle className="size-4 text-primary" /> Gecikmiş tahsilatlar
              </h3>
              {overdue.length === 0 ? (
                <p className="text-muted-foreground text-sm">3 günü aşan bekleyen ödeme yok.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-3">Sipariş</th>
                        <th className="p-3">Müşteri</th>
                        <th className="p-3">Durum</th>
                        <th className="p-3 text-right">Tutar</th>
                        <th className="p-3 text-right">Bekleme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdue.slice(0, 25).map((order) => (
                        <tr key={order.id} className="border-t">
                          <td className="p-3 font-medium">
                            <Link
                              to="/store/$storeId/orders/$orderId"
                              params={{ storeId, orderId: order.id }}
                              className="hover:underline"
                            >
                              #{order.orderNumber}
                            </Link>
                          </td>
                          <td className="p-3">{order.customerName}</td>
                          <td className="p-3">
                            <Badge variant="outline">{statusLabel(order.paymentStatus)}</Badge>
                          </td>
                          <td className="p-3 text-right">{formatMoney(order.grandTotal)}</td>
                          <td className="p-3 text-right">
                            <span className={order.ageDays > 14 ? "text-destructive font-medium" : undefined}>
                              {order.ageDays} gün
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
      <p className="font-display mt-1 text-2xl">{value}</p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
