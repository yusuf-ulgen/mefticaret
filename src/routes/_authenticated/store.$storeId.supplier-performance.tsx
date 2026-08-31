import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Factory } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv, toCsv } from "@/lib/csv";
import { supplierPerformanceQuery } from "@/lib/logistics-queries";
import { formatMoney, formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/supplier-performance")({
  head: () => ({
    meta: [
      { title: "Tedarikçi Performansı — Mefticaret" },
      {
        name: "description",
        content: "Tedarikçi bazında sipariş hacmi, karşılama oranı ve ortalama tedarik süresi.",
      },
      { property: "og:title", content: "Tedarikçi Performansı — Mefticaret" },
      {
        property: "og:description",
        content: "Satın alma siparişlerinden hesaplanan karşılama oranı ve tedarik süresi raporu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupplierPerformancePage,
});

function SupplierPerformancePage() {
  const { storeId } = Route.useParams();
  const [windowDays, setWindowDays] = useState(180);
  const { data, isLoading } = useQuery(supplierPerformanceQuery(storeId, windowDays));
  const rows = data ?? [];

  const totalCost = rows.reduce((sum, row) => sum + row.totalCost, 0);
  const totalOrders = rows.reduce((sum, row) => sum + row.orders, 0);
  const openOrders = rows.reduce((sum, row) => sum + row.openOrders, 0);
  const leadDays = rows.map((row) => row.avgLeadDays).filter((value): value is number => value != null);
  const avgLead = leadDays.length > 0 ? leadDays.reduce((a, b) => a + b, 0) / leadDays.length : null;

  const exportCsv = () => {
    downloadCsv(
      `tedarikci-performansi-${storeId}.csv`,
      toCsv(
        ["Tedarikçi", "Sipariş", "Açık sipariş", "Sipariş adedi", "Gelen adet", "Karşılama %", "Maliyet", "Tedarik gün"],
        rows.map((row) => [
          row.name,
          row.orders,
          row.openOrders,
          row.orderedUnits,
          row.receivedUnits,
          (row.fillRate * 100).toFixed(1),
          row.totalCost.toFixed(2),
          row.avgLeadDays?.toFixed(2) ?? "",
        ]),
      ),
    );
  };

  return (
    <AppShell
      storeId={storeId}
      title="Tedarikçi Performansı"
      description="Satın alma siparişlerinden karşılama oranı, tedarik süresi ve maliyet dağılımı."
    >
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="window">Pencere (gün)</Label>
            <Input
              id="window"
              type="number"
              min={30}
              max={730}
              className="w-32"
              value={windowDays}
              onChange={(event) =>
                setWindowDays(Math.min(730, Math.max(30, Number(event.target.value) || 180)))
              }
            />
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="mr-2 size-4" /> CSV
          </Button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Toplam satın alma" value={formatMoney(totalCost)} hint={`${formatNumber(totalOrders)} sipariş`} />
          <Kpi label="Açık sipariş" value={formatNumber(openOrders)} hint="Mal kabul bekleyen" />
          <Kpi
            label="Ortalama tedarik süresi"
            value={avgLead == null ? "—" : `${avgLead.toFixed(1)} gün`}
            hint="Sipariş → mal kabul"
          />
          <Kpi label="Tedarikçi sayısı" value={formatNumber(rows.length)} hint="Dönemde sipariş verilen" />
        </div>

        <section className="rounded-xl border bg-card">
          <div className="border-b p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Factory className="size-4 text-primary" /> Tedarikçi tablosu
            </h2>
          </div>
          {isLoading ? (
            <p className="p-5 text-sm text-muted-foreground">Yükleniyor…</p>
          ) : rows.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Bu dönemde satın alma siparişi yok.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">Tedarikçi</th>
                    <th className="p-3 text-right">Sipariş</th>
                    <th className="p-3 text-right">Açık</th>
                    <th className="p-3 text-right">Karşılama</th>
                    <th className="p-3 text-right">Tedarik (gün)</th>
                    <th className="p-3 text-right">Maliyet</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.supplierId} className="border-t">
                      <td className="p-3 font-medium">{row.name}</td>
                      <td className="p-3 text-right">{formatNumber(row.orders)}</td>
                      <td className="p-3 text-right">{formatNumber(row.openOrders)}</td>
                      <td className="p-3 text-right">{(row.fillRate * 100).toFixed(1)}%</td>
                      <td className="p-3 text-right">{row.avgLeadDays?.toFixed(1) ?? "—"}</td>
                      <td className="p-3 text-right">{formatMoney(row.totalCost)}</td>
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
