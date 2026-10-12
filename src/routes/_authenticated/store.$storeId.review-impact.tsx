import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import {
  RATING_BAND_LABELS,
  analyzeReviewImpact,
  type RatingBand,
} from "@/lib/review-impact";
import { reviewImpactDataQuery } from "@/lib/review-impact-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/review-impact")({
  head: () => ({
    meta: [
      { title: "Değerlendirme Etkisi — Mefticaret" },
      {
        name: "description",
        content:
          "Ürün puanlarının satış hacmine ve iade oranına etkisini ölç; yorumsuz ürünleri ve düşük puanlı riskleri tespit et.",
      },
      { property: "og:title", content: "Değerlendirme Etkisi — Mefticaret" },
      {
        property: "og:description",
        content: "Puan bandı bazlı ciro, iade oranı, yorum kapsama oranı ve ürün kırılımı.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReviewImpactPage,
});

const BAND_TONE: Record<RatingBand, string> = {
  high: "bg-emerald-500/10 text-emerald-600",
  mid: "bg-amber-500/10 text-amber-600",
  low: "bg-destructive/10 text-destructive",
  none: "bg-muted text-muted-foreground",
};

function ReviewImpactPage() {
  const { storeId } = Route.useParams();
  const [band, setBand] = useState<RatingBand | "all">("all");

  const { data, isLoading } = useQuery(reviewImpactDataQuery(storeId));
  const analysis = useMemo(
    () =>
      analyzeReviewImpact(
        data?.products ?? [],
        data?.reviews ?? [],
        data?.sales ?? [],
        data?.returns ?? [],
      ),
    [data],
  );

  const rows = band === "all" ? analysis.rows : analysis.rows.filter((row) => row.band === band);

  const exportCsv = () => {
    downloadCsv(
      `degerlendirme-etkisi-${storeId}.csv`,
      toCsv(
        [
          "Ürün",
          "Yorum",
          "Yayınlanan",
          "Bekleyen",
          "Ort. puan",
          "Band",
          "Adet",
          "Ciro",
          "İade adet",
          "İade oranı %",
          "Yorum başına ciro",
        ],
        rows.map((row) => [
          row.title,
          row.reviews,
          row.published,
          row.pending,
          row.avgRating === null ? "-" : row.avgRating.toFixed(2),
          RATING_BAND_LABELS[row.band],
          row.units,
          row.revenue.toFixed(2),
          row.returnedUnits,
          (row.returnRate * 100).toFixed(1),
          row.revenuePerReview === null ? "-" : row.revenuePerReview.toFixed(2),
        ]),
      ),
    );
  };

  const kpis = [
    { label: "Toplam yorum", value: formatNumber(analysis.summary.reviews) },
    {
      label: "Ortalama puan",
      value: analysis.summary.avgRating === null ? "—" : analysis.summary.avgRating.toFixed(2),
    },
    { label: "Yorum kapsaması", value: `${(analysis.summary.coverage * 100).toFixed(0)}%` },
    { label: "Onay bekleyen", value: formatNumber(analysis.summary.pending) },
  ];

  const lowRated = analysis.rows.filter((row) => row.band === "low").slice(0, 8);

  return (
    <AppShell
      storeId={storeId}
      title="Değerlendirme Etkisi"
      description="Puan bantlarına göre satış performansı, iade oranı ve yorum eksikliği olan cirolu ürünler."
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

        {analysis.summary.noReviewRevenue > 0 ? (
          <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <Star className="mt-0.5 size-5 text-muted-foreground" />
            <div>
              <p className="font-medium">
                {formatMoney(analysis.summary.noReviewRevenue)} ciro yorumsuz ürünlerden geliyor
              </p>
              <p className="text-sm text-muted-foreground">
                Satış sonrası yorum daveti göndermek dönüşümü ve güveni artırır.
              </p>
            </div>
          </div>
        ) : null}

        {lowRated.length ? (
          <section className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-destructive" />
              <h2 className="font-display text-lg font-semibold">Düşük puanlı riskler</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {lowRated.map((row) => (
                <span key={row.productId} className="rounded-full border bg-card px-3 py-1 text-xs">
                  {row.title} · {row.avgRating?.toFixed(1)} puan · iade{" "}
                  {(row.returnRate * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Puan bandına göre ciro</h2>
            {analysis.bands.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.bands}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12 }}
                      formatter={(value: number) => [formatMoney(value), "Ciro"]}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
            <h2 className="font-display text-lg font-semibold">Band kırılımı</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2">Band</th>
                    <th className="py-2">Ürün</th>
                    <th className="py-2">Adet</th>
                    <th className="py-2">Ürün başına ciro</th>
                    <th className="py-2">İade</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.bands.map((row) => (
                    <tr key={row.band} className="border-t">
                      <td className="py-2 font-medium">{row.label}</td>
                      <td className="py-2">{formatNumber(row.products)}</td>
                      <td className="py-2">{formatNumber(row.units)}</td>
                      <td className="py-2">{formatMoney(row.avgRevenuePerProduct)}</td>
                      <td className="py-2">{(row.returnRate * 100).toFixed(1)}%</td>
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
            <h2 className="font-display text-lg font-semibold">Ürün detayı</h2>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "high", "mid", "low", "none"] as const).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={band === value ? "default" : "outline"}
                  onClick={() => setBand(value)}
                >
                  {value === "all" ? "Tümü" : RATING_BAND_LABELS[value]}
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
                  <th className="py-2">Puan</th>
                  <th className="py-2">Yorum</th>
                  <th className="py-2">Adet</th>
                  <th className="py-2">Ciro</th>
                  <th className="py-2">İade oranı</th>
                  <th className="py-2">Yorum başına ciro</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((row) => (
                  <tr key={row.productId} className="border-t">
                    <td className="py-2 font-medium">{row.title}</td>
                    <td className="py-2">
                      <Badge className={BAND_TONE[row.band]} variant="secondary">
                        {row.avgRating === null ? "—" : row.avgRating.toFixed(1)}
                      </Badge>
                    </td>
                    <td className="py-2">
                      {formatNumber(row.reviews)}
                      {row.pending > 0 ? (
                        <span className="ml-1 text-xs text-amber-600">
                          ({formatNumber(row.pending)} bekliyor)
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2">{formatNumber(row.units)}</td>
                    <td className="py-2">{formatMoney(row.revenue)}</td>
                    <td className="py-2">{(row.returnRate * 100).toFixed(1)}%</td>
                    <td className="py-2">
                      {row.revenuePerReview === null ? "-" : formatMoney(row.revenuePerReview)}
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={7} className="py-4 text-sm text-muted-foreground">
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
