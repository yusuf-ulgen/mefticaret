import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Truck } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv, toCsv } from "@/lib/csv";
import { carrierPerformance, logisticsSummary } from "@/lib/logistics-performance";
import { logisticsPerformanceQuery } from "@/lib/logistics-queries";
import { formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/shipping-performance")({
  head: () => ({
    meta: [
      { title: "Kargo Performansı — Mefticaret" },
      {
        name: "description",
        content: "Kargo firması bazında teslim oranı, sevk süresi, teslim süresi ve geciken sevkiyatlar.",
      },
      { property: "og:title", content: "Kargo Performansı — Mefticaret" },
      {
        property: "og:description",
        content: "Taşıyıcı karşılaştırması, ortalama teslim süresi ve geciken gönderi takibi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShippingPerformancePage,
});

function ShippingPerformancePage() {
  const { storeId } = Route.useParams();
  const [windowDays, setWindowDays] = useState(90);
  const [slowThreshold, setSlowThreshold] = useState(7);

  const { data, isLoading } = useQuery(logisticsPerformanceQuery(storeId, windowDays));
  const rows = data ?? [];
  const summary = useMemo(() => logisticsSummary(rows, slowThreshold), [rows, slowThreshold]);
  const carriers = useMemo(() => carrierPerformance(rows), [rows]);

  const exportCsv = () => {
    downloadCsv(
      `kargo-performansi-${storeId}.csv`,
      toCsv(
        ["Taşıyıcı", "Sevkiyat", "Teslim", "İade", "Yolda", "Teslim oranı %", "Sevk gün", "Teslim gün"],
        carriers.map((row) => [
          row.carrier,
          row.shipments,
          row.delivered,
          row.returned,
          row.inTransit,
          (row.deliveryRate * 100).toFixed(1),
          row.avgDispatchDays?.toFixed(2) ?? "",
          row.avgDeliveryDays?.toFixed(2) ?? "",
        ]),
      ),
    );
  };

  return (
    <AppShell
      storeId={storeId}
      title="Kargo Performansı"
      description="Taşıyıcı bazında teslim oranı, sevk/teslim süreleri ve geciken gönderiler."
    >
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="window">Pencere (gün)</Label>
              <Input
                id="window"
                type="number"
                min={7}
                max={365}
                className="w-28"
                value={windowDays}
                onChange={(event) =>
                  setWindowDays(Math.min(365, Math.max(7, Number(event.target.value) || 90)))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="slow">Gecikme eşiği (gün)</Label>
              <Input
                id="slow"
                type="number"
                min={1}
                max={60}
                className="w-28"
                value={slowThreshold}
                onChange={(event) =>
                  setSlowThreshold(Math.min(60, Math.max(1, Number(event.target.value) || 7)))
                }
              />
            </div>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={carriers.length === 0}>
            <Download className="mr-2 size-4" /> CSV
          </Button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Sevkiyat"
            value={formatNumber(summary.total)}
            hint={`${formatNumber(summary.inTransit)} yolda · ${formatNumber(summary.pending)} bekliyor`}
          />
          <Kpi
            label="Teslim oranı"
            value={`${(summary.deliveryRate * 100).toFixed(1)}%`}
            hint={`${formatNumber(summary.delivered)} teslim · ${formatNumber(summary.returned)} iade`}
          />
          <Kpi
            label="Ortalama sevk süresi"
            value={summary.avgDispatchDays == null ? "—" : `${summary.avgDispatchDays.toFixed(1)} gün`}
            hint="Sipariş → kargoya teslim"
          />
          <Kpi
            label="Ortalama teslim süresi"
            value={summary.avgDeliveryDays == null ? "—" : `${summary.avgDeliveryDays.toFixed(1)} gün`}
            hint={`${formatNumber(summary.slowShipments)} gönderi gecikmede`}
          />
        </div>

        <section className="rounded-xl border bg-card">
          <div className="border-b p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Truck className="size-4 text-primary" /> Taşıyıcı karşılaştırması
            </h2>
          </div>
          {isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Yükleniyor…</p>
          ) : carriers.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Bu dönemde sevkiyat kaydı yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Taşıyıcı</th>
                    <th className="p-3 text-right">Sevkiyat</th>
                    <th className="p-3 text-right">Teslim oranı</th>
                    <th className="p-3 text-right">İade oranı</th>
                    <th className="p-3 text-right">Sevk (gün)</th>
                    <th className="p-3 text-right">Teslim (gün)</th>
                  </tr>
                </thead>
                <tbody>
                  {carriers.map((row) => (
                    <tr key={row.carrier} className="border-t">
                      <td className="p-3 font-medium">{row.carrier}</td>
                      <td className="p-3 text-right">{formatNumber(row.shipments)}</td>
                      <td className="p-3 text-right">{(row.deliveryRate * 100).toFixed(1)}%</td>
                      <td className="p-3 text-right">{(row.returnRate * 100).toFixed(1)}%</td>
                      <td className="p-3 text-right">{row.avgDispatchDays?.toFixed(1) ?? "—"}</td>
                      <td className="p-3 text-right">{row.avgDeliveryDays?.toFixed(1) ?? "—"}</td>
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
