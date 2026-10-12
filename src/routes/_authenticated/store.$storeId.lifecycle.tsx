import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, PackageX, Sprout } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { PHASE_HINTS, PHASE_LABELS, analyzeLifecycle, type LifecyclePhase } from "@/lib/lifecycle";
import { lifecycleDataQuery } from "@/lib/lifecycle-queries";
import { formatMoney, formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/lifecycle")({
  head: () => ({
    meta: [
      { title: "Ürün Yaşam Döngüsü — Mefticaret" },
      {
        name: "description",
        content:
          "Ürünlerini yeni, büyüyen, olgun, düşen ve ölü stok fazlarına göre sınıflandır; tasfiye ve büyütme kararlarını verilerle al.",
      },
      { property: "og:title", content: "Ürün Yaşam Döngüsü — Mefticaret" },
      {
        property: "og:description",
        content: "Faz bazlı ürün dağılımı, satış hızı, stok yeterliliği ve ölü stok tespiti.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LifecyclePage,
});

const PHASE_TONE: Record<LifecyclePhase, string> = {
  new: "bg-primary/10 text-primary",
  growing: "bg-emerald-500/10 text-emerald-600",
  mature: "bg-muted text-foreground",
  declining: "bg-amber-500/10 text-amber-600",
  dead: "bg-destructive/10 text-destructive",
};

function LifecyclePage() {
  const { storeId } = Route.useParams();
  const [phase, setPhase] = useState<LifecyclePhase | "all">("all");

  const { data, isLoading } = useQuery(lifecycleDataQuery(storeId));
  const analysis = useMemo(
    () => analyzeLifecycle(data?.products ?? [], data?.sales ?? []),
    [data],
  );

  const rows = phase === "all" ? analysis.rows : analysis.rows.filter((row) => row.phase === phase);

  const exportCsv = () => {
    downloadCsv(
      `urun-yasam-dongusu-${storeId}.csv`,
      toCsv(
        [
          "Ürün",
          "Faz",
          "Durum",
          "Yaş (gün)",
          "30g adet",
          "Önceki 30g adet",
          "Büyüme %",
          "90g ciro",
          "Günlük hız",
          "Stok",
          "Stok yeterliliği (gün)",
          "Son satıştan bu yana (gün)",
        ],
        rows.map((row) => [
          row.title,
          PHASE_LABELS[row.phase],
          row.status,
          row.ageDays,
          row.units30,
          row.unitsPrev30,
          row.growth === null ? "yeni" : (row.growth * 100).toFixed(1),
          row.revenue90.toFixed(2),
          row.velocity.toFixed(2),
          row.stock,
          row.daysOfStock === null ? "-" : row.daysOfStock.toFixed(0),
          row.daysSinceLastSale === null ? "-" : row.daysSinceLastSale,
        ]),
      ),
    );
  };

  const kpis = [
    { label: "Ürün sayısı", value: formatNumber(analysis.summary.products) },
    { label: "90 günlük ciro", value: formatMoney(analysis.summary.revenue90) },
    { label: "Yeni ürün", value: formatNumber(analysis.summary.newProducts) },
    { label: "Ölü stok adedi", value: formatNumber(analysis.summary.deadStockValueUnits) },
  ];

  const deadRows = analysis.rows.filter((row) => row.phase === "dead" && row.stock > 0).slice(0, 8);

  return (
    <AppShell
      storeId={storeId}
      title="Ürün Yaşam Döngüsü"
      description="Son 90 günlük satış hareketine göre ürünlerin fazını, büyüme hızını ve tasfiye adaylarını gör."
    >
      <div className="space-y-8">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{kpi.value}</p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <Sprout className="size-4 text-muted-foreground" />
              <h2 className="font-display text-lg font-semibold">Faz dağılımı</h2>
            </div>
            {analysis.byPhase.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.byPhase}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12 }}
                      formatter={(value: number) => [formatNumber(value), "Ürün"]}
                    />
                    <Bar dataKey="products" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Yükleniyor…" : "Ürün bulunmuyor."}
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Faz kırılımı</h2>
            <div className="space-y-3">
              {analysis.byPhase.map((row) => (
                <div key={row.phase} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge className={PHASE_TONE[row.phase]} variant="secondary">
                      {row.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatNumber(row.products)} ürün · {(row.share * 100).toFixed(0)}% ·{" "}
                      {formatMoney(row.revenue90)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{PHASE_HINTS[row.phase]}</p>
                </div>
              ))}
              {!analysis.byPhase.length ? (
                <p className="text-sm text-muted-foreground">
                  {isLoading ? "Yükleniyor…" : "Veri yok."}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {deadRows.length ? (
          <section className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
            <div className="flex items-center gap-2">
              <PackageX className="size-4 text-destructive" />
              <h2 className="font-display text-lg font-semibold">Tasfiye adayları</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              90 gündür satılmayan ancak stokta bekleyen ürünler:
            </p>
            <div className="flex flex-wrap gap-2">
              {deadRows.map((row) => (
                <span key={row.productId} className="rounded-full border bg-card px-3 py-1 text-xs">
                  {row.title} · {formatNumber(row.stock)} adet
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Ürün detayı</h2>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "new", "growing", "mature", "declining", "dead"] as const).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={phase === value ? "default" : "outline"}
                  onClick={() => setPhase(value)}
                >
                  {value === "all" ? "Tümü" : PHASE_LABELS[value]}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
                <Download className="mr-2 size-4" />
                CSV
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Ürün</th>
                  <th className="py-2">Faz</th>
                  <th className="py-2">Yaş</th>
                  <th className="py-2">30g adet</th>
                  <th className="py-2">Büyüme</th>
                  <th className="py-2">90g ciro</th>
                  <th className="py-2">Stok</th>
                  <th className="py-2">Yeterlilik</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((row) => (
                  <tr key={row.productId} className="border-t">
                    <td className="py-2 font-medium">{row.title}</td>
                    <td className="py-2">
                      <Badge className={PHASE_TONE[row.phase]} variant="secondary">
                        {PHASE_LABELS[row.phase]}
                      </Badge>
                    </td>
                    <td className="py-2">{formatNumber(row.ageDays)} g</td>
                    <td className="py-2">{formatNumber(row.units30)}</td>
                    <td className="py-2">
                      {row.growth === null ? (
                        <span className="text-muted-foreground">yeni</span>
                      ) : (
                        <span
                          className={
                            row.growth > 0
                              ? "text-emerald-600"
                              : row.growth < 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }
                        >
                          {(row.growth * 100).toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className="py-2">{formatMoney(row.revenue90)}</td>
                    <td className="py-2">{formatNumber(row.stock)}</td>
                    <td className="py-2">
                      {row.daysOfStock === null ? "-" : `${row.daysOfStock.toFixed(0)} g`}
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={8} className="py-4 text-sm text-muted-foreground">
                      {isLoading ? "Yükleniyor…" : "Bu fazda ürün yok."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
