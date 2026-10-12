import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { LineChart as LineChartIcon, Target, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { analyticsOrdersQuery, buildDailySeries } from "@/lib/analytics-queries";
import { dailyNeeded, forecastMonth, movingAverage, targetHitDate } from "@/lib/forecast";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/forecast")({
  head: () => ({
    meta: [
      { title: "Ciro Tahmini ve Hedef Takibi — Mefticaret" },
      {
        name: "description",
        content:
          "Ay sonu ciro tahmini, haftalık mevsimsellik katsayıları ve hedefe kalan günlük ciro ihtiyacını tek ekranda izleyin.",
      },
      { property: "og:title", content: "Ciro Tahmini ve Hedef Takibi — Mefticaret" },
      {
        property: "og:description",
        content: "28 ve 7 günlük hareketli ortalamalarla ay sonu ciro projeksiyonu ve hedef takibi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ForecastPage,
});

function ForecastPage() {
  const { storeId } = Route.useParams();
  const [target, setTarget] = useState("");

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: orders, isLoading } = useQuery(analyticsOrdersQuery(storeId, 90));
  const currency = store?.currency ?? "TRY";

  const series = useMemo(() => buildDailySeries(orders ?? [], 90), [orders]);
  const result = useMemo(() => forecastMonth(series), [series]);

  const targetValue = Number(target.replace(",", "."));
  const hasTarget = Number.isFinite(targetValue) && targetValue > 0;
  const needed = hasTarget ? dailyNeeded(targetValue, result.monthToDate, result.daysLeft) : 0;
  const hitDate = hasTarget ? targetHitDate(result.points, targetValue, result.monthToDate) : null;
  const targetProgress = hasTarget
    ? Math.min(100, Math.round((result.monthToDate / targetValue) * 100))
    : 0;

  const chartData = useMemo(
    () =>
      result.points.map((point) => ({
        label: point.date.slice(8, 10),
        actual: point.actual,
        forecast: point.forecast,
      })),
    [result.points],
  );

  const kpis = [
    { label: "Ay başından bugüne ciro", value: formatMoney(result.monthToDate, currency) },
    { label: "Ay sonu tahmini", value: formatMoney(result.projectedTotal, currency) },
    { label: "Kalan gün tahmini", value: formatMoney(result.projectedRemaining, currency) },
    { label: "Geçen ay", value: formatMoney(result.previousMonth, currency) },
  ];

  return (
    <AppShell storeId={storeId} title="Ciro Tahmini">
      <div className="space-y-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <TrendingUp className="size-5 text-primary" /> Ciro tahmini ve hedef takibi
          </h1>
          <p className="text-sm text-muted-foreground">
            28 ve 7 günlük hareketli ortalamalar, haftanın günlerine göre mevsimsellik katsayıları ile
            harmanlanarak ay sonu projeksiyonu hesaplanır.
          </p>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border bg-card p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                <p className="mt-1 text-2xl font-semibold">{kpi.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 lg:col-span-2">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <LineChartIcon className="size-4 text-primary" /> Bu ay: gerçekleşen ve tahmin
            </h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={70} />
                  <Tooltip
                    formatter={(value: number | string) => formatMoney(Number(value ?? 0), currency)}
                    labelFormatter={(label) => `Ayın ${label}. günü`}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    name="Gerçekleşen"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.2}
                    connectNulls
                  />
                  <Area
                    type="monotone"
                    dataKey="forecast"
                    name="Tahmin"
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="4 4"
                    fill="hsl(var(--muted-foreground))"
                    fillOpacity={0.1}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="flex items-center gap-2 text-sm font-medium">
                <Target className="size-4 text-primary" /> Aylık hedef
              </h2>
              <div className="mt-3 space-y-2">
                <Label htmlFor="forecast-target">Hedef ciro ({currency})</Label>
                <Input
                  id="forecast-target"
                  value={target}
                  inputMode="decimal"
                  placeholder="Örn: 250000"
                  onChange={(event) => setTarget(event.target.value)}
                />
              </div>
              {hasTarget ? (
                <div className="mt-4 space-y-3 text-sm">
                  <Progress value={targetProgress} />
                  <p className="text-muted-foreground">
                    Hedefin <span className="font-medium text-foreground">%{targetProgress}</span> tamamlandı.
                  </p>
                  <p>
                    Kalan {formatNumber(result.daysLeft)} gün için günlük gereken ciro:{" "}
                    <span className="font-medium">{formatMoney(needed, currency)}</span>
                  </p>
                  <p className="text-muted-foreground">
                    {hitDate
                      ? `Mevcut hıza göre hedef ${hitDate} tarihinde tutulur.`
                      : "Mevcut hıza göre hedef bu ay içinde tutulmuyor."}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Bir hedef girin; ilerleme, günlük gereken ciro ve tahmini tamamlanma tarihi hesaplanır.
                </p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4 text-sm">
              <h2 className="text-sm font-medium">Temel göstergeler</h2>
              <dl className="mt-3 space-y-2">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Günlük baz ciro</dt>
                  <dd className="font-medium">{formatMoney(result.level, currency)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">7 günlük ortalama</dt>
                  <dd className="font-medium">{formatMoney(movingAverage(series, 7), currency)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">28 günlük ortalama</dt>
                  <dd className="font-medium">{formatMoney(movingAverage(series, 28), currency)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Bu ay sipariş</dt>
                  <dd className="font-medium">{formatNumber(result.ordersToDate)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Ortalama sepet</dt>
                  <dd className="font-medium">{formatMoney(result.averageBasket, currency)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Geçen aya göre</dt>
                  <dd>
                    {result.growth === null ? (
                      <Badge variant="secondary">Kıyas yok</Badge>
                    ) : (
                      <Badge variant={result.growth >= 0 ? "default" : "destructive"}>
                        {result.growth >= 0 ? "+" : ""}
                        {Math.round(result.growth * 100)}%
                      </Badge>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
