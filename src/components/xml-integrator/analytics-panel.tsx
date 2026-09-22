/**
 * Tedarikçi analitiği: günlük besleme istatistiklerinden özet kartlar,
 * trend grafikleri ve tedarikçi karnesi tablosu.
 */

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileText, Gauge, Package, ShieldAlert, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { CardSkeleton } from "@/components/ui/data-skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv, toCsv } from "@/lib/csv";
import { xmlSupplierPerformanceReport } from "@/lib/xml-integrator.functions";

const RANGE_PRESETS = [
  { key: "7", label: "Son 7 gün", days: 7 },
  { key: "30", label: "Son 30 gün", days: 30 },
  { key: "90", label: "Son 90 gün", days: 90 },
] as const;

const trendConfig = {
  totalProducts: { label: "Katalog büyüklüğü", color: "var(--chart-1)" },
  inStock: { label: "Stokta", color: "var(--chart-2)" },
  outOfStock: { label: "Stoksuz", color: "var(--destructive)" },
} satisfies ChartConfig;

const volatilityConfig = {
  priceUpdates: { label: "Fiyat değişimi", color: "var(--chart-1)" },
  stockUpdates: { label: "Stok değişimi", color: "var(--chart-3)" },
} satisfies ChartConfig;

const healthConfig = {
  inStock: { label: "Stokta", color: "var(--chart-2)" },
  outOfStock: { label: "Stoksuz", color: "var(--chart-4)" },
  quarantined: { label: "İncelemede", color: "var(--destructive)" },
} satisfies ChartConfig;

const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });

const pct = (value: number) => `${value.toFixed(1)}%`;

