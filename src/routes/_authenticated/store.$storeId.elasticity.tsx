import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Percent } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { BAND_LABELS, analyzeElasticity, type DiscountBand } from "@/lib/elasticity";
import { elasticityDataQuery } from "@/lib/elasticity-queries";
import { formatMoney, formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/elasticity")({
  head: () => ({
    meta: [
      { title: "İndirim Derinliği & Fiyat Esnekliği — Mefticaret" },
      {
        name: "description",
        content:
          "Liste fiyatı ile satış fiyatı arasındaki farkı, indirim maliyetini ve indirimin satış hacmine etkisini incele.",
      },
      { property: "og:title", content: "İndirim Derinliği & Fiyat Esnekliği — Mefticaret" },
      {
        property: "og:description",
        content: "İndirim bandı bazlı hacim, indirim maliyeti, marj etkisi ve ürün kırılımı.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ElasticityPage,
});

function ElasticityPage() {
  const { storeId } = Route.useParams();
  const [band, setBand] = useState<DiscountBand | "all">("all");

  const { data, isLoading } = useQuery(elasticityDataQuery(storeId));
  const analysis = useMemo(
    () => analyzeElasticity(data?.items ?? [], data?.variants ?? []),
    [data],
  );

  const products =
    band === "all" ? analysis.products : analysis.products.filter((row) => row.band === band);

  const exportCsv = () => {
    downloadCsv(
      `indirim-derinligi-${storeId}.csv`,
      toCsv(
        [
          "Ürün",
          "Adet",
          "Ciro",
          "Liste ciro",
          "Ort. satış fiyatı",
          "Liste fiyatı",
          "Ort. indirim %",
          "İndirim maliyeti",
          "Marj",
          "Marj %",
          "İndirimli adet",
          "Tam fiyat adet",
        ],
        products.map((row) => [
          row.title,
          row.units,
          row.revenue.toFixed(2),
          row.listRevenue.toFixed(2),
          row.avgSoldPrice.toFixed(2),
          row.listPrice.toFixed(2),
          (row.avgDepth * 100).toFixed(1),
          row.discountCost.toFixed(2),
          row.margin.toFixed(2),
          (row.marginRate * 100).toFixed(1),
          row.discountedUnits,
          row.fullPriceUnits,
        ]),
      ),
    );
  };

  const kpis = [
    { label: "Gerçekleşen ciro", value: formatMoney(analysis.summary.revenue) },
    { label: "İndirim maliyeti", value: formatMoney(analysis.summary.discountCost) },
    { label: "Ort. indirim", value: `${(analysis.summary.avgDepth * 100).toFixed(1)}%` },
    { label: "Brüt marj", value: `${(analysis.summary.marginRate * 100).toFixed(1)}%` },
  ];

  return (
    <AppShell
      storeId={storeId}
      title="İndirim Derinliği & Fiyat Esnekliği"
      description="Son 180 günde liste fiyatı ile satış fiyatı farkını, indirim maliyetini ve hacim etkisini incele."
    >
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{kpi.value}</p>
            </div>
          ))}
        </section>

        {analysis.summary.marginLossProducts > 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <AlertTriangle className="mt-0.5 size-5 text-destructive" />
            <div>
              <p className="font-medium">
                {formatNumber(analysis.summary.marginLossProducts)} ürün maliyetin altında satılmış
              </p>
              <p className="text-sm text-muted-foreground">
                İndirim derinliğini azaltmak veya maliyet verisini güncellemek marjı korur.
              </p>
            </div>
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <Percent className="size-4 text-muted-foreground" />
              <h2 className="font-display text-lg font-semibold">İndirim bandına göre hacim</h2>
            </div>
            {analysis.bands.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.bands}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12 }}
                      formatter={(value: number) => [formatNumber(value), "Adet"]}
                    />
                    <Bar dataKey="units" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Yükleniyor…" : "Satış kaydı bulunmuyor."}
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Band kırılımı</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2">Band</th>
                    <th className="py-2">Adet</th>
                    <th className="py-2">Pay</th>
                    <th className="py-2">Ciro</th>
                    <th className="py-2">Marj</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.bands.map((row) => (
                    <tr key={row.band} className="border-t">
                      <td className="py-2 font-medium">{row.label}</td>
                      <td className="py-2">{formatNumber(row.units)}</td>
                      <td className="py-2">{(row.share * 100).toFixed(1)}%</td>
                      <td className="py-2">{formatMoney(row.revenue)}</td>
                      <td className="py-2">{formatMoney(row.margin)}</td>
                    </tr>
                  ))}
                  {!analysis.bands.length ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-sm text-muted-foreground">
                        {isLoading ? "Yükleniyor…" : "Veri yok."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">
              Ürün bazlı indirim etkisi ({formatNumber(products.length)})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={band === "all" ? "default" : "outline"}
                onClick={() => setBand("all")}
              >
                Tümü
              </Button>
              {analysis.bands.map((row) => (
                <Button
                  key={row.band}
                  size="sm"
                  variant={band === row.band ? "default" : "outline"}
                  onClick={() => setBand(row.band)}
                >
                  {BAND_LABELS[row.band]}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!products.length}>
                <Download className="mr-2 size-4" /> CSV indir
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Ürün</th>
                  <th className="py-2">Adet</th>
                  <th className="py-2">Ort. satış</th>
                  <th className="py-2">Liste</th>
                  <th className="py-2">İndirim</th>
                  <th className="py-2">İndirim maliyeti</th>
                  <th className="py-2">Marj</th>
                  <th className="py-2">Hacim çarpanı</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 100).map((row) => (
                  <tr key={row.productId} className="border-t">
                    <td className="py-2 font-medium">{row.title}</td>
                    <td className="py-2">{formatNumber(row.units)}</td>
                    <td className="py-2">{formatMoney(row.avgSoldPrice)}</td>
                    <td className="py-2">{formatMoney(row.listPrice)}</td>
                    <td className="py-2">
                      <Badge variant={row.avgDepth >= 0.25 ? "destructive" : "outline"}>
                        {(row.avgDepth * 100).toFixed(1)}%
                      </Badge>
                    </td>
                    <td className="py-2">{formatMoney(row.discountCost)}</td>
                    <td className={row.margin < 0 ? "py-2 text-destructive" : "py-2"}>
                      {formatMoney(row.margin)}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {row.volumeLift === null ? "—" : `${row.volumeLift.toFixed(2)}x`}
                    </td>
                  </tr>
                ))}
                {!products.length ? (
                  <tr>
                    <td colSpan={8} className="py-4 text-sm text-muted-foreground">
                      {isLoading ? "Yükleniyor…" : "Bu bantta ürün yok."}
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
