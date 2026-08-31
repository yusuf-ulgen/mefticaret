import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Layers, Snowflake } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ABC_CLASS_LABEL, abcSummary, buildAbcAnalysis, type AbcClass } from "@/lib/abc";
import { abcDataQuery } from "@/lib/abc-queries";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/abc")({
  head: () => ({
    meta: [
      { title: "ABC Analizi & Stok Devir Hızı — Mefticaret" },
      {
        name: "description",
        content:
          "Cironun %80'ini üreten A sınıfı ürünleri belirle, stok devir hızını ölç ve ağır hareket eden stoğu tespit et.",
      },
      { property: "og:title", content: "ABC Analizi & Stok Devir Hızı — Mefticaret" },
      {
        property: "og:description",
        content: "Ciro payına göre ABC sınıflandırması, devir hızı ve yavaş hareket eden stok raporu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AbcPage,
});

const CLASS_VARIANT: Record<AbcClass, "default" | "secondary" | "outline"> = {
  A: "default",
  B: "secondary",
  C: "outline",
};

function AbcPage() {
  const { storeId } = Route.useParams();
  const [windowDays, setWindowDays] = useState(90);
  const [classFilter, setClassFilter] = useState<AbcClass | "all">("all");
  const [onlySlow, setOnlySlow] = useState(false);

  const { data: inputs, isLoading } = useQuery(abcDataQuery(storeId, windowDays));
  const lines = useMemo(() => buildAbcAnalysis(inputs ?? [], windowDays), [inputs, windowDays]);
  const summary = useMemo(() => abcSummary(lines), [lines]);

  const visible = lines.filter(
    (line) =>
      (classFilter === "all" || line.abcClass === classFilter) &&
      (!onlySlow || line.isSlowMoving),
  );

  const exportCsv = () => {
    downloadCsv(
      `abc-analizi-${storeId}.csv`,
      toCsv(
        [
          "Ürün",
          "SKU",
          "Sınıf",
          "Ciro",
          "Ciro payı %",
          "Kümülatif %",
          "Satılan adet",
          "Stok",
          "Stok değeri",
          "Devir hızı",
          "Stok gün",
        ],
        visible.map((line) => [
          line.title,
          line.sku ?? "",
          line.abcClass,
          line.revenue.toFixed(2),
          (line.revenueShare * 100).toFixed(2),
          (line.cumulativeShare * 100).toFixed(2),
          line.soldUnits,
          line.stock,
          line.stockValue.toFixed(2),
          line.turnover ?? "",
          line.daysOnHand ?? "",
        ]),
      ),
    );
  };

  return (
    <AppShell
      storeId={storeId}
      title="ABC Analizi & Stok Devir Hızı"
      description="Cironun büyük kısmını üreten kalemleri, stok değerini ve ağır hareket eden ürünleri gör."
    >
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Dönem cirosu", value: formatMoney(summary.totalRevenue) },
            { label: "Elde stok değeri", value: formatMoney(summary.totalStockValue) },
            {
              label: "Ortalama devir hızı",
              value:
                summary.averageTurnover === null ? "—" : `${summary.averageTurnover} kez/yıl`,
            },
            { label: "Yavaş hareket eden", value: formatNumber(summary.slowMovingCount) },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{kpi.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {summary.classes.map((group) => (
            <div key={group.abcClass} className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between">
                <Badge variant={CLASS_VARIANT[group.abcClass]}>{group.abcClass} sınıfı</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatNumber(group.count)} kalem
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {ABC_CLASS_LABEL[group.abcClass]}
              </p>
              <p className="mt-2 font-display text-xl font-semibold">
                {formatMoney(group.revenue)}
              </p>
              <p className="text-xs text-muted-foreground">
                Stok değeri {formatMoney(group.stockValue)}
              </p>
            </div>
          ))}
        </section>

        <section className="flex flex-wrap items-end justify-between gap-3 rounded-xl border bg-card p-5">
          <div className="space-y-2">
            <Label htmlFor="abc-window">Analiz penceresi (gün)</Label>
            <Input
              id="abc-window"
              className="w-40"
              type="number"
              min={7}
              max={365}
              value={windowDays}
              onChange={(event) =>
                setWindowDays(Math.min(365, Math.max(7, Number(event.target.value) || 7)))
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "A", "B", "C"] as const).map((option) => (
              <Button
                key={option}
                size="sm"
                variant={classFilter === option ? "default" : "outline"}
                onClick={() => setClassFilter(option)}
              >
                <Layers className="mr-2 size-4" />
                {option === "all" ? "Tümü" : `${option} sınıfı`}
              </Button>
            ))}
            <Button
              size="sm"
              variant={onlySlow ? "default" : "outline"}
              onClick={() => setOnlySlow((previous) => !previous)}
            >
              <Snowflake className="mr-2 size-4" /> Yavaş hareket
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={visible.length === 0}>
              <Download className="mr-2 size-4" /> CSV indir
            </Button>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Ürün / varyant</th>
                <th className="px-3 py-2 text-center">Sınıf</th>
                <th className="px-3 py-2 text-right">Ciro</th>
                <th className="px-3 py-2 text-right">Ciro payı</th>
                <th className="px-3 py-2 text-right">Kümülatif</th>
                <th className="px-3 py-2 text-right">Satış</th>
                <th className="px-3 py-2 text-right">Stok değeri</th>
                <th className="px-3 py-2 text-right">Devir</th>
                <th className="px-3 py-2 text-right">Stok gün</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.slice(0, 500).map((line) => (
                <tr key={line.variantId} className={line.isSlowMoving ? "bg-muted/30" : undefined}>
                  <td className="px-3 py-2">
                    <div className="truncate font-medium">{line.title}</div>
                    <div className="text-xs text-muted-foreground">{line.sku ?? "SKU yok"}</div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge variant={CLASS_VARIANT[line.abcClass]}>{line.abcClass}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">{formatMoney(line.revenue)}</td>
                  <td className="px-3 py-2 text-right">
                    {(line.revenueShare * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground">
                    {(line.cumulativeShare * 100).toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right">{formatNumber(line.soldUnits)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(line.stockValue)}</td>
                  <td className="px-3 py-2 text-right">{line.turnover ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{line.daysOnHand ?? "—"}</td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-muted-foreground" colSpan={9}>
                    {isLoading ? "Hesaplanıyor…" : "Bu filtreye uyan kalem yok."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
}
