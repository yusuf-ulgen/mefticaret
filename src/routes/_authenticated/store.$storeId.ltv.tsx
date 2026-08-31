import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Repeat } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv, toCsv } from "@/lib/csv";
import { buildLtvCustomers, ltvBuckets, ltvSummary } from "@/lib/ltv";
import { ltvOrdersQuery } from "@/lib/ltv-queries";
import { formatDate, formatMoney, formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/ltv")({
  head: () => ({
    meta: [
      { title: "Müşteri Yaşam Boyu Değeri (LTV) — Mefticaret" },
      {
        name: "description",
        content:
          "Müşteri başına ortalama ve medyan yaşam boyu değeri, tekrar satın alma oranı, harcama dilimleri ve en değerli müşteri listesi.",
      },
      { property: "og:title", content: "Müşteri Yaşam Boyu Değeri (LTV) — Mefticaret" },
      {
        property: "og:description",
        content: "LTV, AOV, sipariş frekansı ve tekrar alım oranıyla müşteri değeri analizi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LtvPage,
});

function LtvPage() {
  const { storeId } = Route.useParams();
  const [horizon, setHorizon] = useState(12);
  const [onlyRepeat, setOnlyRepeat] = useState(false);

  const { data: orders, isLoading } = useQuery(ltvOrdersQuery(storeId));
  const customers = useMemo(() => buildLtvCustomers(orders ?? []), [orders]);
  const summary = useMemo(() => ltvSummary(customers, horizon), [customers, horizon]);
  const buckets = useMemo(() => ltvBuckets(customers), [customers]);

  const visible = onlyRepeat ? customers.filter((customer) => customer.orders > 1) : customers;

  const exportCsv = () => {
    downloadCsv(
      `ltv-analizi-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ["Müşteri", "E-posta", "Sipariş", "Toplam ciro", "Ortalama sepet", "İlk sipariş", "Son sipariş", "Sipariş aralığı (gün)"],
        visible.map((customer) => [
          customer.name,
          customer.email ?? "",
          String(customer.orders),
          customer.revenue.toFixed(2),
          customer.averageOrderValue.toFixed(2),
          customer.firstOrderAt.slice(0, 10),
          customer.lastOrderAt.slice(0, 10),
          customer.purchaseIntervalDays === null ? "" : customer.purchaseIntervalDays.toFixed(1),
        ]),
      ),
    );
  };

  const kpis = [
    { label: "Ortalama LTV", value: formatMoney(summary.averageLtv) },
    { label: "Medyan LTV", value: formatMoney(summary.medianLtv) },
    { label: "Ortalama sepet", value: formatMoney(summary.averageOrderValue) },
    { label: `Öngörülen ${horizon} ay LTV`, value: formatMoney(summary.predictedLtv) },
  ];

  return (
    <AppShell
      storeId={storeId}
      title="Müşteri Yaşam Boyu Değeri"
      description="Müşteri başına toplam değeri, tekrar alım oranını ve harcama dilimlerini ölç."
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="horizon">Projeksiyon (ay)</Label>
            <Input
              id="horizon"
              type="number"
              min={1}
              max={60}
              className="w-32"
              value={horizon}
              onChange={(event) => setHorizon(Math.min(60, Math.max(1, Number(event.target.value) || 12)))}
            />
          </div>
          <Button variant={onlyRepeat ? "default" : "outline"} onClick={() => setOnlyRepeat((value) => !value)}>
            <Repeat className="mr-2 size-4" /> Sadece tekrar edenler
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={!visible.length}>
            <Download className="mr-2 size-4" /> CSV
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Analiz hesaplanıyor…</p>
        ) : customers.length === 0 ? (
          <p className="text-muted-foreground text-sm">Henüz LTV hesaplanacak sipariş yok.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="rounded-xl border p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">{kpi.label}</p>
                  <p className="font-display mt-2 text-2xl">{kpi.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border p-4">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Tekrar alım oranı</p>
                <p className="font-display mt-2 text-2xl">{summary.repeatRate.toFixed(1)}%</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {formatNumber(summary.customers)} müşteri · {summary.averageFrequency.toFixed(2)} sipariş/müşteri
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">En değerli %20</p>
                <p className="font-display mt-2 text-2xl">{summary.topShare.toFixed(1)}%</p>
                <p className="text-muted-foreground mt-1 text-sm">cironun bu kadarını üretiyor</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Toplam müşteri cirosu</p>
                <p className="font-display mt-2 text-2xl">{formatMoney(summary.revenue)}</p>
              </div>
            </div>

            <section className="space-y-3">
              <h3 className="font-display text-lg">Harcama dilimleri</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {buckets.map((bucket) => (
                  <div key={bucket.label} className="rounded-xl border p-4">
                    <p className="text-muted-foreground text-xs">{bucket.label}</p>
                    <p className="font-display mt-2 text-xl">{formatNumber(bucket.customers)}</p>
                    <p className="text-muted-foreground mt-1 text-xs">{formatMoney(bucket.revenue)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg">En değerli müşteriler</h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3">Müşteri</th>
                      <th className="p-3 text-right">Sipariş</th>
                      <th className="p-3 text-right">Toplam</th>
                      <th className="p-3 text-right">Ort. sepet</th>
                      <th className="p-3 text-right">Aralık</th>
                      <th className="p-3 text-right">Son sipariş</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.slice(0, 100).map((customer) => (
                      <tr key={customer.key} className="border-t">
                        <td className="p-3">
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-muted-foreground text-xs">{customer.email ?? "—"}</div>
                        </td>
                        <td className="p-3 text-right">
                          {customer.orders > 1 ? (
                            <Badge variant="default">{formatNumber(customer.orders)}</Badge>
                          ) : (
                            formatNumber(customer.orders)
                          )}
                        </td>
                        <td className="p-3 text-right">{formatMoney(customer.revenue)}</td>
                        <td className="p-3 text-right">{formatMoney(customer.averageOrderValue)}</td>
                        <td className="p-3 text-right">
                          {customer.purchaseIntervalDays === null
                            ? "—"
                            : `${customer.purchaseIntervalDays.toFixed(0)} gün`}
                        </td>
                        <td className="p-3 text-right">{formatDate(customer.lastOrderAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
