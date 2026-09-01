import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Gauge, Radar } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import {
  RISK_LABELS,
  buildStockoutRows,
  coverDistribution,
  stockoutSummary,
  type StockoutRow,
} from "@/lib/stockout";
import { stockoutDataQuery } from "@/lib/stockout-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/stockout")({
  head: () => ({
    meta: [
      { title: "Stok Tükenme Radarı — Mefticaret" },
      {
        name: "description",
        content:
          "Satış hızına göre stok kapsama günü, tahmini tükenme tarihi ve risk altındaki ciroyu görerek tedariki zamanında planla.",
      },
      { property: "og:title", content: "Stok Tükenme Radarı — Mefticaret" },
      {
        property: "og:description",
        content: "Hangi varyant kaç gün sonra tükenecek, ne kadar ciro riskte? Kritik listeyi tek ekranda gör.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StockoutPage,
});

const WINDOWS = [7, 14, 30];

function riskVariant(row: StockoutRow): "default" | "destructive" | "outline" | "secondary" {
  if (row.risk === "out" || row.risk === "critical") return "destructive";
  if (row.risk === "warning") return "default";
  if (row.risk === "idle") return "secondary";
  return "outline";
}

function coverLabel(row: StockoutRow) {
  if (row.stock <= 0) return "0 gün";
  if (row.daysOfCover == null) return "—";
  return `${row.daysOfCover.toFixed(row.daysOfCover < 10 ? 1 : 0)} gün`;
}

function StockoutPage() {
  const { storeId } = Route.useParams();
  const [recentDays, setRecentDays] = useState(14);
  const [onlyRisky, setOnlyRisky] = useState(true);
  const { data, isLoading } = useQuery(stockoutDataQuery(storeId, recentDays));

  const rows = useMemo(() => buildStockoutRows(data ?? [], recentDays), [data, recentDays]);
  const summary = useMemo(() => stockoutSummary(rows), [rows]);
  const buckets = useMemo(() => coverDistribution(rows), [rows]);
  const maxBucket = Math.max(1, ...buckets.map((bucket) => bucket.count));

  const visible = onlyRisky
    ? rows.filter((row) => row.risk === "out" || row.risk === "critical" || row.risk === "warning")
    : rows;

  const exportRows = () => {
    downloadCsv(
      `stok-tukenme-${storeId}.csv`,
      toCsv(
        ["Varyant", "SKU", "Stok", "Günlük satış", "Kapsama (gün)", "Tükenme tarihi", "Riskli ciro", "Durum"],
        visible.slice(0, 500).map((row) => [
          row.title,
          row.sku ?? "",
          row.stock,
          row.velocity.toFixed(2),
          row.daysOfCover == null ? "" : row.daysOfCover.toFixed(1),
          row.stockoutDate ?? "",
          row.revenueAtRisk.toFixed(2),
          RISK_LABELS[row.risk],
        ]),
      ),
    );
  };

  return (
    <AppShell
      storeId={storeId}
      title="Stok Tükenme Radarı"
      description="Satış hızını stoğa oranlayarak hangi varyantın ne zaman tükeneceğini ve ne kadar ciro kaybı doğacağını gör."
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-2">
          {WINDOWS.map((window) => (
            <Button
              key={window}
              size="sm"
              variant={recentDays === window ? "default" : "outline"}
              onClick={() => setRecentDays(window)}
            >
              {window} günlük hız
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={() => setOnlyRisky((value) => !value)}>
            {onlyRisky ? "Tümünü göster" : "Sadece riskliler"}
          </Button>
          {visible.length > 0 ? (
            <Button size="sm" variant="outline" className="ml-auto" onClick={exportRows}>
              Listeyi indir (CSV)
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Stok hızı hesaplanıyor…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Henüz varyant bulunmuyor.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label="Kritik varyant"
                value={formatNumber(summary.criticalCount)}
                hint={`${formatNumber(summary.warningCount)} varyant uyarı bandında`}
              />
              <Kpi
                label="Tükenen stok"
                value={formatNumber(summary.outOfStock)}
                hint={`${formatNumber(summary.urgentRestock)} tanesi aktif satışta`}
              />
              <Kpi
                label="30 günde riskli ciro"
                value={formatMoney(summary.revenueAtRisk)}
                hint="Tükenme sonrası kaçırılacak tahmini satış"
              />
              <Kpi
                label="Ort. stok kapsama"
                value={`${summary.avgDaysOfCover.toFixed(1)} gün`}
                hint={`${formatNumber(summary.trackedVariants)} varyant izleniyor`}
              />
            </div>

            <section className="space-y-3 rounded-xl border p-5">
              <h3 className="font-display flex items-center gap-2 text-lg">
                <Gauge className="size-4 text-primary" /> Stok kapsama dağılımı
              </h3>
              {buckets.map((bucket) => (
                <div key={bucket.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{bucket.label}</span>
                    <span className="text-muted-foreground">
                      {formatNumber(bucket.count)} varyant · {formatMoney(bucket.revenueAtRisk)} risk
                    </span>
                  </div>
                  <div className="bg-muted h-3 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${Math.round((bucket.count / maxBucket) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h3 className="font-display flex items-center gap-2 text-lg">
                <Radar className="size-4 text-primary" /> Tükenme takvimi
              </h3>
              {visible.length === 0 ? (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <AlertTriangle className="size-4" /> Risk bandında varyant yok, stok seviyeleri sağlıklı.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-3">Varyant</th>
                        <th className="p-3 text-right">Stok</th>
                        <th className="p-3 text-right">Günlük satış</th>
                        <th className="p-3 text-right">Trend</th>
                        <th className="p-3 text-right">Kapsama</th>
                        <th className="p-3">Tükenme</th>
                        <th className="p-3 text-right">Riskli ciro</th>
                        <th className="p-3">Durum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.slice(0, 50).map((row) => (
                        <tr key={row.variantId} className="border-t">
                          <td className="p-3">
                            <span className="font-medium">{row.title}</span>
                            {row.sku ? (
                              <span className="text-muted-foreground block text-xs">{row.sku}</span>
                            ) : null}
                          </td>
                          <td className="p-3 text-right">{formatNumber(row.stock)}</td>
                          <td className="p-3 text-right">{row.velocity.toFixed(2)}</td>
                          <td className="p-3 text-right">
                            <span
                              className={
                                row.trend > 0
                                  ? "text-primary font-medium"
                                  : row.trend < 0
                                    ? "text-destructive font-medium"
                                    : "text-muted-foreground"
                              }
                            >
                              {row.trend > 0 ? "+" : ""}
                              {row.trend.toFixed(0)}%
                            </span>
                          </td>
                          <td className="p-3 text-right">{coverLabel(row)}</td>
                          <td className="p-3">{row.stockoutDate ?? "—"}</td>
                          <td className="p-3 text-right">{formatMoney(row.revenueAtRisk)}</td>
                          <td className="p-3">
                            <Badge variant={riskVariant(row)}>{RISK_LABELS[row.risk]}</Badge>
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
