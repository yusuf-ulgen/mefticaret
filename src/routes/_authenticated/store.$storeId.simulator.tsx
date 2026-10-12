import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { simulate } from "@/lib/simulator";
import { simulatorDataQuery } from "@/lib/simulator-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/simulator")({
  head: () => ({
    meta: [
      { title: "Senaryo Simülatörü — Mefticaret" },
      {
        name: "description",
        content:
          "Fiyat, maliyet ve talep esnekliği varsayımlarını değiştirerek ciro ve kâr üzerindeki etkisini anında simüle et.",
      },
      { property: "og:title", content: "Senaryo Simülatörü — Mefticaret" },
      {
        property: "og:description",
        content: "What-if analizi: fiyat artışı, maliyet baskısı ve hacim etkisiyle kâr projeksiyonu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SimulatorPage,
});

const DEFAULTS = { priceDelta: 5, costDelta: 0, elasticity: -1.2, fixedCostPerOrder: 0 };

function SimulatorPage() {
  const { storeId } = Route.useParams();
  const [priceDelta, setPriceDelta] = useState(DEFAULTS.priceDelta);
  const [costDelta, setCostDelta] = useState(DEFAULTS.costDelta);
  const [elasticity, setElasticity] = useState(DEFAULTS.elasticity);
  const [fixedCostPerOrder, setFixedCostPerOrder] = useState(DEFAULTS.fixedCostPerOrder);

  const { data, isLoading } = useQuery(simulatorDataQuery(storeId));

  const result = useMemo(
    () =>
      simulate(data?.products ?? [], {
        priceDelta: priceDelta / 100,
        costDelta: costDelta / 100,
        elasticity,
        fixedCostPerOrder,
        orders: data?.orders ?? 0,
      }),
    [data, priceDelta, costDelta, elasticity, fixedCostPerOrder],
  );

  const reset = () => {
    setPriceDelta(DEFAULTS.priceDelta);
    setCostDelta(DEFAULTS.costDelta);
    setElasticity(DEFAULTS.elasticity);
    setFixedCostPerOrder(DEFAULTS.fixedCostPerOrder);
  };

  const exportCsv = () => {
    downloadCsv(
      `senaryo-simulasyonu-${storeId}.csv`,
      toCsv(
        ["Ürün", "Adet", "Ciro", "Kâr", "Senaryo adet", "Senaryo ciro", "Senaryo kâr", "Kâr farkı"],
        result.rows.map((row) => [
          row.title,
          row.baseUnits,
          row.baseRevenue.toFixed(2),
          row.baseProfit.toFixed(2),
          row.newUnits.toFixed(1),
          row.newRevenue.toFixed(2),
          row.newProfit.toFixed(2),
          row.profitDelta.toFixed(2),
        ]),
      ),
    );
  };

  const controls = [
    {
      label: "Fiyat değişimi",
      value: priceDelta,
      set: setPriceDelta,
      min: -40,
      max: 40,
      step: 1,
      suffix: "%",
    },
    {
      label: "Maliyet değişimi",
      value: costDelta,
      set: setCostDelta,
      min: -30,
      max: 60,
      step: 1,
      suffix: "%",
    },
    {
      label: "Talep esnekliği",
      value: elasticity,
      set: setElasticity,
      min: -3,
      max: 0,
      step: 0.1,
      suffix: "",
    },
    {
      label: "Sipariş başına sabit gider",
      value: fixedCostPerOrder,
      set: setFixedCostPerOrder,
      min: 0,
      max: 200,
      step: 5,
      suffix: "₺",
    },
  ];

  const kpis = [
    {
      label: "Ciro",
      base: formatMoney(result.base.revenue),
      scenario: formatMoney(result.scenario.revenue),
      delta: result.delta.revenue,
    },
    {
      label: "Kâr",
      base: formatMoney(result.base.profit),
      scenario: formatMoney(result.scenario.profit),
      delta: result.delta.profit,
    },
    {
      label: "Adet",
      base: formatNumber(Math.round(result.base.units)),
      scenario: formatNumber(Math.round(result.scenario.units)),
      delta: result.delta.units,
    },
  ];

  return (
    <AppShell
      storeId={storeId}
      title="Senaryo Simülatörü"
      description="Son 90 günlük gerçek satış verisi üzerinde fiyat, maliyet ve hacim varsayımlarını test et."
    >
      <div className="space-y-8">
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              <h2 className="font-display text-lg font-semibold">Varsayımlar</h2>
            </div>
            <Button size="sm" variant="outline" onClick={reset}>
              <RotateCcw className="mr-2 size-4" />
              Sıfırla
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {controls.map((control) => (
              <div key={control.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{control.label}</span>
                  <span className="font-medium">
                    {control.value.toFixed(control.step < 1 ? 1 : 0)}
                    {control.suffix}
                  </span>
                </div>
                <input
                  type="range"
                  className="w-full accent-primary"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={control.value}
                  onChange={(event) => control.set(Number(event.target.value))}
                  aria-label={control.label}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Esneklik −1,2: fiyat %10 artarsa hacim yaklaşık %12 düşer. Maliyet verisi girilmemiş
            ürünlerde %40 brüt marj varsayılır.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{kpi.scenario}</p>
              <p className="mt-1 text-xs text-muted-foreground">Mevcut: {kpi.base}</p>
              <p
                className={`mt-2 text-sm font-medium ${
                  kpi.delta > 0
                    ? "text-emerald-600"
                    : kpi.delta < 0
                      ? "text-destructive"
                      : "text-muted-foreground"
                }`}
              >
                {kpi.delta > 0 ? "+" : ""}
                {kpi.label === "Adet"
                  ? formatNumber(Math.round(kpi.delta))
                  : formatMoney(kpi.delta)}
              </p>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2 rounded-xl border bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Marj etkisi</h2>
            <p className="text-sm text-muted-foreground">
              Mevcut marj {(result.base.marginRate * 100).toFixed(1)}% → senaryo{" "}
              {(result.scenario.marginRate * 100).toFixed(1)}% (
              {result.delta.marginPoints > 0 ? "+" : ""}
              {result.delta.marginPoints.toFixed(1)} puan)
            </p>
            <p className="text-sm text-muted-foreground">
              {result.breakEvenVolumeChange === null
                ? "Başabaş hacim hesaplanamıyor (kâr verisi yetersiz)."
                : `Mevcut kârı korumak için hacim değişimi en az ${(
                    result.breakEvenVolumeChange * 100
                  ).toFixed(1)}% olmalı.`}
            </p>
          </div>
          <div className="space-y-2 rounded-xl border bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Senaryo özeti</h2>
            <p className="text-sm text-muted-foreground">
              Toplam maliyet {formatMoney(result.base.cost)} → {formatMoney(result.scenario.cost)}
            </p>
            <p className="text-sm text-muted-foreground">
              Dönem sipariş sayısı: {formatNumber(data?.orders ?? 0)} · Ürün sayısı:{" "}
              {formatNumber(result.rows.length)}
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Ürün bazlı etki</h2>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!result.rows.length}>
              <Download className="mr-2 size-4" />
              CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Ürün</th>
                  <th className="py-2">Adet</th>
                  <th className="py-2">Ciro</th>
                  <th className="py-2">Kâr</th>
                  <th className="py-2">Senaryo kâr</th>
                  <th className="py-2">Fark</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 150).map((row) => (
                  <tr key={row.productId} className="border-t">
                    <td className="py-2 font-medium">{row.title}</td>
                    <td className="py-2">{formatNumber(row.baseUnits)}</td>
                    <td className="py-2">{formatMoney(row.baseRevenue)}</td>
                    <td className="py-2">{formatMoney(row.baseProfit)}</td>
                    <td className="py-2">{formatMoney(row.newProfit)}</td>
                    <td
                      className={`py-2 font-medium ${
                        row.profitDelta > 0
                          ? "text-emerald-600"
                          : row.profitDelta < 0
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {row.profitDelta > 0 ? "+" : ""}
                      {formatMoney(row.profitDelta)}
                    </td>
                  </tr>
                ))}
                {!result.rows.length ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-sm text-muted-foreground">
                      {isLoading ? "Yükleniyor…" : "Satış kaydı bulunmuyor."}
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
