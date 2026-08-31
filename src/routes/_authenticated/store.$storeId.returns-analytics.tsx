import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import {
  reasonBreakdown,
  returnAnalyticsSummary,
  returnTrend,
  returnedProducts,
  statusBreakdown,
} from "@/lib/returns-analytics";
import { returnAnalyticsQuery } from "@/lib/returns-analytics-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/returns-analytics")({
  head: () => ({
    meta: [
      { title: "İade Analizi — Mefticaret" },
      {
        name: "description",
        content:
          "İade oranını, iade sebeplerini, en çok iade edilen ürünleri ve çözüm sürelerini tek ekranda ölç.",
      },
      { property: "og:title", content: "İade Analizi — Mefticaret" },
      {
        property: "og:description",
        content: "İade oranı, sebep dağılımı, en çok iade edilen ürünler ve ortalama çözüm süresi raporu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReturnsAnalyticsPage,
});

function ReturnsAnalyticsPage() {
  const { storeId } = Route.useParams();
  const [windowDays, setWindowDays] = useState(90);

  const { data, isLoading } = useQuery(returnAnalyticsQuery(storeId, windowDays));
  const input = data ?? { returns: [], orders: [] };

  const summary = useMemo(() => returnAnalyticsSummary(input), [input]);
  const reasons = useMemo(() => reasonBreakdown(input), [input]);
  const statuses = useMemo(() => statusBreakdown(input), [input]);
  const products = useMemo(() => returnedProducts(input).slice(0, 20), [input]);
  const trend = useMemo(() => returnTrend(input, windowDays), [input, windowDays]);

  const exportCsv = () => {
    downloadCsv(
      `iade-analizi-${storeId}.csv`,
      toCsv(
        ["Ürün", "İade adet", "İade tutarı", "Talep sayısı"],
        products.map((line) => [line.title, line.quantity, line.amount.toFixed(2), line.returnCount]),
      ),
    );
  };

  return (
    <AppShell storeId={storeId}>
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <RotateCcw className="size-5 text-primary" /> İade Analizi
            </h1>
            <p className="text-sm text-muted-foreground">
              Son {windowDays} günde iade oranı, sebep dağılımı ve problemli ürünler.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="window">Analiz penceresi (gün)</Label>
              <Input
                id="window"
                type="number"
                min={7}
                max={365}
                className="w-32"
                value={windowDays}
                onChange={(event) =>
                  setWindowDays(Math.min(365, Math.max(7, Number(event.target.value) || 90)))
                }
              />
            </div>
            <Button variant="outline" onClick={exportCsv} disabled={products.length === 0}>
              <Download className="mr-2 size-4" /> CSV
            </Button>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="İade oranı"
            value={`${(summary.returnRate * 100).toFixed(1)}%`}
            hint={`${formatNumber(summary.returnCount)} iade / ${formatNumber(summary.orderCount)} sipariş`}
          />
          <Kpi
            label="İade edilen tutar"
            value={formatMoney(summary.refundedAmount)}
            hint={`Ciroya oranı ${(summary.refundRate * 100).toFixed(1)}%`}
          />
          <Kpi
            label="Ortalama iade tutarı"
            value={formatMoney(summary.averageRefund)}
            hint={`Talep edilen toplam ${formatMoney(summary.requestedAmount)}`}
          />
          <Kpi
            label="Ortalama çözüm süresi"
            value={
              summary.averageResolutionDays == null
                ? "—"
                : `${summary.averageResolutionDays.toFixed(1)} gün`
            }
            hint={`Kabul/iade edilen oran ${(summary.restockedRate * 100).toFixed(0)}%`}
          />
        </div>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Günlük iade akışı</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} tickFormatter={(value) => String(value).slice(5)} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="returns"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.2)"
                  name="İade"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">İade sebepleri</h2>
            {reasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">Bu dönemde iade kaydı yok.</p>
            ) : (
              <ul className="space-y-3">
                {reasons.map((row) => (
                  <li key={row.reason} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{row.label}</span>
                      <span className="text-muted-foreground">
                        {formatNumber(row.count)} · {formatMoney(row.amount)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round(row.share * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Durum dağılımı</h2>
            {statuses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kayıt bulunmuyor.</p>
            ) : (
              <ul className="space-y-2">
                {statuses.map((row) => (
                  <li key={row.status} className="flex items-center justify-between text-sm">
                    <Badge variant="outline">{row.label}</Badge>
                    <span className="text-muted-foreground">
                      {formatNumber(row.count)} talep · {formatMoney(row.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="rounded-xl border bg-card">
          <div className="border-b p-5">
            <h2 className="text-sm font-semibold">En çok iade edilen ürünler</h2>
          </div>
          {isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Yükleniyor…</p>
          ) : products.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Bu dönemde iade edilen ürün yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Ürün</th>
                    <th className="p-3 text-right">İade adet</th>
                    <th className="p-3 text-right">Tutar</th>
                    <th className="p-3 text-right">Talep</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((line) => (
                    <tr key={line.title} className="border-t">
                      <td className="p-3">{line.title}</td>
                      <td className="p-3 text-right">{formatNumber(line.quantity)}</td>
                      <td className="p-3 text-right">{formatMoney(line.amount)}</td>
                      <td className="p-3 text-right">{formatNumber(line.returnCount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
