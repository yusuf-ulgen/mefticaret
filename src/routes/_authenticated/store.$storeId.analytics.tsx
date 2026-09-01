import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Activity,
  CreditCard,
  Download,
  Eye,
  Globe2,
  MonitorSmartphone,
  MousePointerClick,
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { analyticsItemsQuery } from "@/lib/analytics-queries";
import {
  analyticsEventsQuery,
  analyticsRangeOrdersQuery,
  buildTrafficSeries,
  summarizeEvents,
} from "@/lib/analytics-events-queries";
import { buildRange, RANGE_PRESETS, type RangePreset } from "@/lib/analytics-range";
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

const DEVICE_LABELS: Record<string, string> = {
  desktop: "Masaüstü",
  mobile: "Mobil",
  tablet: "Tablet",
  bilinmiyor: "Bilinmiyor",
};

export const Route = createFileRoute("/_authenticated/store/$storeId/analytics")({
  head: () => ({
    meta: [
      { title: "Analitik & Raporlar — Mefticaret" },
      {
        name: "description",
        content:
          "Ziyaretçi, oturum, dönüşüm hunisi, trafik kaynağı, cihaz ve ülke kırılımlarıyla mağaza analitiği.",
      },
      { property: "og:title", content: "Analitik & Raporlar — Mefticaret" },
      { property: "og:description", content: "Ziyaretçiden satın almaya tüm dönüşüm hunisini dönemsel izle." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { storeId } = Route.useParams();
  const [preset, setPreset] = useState<RangePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const range = useMemo(() => buildRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const days = range.days;

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: orders, isLoading } = useQuery(analyticsRangeOrdersQuery(storeId, range));
  const { data: items } = useQuery(analyticsItemsQuery(storeId, days));
  const { data: events, isLoading: eventsLoading } = useQuery(analyticsEventsQuery(storeId, range));

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

  const series = useMemo(() => buildTrafficSeries(events ?? [], rows, range), [events, rows, range]);

  const traffic = useMemo(
    () => summarizeEvents(events ?? [], summary.revenue, summary.orders),
    [events, summary.revenue, summary.orders],
  );

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

  /** Aynı e-posta/müşteri ile birden fazla sipariş verenler "geri dönen" sayılır. */
  const retention = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = (row.customer_email ?? row.customer_id ?? "").toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const identified = [...counts.values()];
    const returning = identified.filter((count) => count > 1).length;
    const newBuyers = identified.filter((count) => count === 1).length;
    return {
      returning,
      newBuyers,
      ratio: identified.length > 0 ? (returning / identified.length) * 100 : 0,
    };
  }, [rows]);

  /** Günün hangi saatlerinde sipariş geldiğini gösterir. */
  const hourly = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, revenue: 0 }));
    for (const row of rows) {
      const stamp = new Date(row.placed_at ?? row.created_at);
      const bucket = buckets[stamp.getHours()];
      if (!bucket) continue;
      bucket.orders += 1;
      bucket.revenue += Number(row.grand_total ?? 0);
    }
    return buckets;
  }, [rows]);

  const peakOrders = useMemo(() => Math.max(1, ...hourly.map((bucket) => bucket.orders)), [hourly]);

  const coupons = useMemo(() => {
    const map = new Map<string, { code: string; orders: number; discount: number; revenue: number }>();
    for (const row of rows) {
      const code = row.discount_code?.trim();
      if (!code) continue;
      const entry = map.get(code) ?? { code, orders: 0, discount: 0, revenue: 0 };
      entry.orders += 1;
      entry.discount += Number(row.discount_total ?? 0);
      entry.revenue += Number(row.grand_total ?? 0);
      map.set(code, entry);
    }
    return [...map.values()].sort((a, b) => b.orders - a.orders).slice(0, 6);
  }, [rows]);

  function exportReport() {
    const content = toCsv(
      ["tarih", "ziyaretci", "oturum", "sayfa_goruntuleme", "satin_alma", "siparis", "ciro", "donusum_yuzde"],
      series.map((point) => [
        point.date,
        point.visitors,
        point.sessions,
        point.pageViews,
        point.purchases,
        point.orders,
        point.revenue.toFixed(2),
        point.conversion.toFixed(2),
      ]),
    );
    downloadCsv(`analitik-${range.from}_${range.to}.csv`, content);
  }

  const cards = [
    { label: "Ziyaretçi", value: formatNumber(traffic.visitors), icon: Users },
    { label: "Oturum", value: formatNumber(traffic.sessions), icon: Activity },
    { label: "Sayfa görüntüleme", value: formatNumber(traffic.pageViews), icon: Eye },
    { label: "Ürün görüntüleme", value: formatNumber(traffic.productViews), icon: MousePointerClick },
    { label: "Sepete ekleme", value: formatNumber(traffic.addToCart), icon: ShoppingBag },
    { label: "Dönüşüm oranı", value: formatPercent(traffic.conversion), icon: Percent },
    { label: "Ciro", value: formatMoney(summary.revenue, currency), icon: TrendingUp },
    { label: "Ortalama sepet", value: formatMoney(summary.aov, currency), icon: CreditCard },
    { label: "Sipariş", value: formatNumber(summary.orders), icon: ShoppingBag },
    { label: "Ödeme tamamlanma", value: formatPercent(summary.paidRatio), icon: Activity },
    { label: "Alıcı sayısı", value: formatNumber(summary.buyers), icon: Users },
    { label: "Tekrar eden müşteri", value: formatPercent(retention.ratio), icon: Repeat },
  ];

  const funnel = [
    { label: "Oturum", value: traffic.sessions },
    { label: "Ürün görüntüleme", value: traffic.productViews },
    { label: "Sepete ekleme", value: traffic.cartSessions },
    { label: "Checkout", value: traffic.checkoutSessions },
    { label: "Satın alma", value: traffic.purchaseSessions },
  ];
  const funnelPeak = Math.max(1, ...funnel.map((step) => step.value));

  const breakdowns = [
    { title: "Trafik kaynağı", rows: traffic.sources, icon: Globe2, mapLabel: (key: string) => (key === "direct" ? "Doğrudan" : key) },
    { title: "Cihaz", rows: traffic.devices, icon: MonitorSmartphone, mapLabel: (key: string) => DEVICE_LABELS[key] ?? key },
    { title: "Ülke", rows: traffic.countries, icon: Globe2, mapLabel: (key: string) => key },
    { title: "Referrer", rows: traffic.referrers, icon: MousePointerClick, mapLabel: (key: string) => key },
  ];

  return (
    <AppShell
      storeId={storeId}
      title="Analitik & Raporlar"
      description="Ziyaretçi, oturum, dönüşüm hunisi, trafik kaynağı, cihaz ve ülke kırılımları."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 p-1">
            {RANGE_PRESETS.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={preset === item.id ? "default" : "ghost"}
                onClick={() => setPreset(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          {preset === "custom" ? (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="h-9 w-[150px]"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(event) => setCustomTo(event.target.value)}
                className="h-9 w-[150px]"
              />
            </div>
          ) : null}
          <Button size="sm" variant="outline" onClick={exportReport} disabled={series.length === 0}>
            <Download className="mr-2 size-4" /> CSV indir
          </Button>
        </div>
      }
    >
      <p className="text-xs text-muted-foreground">
        Dönem: {formatDate(range.from)} – {formatDate(range.to)} ({days} gün)
      </p>

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

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface-card p-6">
          <h2 className="font-display text-lg font-semibold">Saatlik sipariş yoğunluğu</h2>
          <p className="text-sm text-muted-foreground">
            Kampanya ve reklam saatlerini planlamak için günün sipariş dağılımı.
          </p>
          <div className="mt-6 flex h-40 items-end gap-1">
            {hourly.map((bucket) => (
              <div key={bucket.hour} className="flex flex-1 flex-col items-center gap-1" title={`${bucket.hour}:00 — ${bucket.orders} sipariş`}>
                <div
                  className="w-full rounded-t bg-primary/70"
                  style={{ height: `${(bucket.orders / peakOrders) * 100}%`, minHeight: bucket.orders > 0 ? 4 : 1 }}
                />
                {bucket.hour % 3 === 0 ? (
                  <span className="text-[10px] text-muted-foreground">{bucket.hour}</span>
                ) : (
                  <span className="text-[10px] text-transparent">·</span>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-6">
          <h2 className="font-display text-lg font-semibold">Kupon performansı</h2>
          <p className="text-sm text-muted-foreground">
            Yeni müşteri: {formatNumber(retention.newBuyers)} · Tekrar eden: {formatNumber(retention.returning)}
          </p>
          {coupons.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Bu dönemde kupon kullanılmadı.</p>
          ) : (
            <ul className="mt-4 space-y-3 text-sm">
              {coupons.map((coupon) => (
                <li key={coupon.code} className="flex items-center justify-between gap-3">
                  <Badge variant="secondary" className="font-mono uppercase">
                    {coupon.code}
                  </Badge>
                  <span className="flex items-center gap-3 whitespace-nowrap text-muted-foreground">
                    {formatNumber(coupon.orders)} sipariş
                    <span className="text-foreground">{formatMoney(coupon.revenue, currency)}</span>
                    <span>-{formatMoney(coupon.discount, currency)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

    </AppShell>
  );
}