/** Performans puanı: stok bulunurluğu, başarı oranı ve incelemeye alınan ürün cezası. */
function performanceScore(input: {
  avgCatalogSize: number;
  avgOutOfStock: number;
  avgSuccessPercent: number;
  totalQuarantined: number;
}): number {
  const availability =
    input.avgCatalogSize > 0
      ? Math.max(0, 1 - input.avgOutOfStock / input.avgCatalogSize)
      : 1;
  const quarantinePenalty =
    input.avgCatalogSize > 0 ? Math.min(0.2, input.totalQuarantined / (input.avgCatalogSize * 2)) : 0;
  const score = availability * 45 + (input.avgSuccessPercent / 100) * 55 - quarantinePenalty * 100;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function ScoreBadge({ score }: { score: number }) {
  if (score >= 90) return <Badge className="bg-emerald-600 text-white">{score}% Mükemmel</Badge>;
  if (score >= 75) return <Badge variant="secondary">{score}% İyi</Badge>;
  if (score >= 60) return <Badge className="bg-amber-500 text-white">{score}% Dikkat</Badge>;
  return <Badge variant="destructive">{score}% Zayıf</Badge>;
}

function StatCard({
  icon,
  title,
  value,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function XmlAnalyticsPanel({ storeId }: { storeId: string }) {
  const [rangeKey, setRangeKey] = useState<string>("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const customDays = useMemo(() => {
    if (rangeKey !== "custom" || !customStart) return 30;
    const start = new Date(`${customStart}T00:00:00Z`).getTime();
    if (Number.isNaN(start)) return 30;
    const diff = Math.ceil((Date.now() - start) / 86_400_000);
    return Math.max(1, Math.min(365, diff));
  }, [rangeKey, customStart]);

  const days =
    rangeKey === "custom" ? customDays : (RANGE_PRESETS.find((item) => item.key === rangeKey)?.days ?? 30);

  const report = useServerFn(xmlSupplierPerformanceReport);
  const query = useQuery({
    queryKey: ["xml-analytics", storeId, days],
    queryFn: () => report({ data: { storeId, days } }),
  });

  const daily = useMemo(() => {
    const rows = query.data?.daily ?? [];
    if (rangeKey !== "custom") return rows;
    return rows.filter(
      (row) => (!customStart || row.date >= customStart) && (!customEnd || row.date <= customEnd),
    );
  }, [query.data, rangeKey, customStart, customEnd]);

  const suppliers = query.data?.suppliers ?? [];

  const scored = useMemo(
    () =>
      suppliers.map((supplier) => ({
        ...supplier,
        outOfStockPercent:
          supplier.avgCatalogSize > 0 ? (supplier.avgOutOfStock / supplier.avgCatalogSize) * 100 : 0,
        score: performanceScore(supplier),
      })),
    [suppliers],
  );

  /* Günlük trend: tüm tedarikçilerin toplamı (tarih bazlı). */
  const trend = useMemo(() => {
    const byDate = new Map<string, { date: string; totalProducts: number; inStock: number; outOfStock: number }>();
    for (const row of daily) {
      const entry = byDate.get(row.date) ?? { date: row.date, totalProducts: 0, inStock: 0, outOfStock: 0 };
      entry.totalProducts += row.totalProducts;
      entry.outOfStock += row.outOfStock;
      entry.inStock += Math.max(0, row.totalProducts - row.outOfStock);
      byDate.set(row.date, entry);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [daily]);

  const volatility = useMemo(
    () =>
      scored
        .map((supplier) => ({
          name: supplier.supplierName.slice(0, 18),
          priceUpdates: supplier.totalPriceUpdates,
          stockUpdates: supplier.totalStockUpdates,
        }))
        .sort((a, b) => b.priceUpdates - a.priceUpdates)
        .slice(0, 10),
    [scored],
  );

  const health = useMemo(() => {
    const totals = scored.reduce(
      (acc, supplier) => ({
        catalog: acc.catalog + supplier.avgCatalogSize,
        outOfStock: acc.outOfStock + supplier.avgOutOfStock,
        quarantined: acc.quarantined + supplier.totalQuarantined,
      }),
      { catalog: 0, outOfStock: 0, quarantined: 0 },
    );
    const inStock = Math.max(0, totals.catalog - totals.outOfStock);
    return [
      { key: "inStock", label: "Stokta", value: Math.round(inStock), color: "var(--chart-2)" },
      { key: "outOfStock", label: "Stoksuz", value: Math.round(totals.outOfStock), color: "var(--chart-4)" },
      { key: "quarantined", label: "İncelemede", value: totals.quarantined, color: "var(--destructive)" },
    ].filter((slice) => slice.value > 0);
  }, [scored]);

  const summary = useMemo(() => {
    const catalog = scored.reduce((sum, item) => sum + item.avgCatalogSize, 0);
    const outOfStock = scored.reduce((sum, item) => sum + item.avgOutOfStock, 0);
    const priceUpdates = scored.reduce((sum, item) => sum + item.totalPriceUpdates, 0);
    const speeds = scored.filter((item) => item.avgSpeedSeconds > 0);
    const fastest = speeds.length
      ? speeds.reduce((best, item) => (item.avgSpeedSeconds < best.avgSpeedSeconds ? item : best))
      : null;
    const slowest = speeds.length
      ? speeds.reduce((worst, item) => (item.avgSpeedSeconds > worst.avgSpeedSeconds ? item : worst))
      : null;
    return {
      suppliers: scored.length,
      outOfStockRate: catalog > 0 ? (outOfStock / catalog) * 100 : 0,
      priceUpdates,
      fastest,
      slowest,
    };
  }, [scored]);

  const exportCsv = () => {
    const content = toCsv(
      [
        "Tedarikçi",
        "Ortalama ürün",
        "Stoksuz %",
        "Ortalama hız (sn)",
        "Fiyat değişimi",
        "Stok değişimi",
        "İncelemeye alınan",
        "Başarı %",
        "Puan",
      ],
      scored.map((supplier) => [
        supplier.supplierName,
        supplier.avgCatalogSize,
        supplier.outOfStockPercent.toFixed(1),
        supplier.avgSpeedSeconds,
        supplier.totalPriceUpdates,
        supplier.totalStockUpdates,
        supplier.totalQuarantined,
        supplier.avgSuccessPercent,
        supplier.score,
      ]),
    );
    downloadCsv(`tedarikci-performans-${days}gun.csv`, content);
  };

  if (query.isLoading) return <CardSkeleton />;
  if (query.error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
        Rapor yüklenemedi: {(query.error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tarih aralığı ve dışa aktarım */}
      <section className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-4 print:hidden">
        <div className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={rangeKey === item.key ? "default" : "outline"}
              onClick={() => setRangeKey(item.key)}
            >
              {item.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant={rangeKey === "custom" ? "default" : "outline"}
            onClick={() => setRangeKey("custom")}
          >
            Özel aralık
          </Button>
        </div>

        {rangeKey === "custom" ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="analytics-start" className="text-xs">Başlangıç</Label>
              <Input
                id="analytics-start"
                type="date"
                className="h-9"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="analytics-end" className="text-xs">Bitiş</Label>
              <Input
                id="analytics-end"
                type="date"
                className="h-9"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
              />
            </div>
          </div>
        ) : null}

        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={scored.length === 0}>
            <Download className="mr-1 size-4" />
            CSV indir
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()} disabled={scored.length === 0}>
            <FileText className="mr-1 size-4" />
            PDF olarak yazdır
          </Button>
        </div>
      </section>

      {/* Özet kartlar */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Package className="size-4" />}
          title="Takip edilen tedarikçi"
          value={String(summary.suppliers)}
          hint={`Son ${days} gün`}
        />
        <StatCard
          icon={<TrendingDown className="size-4" />}
          title="Ortalama stoksuz oranı"
          value={pct(summary.outOfStockRate)}
          hint="Tüm tedarikçilerin ortalaması"
        />
        <StatCard
          icon={<Gauge className="size-4" />}
          title="Toplam fiyat değişimi"
          value={summary.priceUpdates.toLocaleString("tr-TR")}
          hint={`Son ${days} gün`}
        />
        <StatCard
          icon={<ShieldAlert className="size-4" />}
          title="En hızlı / en yavaş"
          value={
            summary.fastest && summary.slowest
              ? `${summary.fastest.avgSpeedSeconds} sn / ${summary.slowest.avgSpeedSeconds} sn`
              : "—"
          }
          hint={
            summary.fastest && summary.slowest
              ? `${summary.fastest.supplierName} · ${summary.slowest.supplierName}`
              : "Henüz veri yok"
          }
        />
      </section>

      {/* Trend grafiği */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">Katalog büyüklüğü ve stok bulunurluğu</h2>
        <p className="text-xs text-muted-foreground">Son {days} günün günlük toplamı.</p>
        {trend.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">Bu aralıkta veri yok.</p>
        ) : (
          <ChartContainer config={trendConfig} className="mt-3 h-56 w-full">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={shortDay} tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={40} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(value) => shortDay(String(value))} />} />
                <Line dataKey="totalProducts" type="monotone" stroke="var(--color-totalProducts)" strokeWidth={2} dot={false} />
                <Line dataKey="inStock" type="monotone" stroke="var(--color-inStock)" strokeWidth={2} dot={false} />
                <Line dataKey="outOfStock" type="monotone" stroke="var(--color-outOfStock)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Fiyat oynaklığı */}
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-medium">Fiyat oynaklığı</h2>
          <p className="text-xs text-muted-foreground">Hangi tedarikçi fiyatı en sık değiştiriyor?</p>
          {volatility.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">Bu aralıkta veri yok.</p>
          ) : (
            <ChartContainer config={volatilityConfig} className="mt-3 h-56 w-full">
              <ResponsiveContainer>
                <BarChart data={volatility} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={10} interval={0} angle={-20} height={48} textAnchor="end" />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} width={40} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="priceUpdates" fill="var(--color-priceUpdates)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="stockUpdates" fill="var(--color-stockUpdates)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          )}
        </section>

        {/* Stok sağlığı */}
        <section className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-medium">Stok sağlığı dağılımı</h2>
          <p className="text-xs text-muted-foreground">Stokta · stoksuz · incelemeye alınan ürün payı.</p>
          {health.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">Bu aralıkta veri yok.</p>
          ) : (
            <>
              <ChartContainer config={healthConfig} className="mt-3 h-56 w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie data={health} dataKey="value" nameKey="label" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {health.map((slice) => (
                        <Cell key={slice.key} fill={slice.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
              <ul className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
                {health.map((slice) => (
                  <li key={slice.key} className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full" style={{ background: slice.color }} />
                    {slice.label}: {slice.value.toLocaleString("tr-TR")}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>

      {/* Tedarikçi karnesi */}
      <section className="rounded-xl border bg-card p-4">
        <h2 className="text-sm font-medium">Tedarikçi karnesi</h2>
        <p className="text-xs text-muted-foreground">Son {days} günün ortalamaları ve performans puanı.</p>

        {scored.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Henüz istatistik yok — bir içe aktarım çalıştırdığınızda burada görünür.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3">Tedarikçi</th>
                  <th className="py-2 pr-3">Ürün</th>
                  <th className="py-2 pr-3">Stoksuz %</th>
                  <th className="py-2 pr-3">Ortalama hız</th>
                  <th className="py-2 pr-3">İncelemede</th>
                  <th className="py-2">Puan</th>
                </tr>
              </thead>
              <tbody>
                {scored.map((supplier) => (
                  <tr key={supplier.feedId} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">{supplier.supplierName}</td>
                    <td className="py-2 pr-3">{Math.round(supplier.avgCatalogSize).toLocaleString("tr-TR")}</td>
                    <td className="py-2 pr-3">{pct(supplier.outOfStockPercent)}</td>
                    <td className="py-2 pr-3">{supplier.avgSpeedSeconds} sn</td>
                    <td className="py-2 pr-3">{supplier.totalQuarantined}</td>
                    <td className="py-2"><ScoreBadge score={supplier.score} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
