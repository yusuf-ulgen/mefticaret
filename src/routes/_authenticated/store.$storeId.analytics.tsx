import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Activity,
  CreditCard,
  Download,
  Percent,
  Repeat,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { analyticsItemsQuery, analyticsOrdersQuery, buildDailySeries } from "@/lib/analytics-queries";
import { storeQuery } from "@/lib/store-queries";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatPercent,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/mefti";


const RANGES = [7, 30, 90] as const;

export const Route = createFileRoute("/_authenticated/store/$storeId/analytics")({
  head: () => ({
    meta: [
      { title: "Analitik & Raporlar — Mefticaret" },
      {
        name: "description",
        content: "Ciro trendi, sepet ortalaması, en çok satan ürünler ve sipariş durum dağılımı raporları.",
      },
      { property: "og:title", content: "Analitik & Raporlar — Mefticaret" },
      { property: "og:description", content: "Mağazanın satış performansını dönemsel raporlarla incele." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { storeId } = Route.useParams();
  const [days, setDays] = useState<number>(30);
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: orders, isLoading } = useQuery(analyticsOrdersQuery(storeId, days));
  const { data: items } = useQuery(analyticsItemsQuery(storeId, days));

  const currency = store?.currency ?? "TRY";
  const rows = orders ?? [];

  const summary = useMemo(() => {
    const revenue = rows.reduce((total, row) => total + Number(row.grand_total ?? 0), 0);
    const discount = rows.reduce((total, row) => total + Number(row.discount_total ?? 0), 0);
    const paid = rows.filter((row) => row.payment_status === "paid").length;
    const buyers = new Set(rows.map((row) => row.customer_email ?? row.customer_id ?? row.id));
    return {
      revenue,
      discount,
      orders: rows.length,
      aov: rows.length > 0 ? revenue / rows.length : 0,
      paidRatio: rows.length > 0 ? (paid / rows.length) * 100 : 0,
      buyers: buyers.size,
    };
  }, [rows]);

  const series = useMemo(() => buildDailySeries(rows as never[], days), [rows, days]);

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.status, (map.get(row.status) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) map.set(row.payment_status, (map.get(row.payment_status) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const topProducts = useMemo(() => {
    const map = new Map<string, { title: string; quantity: number; revenue: number }>();
    for (const item of items ?? []) {
      const key = item.title;
      const entry = map.get(key) ?? { title: key, quantity: 0, revenue: 0 };
      entry.quantity += Number(item.quantity ?? 0);
      entry.revenue += Number(item.line_total ?? 0);
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  }, [items]);

  const cards = [
    { label: `Ciro (${days} gün)`, value: formatMoney(summary.revenue, currency), icon: TrendingUp },
    { label: "Sipariş", value: formatNumber(summary.orders), icon: ShoppingBag },
    { label: "Sepet ortalaması", value: formatMoney(summary.aov, currency), icon: CreditCard },
    { label: "Ödeme tamamlanma", value: formatPercent(summary.paidRatio), icon: Activity },
    { label: "Alıcı sayısı", value: formatNumber(summary.buyers), icon: Users },
    { label: "İndirim tutarı", value: formatMoney(summary.discount, currency), icon: Percent },
  ];

  return (
    <AppShell
      storeId={storeId}
      title="Analitik & Raporlar"
      description="Dönemsel satış performansı, ürün kırılımı ve sipariş durum dağılımı."
      actions={
        <div className="flex gap-1 rounded-lg border border-border/60 p-1">
          {RANGES.map((range) => (
            <Button
              key={range}
              size="sm"
              variant={days === range ? "default" : "ghost"}
              onClick={() => setDays(range)}
            >
              {range} gün
            </Button>
          ))}
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="surface-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{card.label}</span>
              <card.icon className="size-4 text-brand-foreground" />
            </div>
            <p className="mt-2 font-display text-2xl font-semibold">
              {isLoading ? <Skeleton className="h-7 w-24" /> : card.value}
            </p>
          </div>
        ))}
      </div>

      <section className="surface-card p-6">
        <h2 className="font-display text-lg font-semibold">Ciro trendi</h2>
        <p className="text-sm text-muted-foreground">Siparişlerin günlük toplamı.</p>
        {isLoading ? (
          <Skeleton className="mt-6 h-64 w-full" />
        ) : (
          <div className="mt-6 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value: string) => formatDate(value).slice(0, 6)}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  className="text-muted-foreground"
                />
                <YAxis tick={{ fontSize: 11 }} stroke="currentColor" className="text-muted-foreground" width={64} />
                <Tooltip
                  formatter={(value: number) => formatMoney(Number(value), currency)}
                  labelFormatter={(label: string) => formatDate(label)}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#revenueFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface-card p-6">
          <h2 className="font-display text-lg font-semibold">En çok satan ürünler</h2>
          {topProducts.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Bu dönemde satış yok.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {topProducts.map((product) => (
                <li key={product.title} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{product.title}</span>
                  <span className="flex items-center gap-3 whitespace-nowrap text-muted-foreground">
                    <Badge variant="secondary">{formatNumber(product.quantity)} adet</Badge>
                    {formatMoney(product.revenue, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="surface-card p-6">
          <h2 className="font-display text-lg font-semibold">Durum dağılımı</h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Sipariş durumu</p>
              <ul className="mt-3 space-y-2 text-sm">
                {statusBreakdown.length === 0 ? (
                  <li className="text-muted-foreground">Veri yok</li>
                ) : (
                  statusBreakdown.map(([status, count]) => (
                    <li key={status} className="flex justify-between gap-3">
                      <span>{ORDER_STATUS_LABELS[status] ?? status}</span>
                      <span className="text-muted-foreground">{formatNumber(count)}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Ödeme durumu</p>
              <ul className="mt-3 space-y-2 text-sm">
                {paymentBreakdown.length === 0 ? (
                  <li className="text-muted-foreground">Veri yok</li>
                ) : (
                  paymentBreakdown.map(([status, count]) => (
                    <li key={status} className="flex justify-between gap-3">
                      <span>{PAYMENT_STATUS_LABELS[status] ?? status}</span>
                      <span className="text-muted-foreground">{formatNumber(count)}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
