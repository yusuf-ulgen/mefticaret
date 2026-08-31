import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, MapPin, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { analyzeGeo, type GeoRow } from "@/lib/geo";
import { geoDataQuery } from "@/lib/geo-queries";
import { formatMoney, formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/geo")({
  head: () => ({
    meta: [
      { title: "Coğrafi Satış Dağılımı — Mefticaret" },
      {
        name: "description",
        content:
          "Siparişlerini ülke, şehir ve ilçe bazında incele; en çok ciro getiren ve en hızlı büyüyen bölgeleri keşfet.",
      },
      { property: "og:title", content: "Coğrafi Satış Dağılımı — Mefticaret" },
      {
        property: "og:description",
        content: "Bölge bazlı ciro, sipariş adedi, ortalama sepet ve 30 günlük büyüme karşılaştırması.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GeoPage,
});

type Level = "country" | "city" | "district";

const LEVELS: { key: Level; label: string }[] = [
  { key: "city", label: "Şehir" },
  { key: "district", label: "İlçe" },
  { key: "country", label: "Ülke" },
];

function GeoPage() {
  const { storeId } = Route.useParams();
  const [level, setLevel] = useState<Level>("city");

  const { data, isLoading } = useQuery(geoDataQuery(storeId));
  const analysis = useMemo(() => analyzeGeo(data ?? []), [data]);

  const rows: GeoRow[] =
    level === "city" ? analysis.cities : level === "district" ? analysis.districts : analysis.countries;

  const chartData = rows.slice(0, 10).map((row) => ({
    name: row.label,
    ciro: Number(row.revenue.toFixed(2)),
  }));

  const exportCsv = () => {
    downloadCsv(
      `cografi-satis-${level}-${storeId}.csv`,
      toCsv(
        ["Bölge", "Üst bölge", "Sipariş", "Ciro", "Kargo", "Müşteri", "Ort. sepet", "Pay %", "30g büyüme %"],
        rows.map((row) => [
          row.label,
          row.parent ?? "",
          String(row.orders),
          row.revenue.toFixed(2),
          row.shipping.toFixed(2),
          String(row.customers),
          row.avgOrderValue.toFixed(2),
          (row.share * 100).toFixed(1),
          row.growth === null ? "yeni" : (row.growth * 100).toFixed(1),
        ]),
      ),
    );
  };

  const kpis = [
    { label: "Toplam ciro", value: formatMoney(analysis.totals.revenue) },
    { label: "Sipariş", value: formatNumber(analysis.totals.orders) },
    { label: "Aktif şehir", value: formatNumber(analysis.totals.regions) },
    { label: "Ortalama sepet", value: formatMoney(analysis.totals.avgOrderValue) },
  ];

  return (
    <AppShell
      storeId={storeId}
      title="Coğrafi Satış Dağılımı"
      description="Son 180 günün siparişlerini ülke, şehir ve ilçe kırılımında incele."
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

        {analysis.risers.length > 0 ? (
          <section className="rounded-xl border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="size-4 text-emerald-600" />
              <h2 className="font-display text-lg font-semibold">En hızlı büyüyen şehirler</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {analysis.risers.map((row) => (
                <Badge key={row.key} variant="secondary" className="gap-1">
                  {row.label}
                  <span className="text-emerald-600">+{((row.growth ?? 0) * 100).toFixed(0)}%</span>
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Son 30 gün cirosu, önceki 30 güne kıyasla artan bölgeler.
            </p>
          </section>
        ) : null}

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Ciroya göre ilk 10 bölge</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(value: number) => formatMoney(value)} />
                <Bar dataKey="ciro" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" />
              <div className="flex gap-1">
                {LEVELS.map((option) => (
                  <Button
                    key={option.key}
                    size="sm"
                    variant={level === option.key ? "default" : "outline"}
                    onClick={() => setLevel(option.key)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
              <Download className="mr-2 size-4" /> CSV
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Bölge</th>
                  <th className="px-4 py-3 text-right">Sipariş</th>
                  <th className="px-4 py-3 text-right">Ciro</th>
                  <th className="px-4 py-3 text-right">Müşteri</th>
                  <th className="px-4 py-3 text-right">Ort. sepet</th>
                  <th className="px-4 py-3 text-right">Pay</th>
                  <th className="px-4 py-3 text-right">30g büyüme</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      Yükleniyor…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-muted-foreground">
                      Bu dönemde adres bilgisi olan sipariş bulunamadı.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.key} className="border-t">
                      <td className="px-4 py-3">
                        <span className="font-medium">{row.label}</span>
                        {row.parent && level !== "country" ? (
                          <span className="ml-2 text-xs text-muted-foreground">{row.parent}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right">{formatNumber(row.orders)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatMoney(row.revenue)}</td>
                      <td className="px-4 py-3 text-right">{formatNumber(row.customers)}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(row.avgOrderValue)}</td>
                      <td className="px-4 py-3 text-right">{(row.share * 100).toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right">
                        {row.growth === null ? (
                          <Badge variant="secondary">yeni</Badge>
                        ) : (
                          <span className={row.growth >= 0 ? "text-emerald-600" : "text-destructive"}>
                            {row.growth >= 0 ? "+" : ""}
                            {(row.growth * 100).toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
