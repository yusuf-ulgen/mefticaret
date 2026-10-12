import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import {
  bestDay,
  computeTotals,
  couponUsage,
  currentMonthKey,
  dailyBreakdown,
  delta,
  recentMonthKeys,
  topProducts,
} from "@/lib/monthly-report";
import { monthlyReportQuery } from "@/lib/monthly-report-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/report-monthly")({
  head: () => ({
    meta: [
      { title: "Aylık İşletme Raporu — Mefticaret" },
      {
        name: "description",
        content:
          "Seçtiğin ay için ciro, sipariş, kupon ve en çok satan ürün özetini önceki ayla karşılaştır, yazdır veya CSV olarak indir.",
      },
      { property: "og:title", content: "Aylık İşletme Raporu — Mefticaret" },
      {
        property: "og:description",
        content: "Ay bazlı ciro, sipariş, ortalama sepet ve ürün performansı özeti.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MonthlyReportPage,
});

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) return <Badge variant="outline">yeni</Badge>;
  const up = value >= 0;
  return (
    <Badge variant={up ? "default" : "secondary"} className="gap-1">
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {`${up ? "+" : ""}${value.toFixed(1)}%`}
    </Badge>
  );
}

function MonthlyReportPage() {
  const { storeId } = Route.useParams();
  const months = useMemo(() => recentMonthKeys(12), []);
  const [monthKey, setMonthKey] = useState(() => currentMonthKey());

  const { data, isLoading } = useQuery(monthlyReportQuery(storeId, monthKey));

  const totals = useMemo(
    () => computeTotals(data?.orders ?? [], data?.items ?? []),
    [data],
  );
  const previousTotals = useMemo(
    () => computeTotals(data?.previousOrders ?? [], data?.previousItems ?? []),
    [data],
  );
  const daily = useMemo(
    () => (data ? dailyBreakdown(data.orders, data.range) : []),
    [data],
  );
  const peak = useMemo(() => bestDay(daily), [daily]);
  const products = useMemo(() => topProducts(data?.items ?? []), [data]);
  const coupons = useMemo(() => couponUsage(data?.orders ?? []), [data]);

  const exportCsv = () => {
    downloadCsv(
      `aylik-rapor-${monthKey}.csv`,
      toCsv(
        ["Tarih", "Ciro", "Sipariş"],
        daily.map((line) => [line.date, line.revenue.toFixed(2), String(line.orders)]),
      ),
    );
  };

  const kpis = [
    { label: "Ciro", value: formatMoney(totals.revenue), change: delta(totals.revenue, previousTotals.revenue) },
    { label: "Sipariş", value: formatNumber(totals.orders), change: delta(totals.orders, previousTotals.orders) },
    {
      label: "Ortalama sepet",
      value: formatMoney(totals.averageOrderValue),
      change: delta(totals.averageOrderValue, previousTotals.averageOrderValue),
    },
    {
      label: "Satılan adet",
      value: formatNumber(totals.units),
      change: delta(totals.units, previousTotals.units),
    },
  ];

  return (
    <AppShell
      storeId={storeId}
      title="Aylık İşletme Raporu"
      description="Dönem performansını önceki ayla karşılaştır, yönetim için yazdır."
    >
      <div className="space-y-8">
        <header className="flex flex-wrap items-end justify-end gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Dönem</Label>
              <Select value={monthKey} onValueChange={setMonthKey}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.key} value={month.key}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={exportCsv} disabled={!daily.length}>
              <Download className="mr-2 size-4" /> CSV
            </Button>
            <Button onClick={() => window.print()} disabled={!data}>
              <Printer className="mr-2 size-4" /> Yazdır
            </Button>
          </div>
        </header>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Rapor hazırlanıyor…</p>
        ) : (
          <div id="report-print-area" className="space-y-8">
            <div>
              <h2 className="font-display text-xl">
                {data?.range.label} raporu
              </h2>
              <p className="text-muted-foreground text-sm">
                Karşılaştırma dönemi: {data?.previousRange.label}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kpis.map((kpi) => (
                <div key={kpi.label} className="rounded-xl border p-4">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">{kpi.label}</p>
                  <p className="font-display mt-2 text-2xl">{kpi.value}</p>
                  <div className="mt-2">
                    <DeltaBadge value={kpi.change} />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border p-4">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Ürün tutarı / Kargo</p>
                <p className="mt-2 text-sm">
                  {formatMoney(totals.subtotal)} + {formatMoney(totals.shipping)} kargo
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  İndirim: {formatMoney(totals.discounts)}
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">Sipariş durumu</p>
                <p className="mt-2 text-sm">{formatNumber(totals.paidOrders)} ödenmiş sipariş</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {formatNumber(totals.cancelledOrders)} iptal · {formatNumber(totals.uniqueCustomers)} farklı müşteri
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-muted-foreground text-xs uppercase tracking-wide">En iyi gün</p>
                <p className="mt-2 text-sm">{peak ? peak.date : "—"}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {peak ? `${formatMoney(peak.revenue)} · ${formatNumber(peak.orders)} sipariş` : "Veri yok"}
                </p>
              </div>
            </div>

            <section className="space-y-3">
              <h3 className="font-display text-lg">En çok satan ürünler</h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3">Ürün</th>
                      <th className="p-3 text-right">Adet</th>
                      <th className="p-3 text-right">Ciro</th>
                      <th className="p-3 text-right">Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-muted-foreground p-4">
                          Bu dönemde satış kaydı yok.
                        </td>
                      </tr>
                    ) : (
                      products.map((line) => (
                        <tr key={line.title} className="border-t">
                          <td className="p-3">{line.title}</td>
                          <td className="p-3 text-right">{formatNumber(line.units)}</td>
                          <td className="p-3 text-right">{formatMoney(line.revenue)}</td>
                          <td className="p-3 text-right">{line.share.toFixed(1)}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg">Kupon kullanımı</h3>
              {coupons.length === 0 ? (
                <p className="text-muted-foreground text-sm">Bu dönemde kupon kullanılmadı.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-3">Kod</th>
                        <th className="p-3 text-right">Sipariş</th>
                        <th className="p-3 text-right">İndirim</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coupons.map((coupon) => (
                        <tr key={coupon.code} className="border-t">
                          <td className="p-3 font-mono text-xs uppercase">{coupon.code}</td>
                          <td className="p-3 text-right">{formatNumber(coupon.orders)}</td>
                          <td className="p-3 text-right">{formatMoney(coupon.discount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg">Günlük döküm</h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3">Tarih</th>
                      <th className="p-3 text-right">Sipariş</th>
                      <th className="p-3 text-right">Ciro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daily.map((line) => (
                      <tr key={line.date} className="border-t">
                        <td className="p-3">{line.date}</td>
                        <td className="p-3 text-right">{formatNumber(line.orders)}</td>
                        <td className="p-3 text-right">{formatMoney(line.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
