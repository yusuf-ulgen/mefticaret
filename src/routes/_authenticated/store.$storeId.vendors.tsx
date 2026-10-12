import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Factory } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { buildVendorRows, vendorSummary } from "@/lib/vendors";
import { vendorsQuery } from "@/lib/vendors-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/vendors")({
  head: () => ({
    meta: [
      { title: "Marka Performansı — Mefticaret" },
      {
        name: "description",
        content:
          "Marka (vendor) bazlı ciro payı, kâr marjı, iade oranı, stok değeri ve stok devir hızı karşılaştırması.",
      },
      { property: "og:title", content: "Marka Performansı — Mefticaret" },
      {
        property: "og:description",
        content: "Hangi markalar kâr üretiyor, hangileri stokta sermaye bağlıyor?",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VendorsPage,
});

function VendorsPage() {
  const { storeId } = Route.useParams();
  const [days, setDays] = useState(90);

  const { data, isLoading } = useQuery(vendorsQuery(storeId, days));
  const rows = useMemo(
    () => buildVendorRows(data?.sales ?? [], data?.stocks ?? [], data?.returns ?? []),
    [data],
  );
  const summary = useMemo(() => vendorSummary(rows), [rows]);
  const maxRevenue = Math.max(1, ...rows.map((row) => row.revenue));

  const exportCsv = () => {
    downloadCsv(
      `marka-performansi-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ["Marka", "Ürün", "Adet", "Ciro", "Kâr", "Marj %", "Ciro payı %", "Stok değeri", "Devir", "İade %"],
        rows.map((row) => [
          row.vendor,
          String(row.products),
          String(row.units),
          row.revenue.toFixed(2),
          row.profit.toFixed(2),
          row.marginRate.toFixed(1),
          row.revenueShare.toFixed(1),
          row.stockValue.toFixed(2),
          row.turnover === null ? "" : row.turnover.toFixed(2),
          row.returnRate.toFixed(1),
        ]),
      ),
    );
  };

  return (
    <AppShell
      storeId={storeId}
      title="Marka Performansı"
      description="Markaları ciro, kârlılık, iade oranı ve stok verimliliği açısından karşılaştır."
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="days">Dönem (gün)</Label>
            <Input
              id="days"
              type="number"
              min={7}
              max={365}
              className="w-32"
              value={days}
              onChange={(event) => setDays(Math.min(365, Math.max(7, Number(event.target.value) || 90)))}
            />
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
            <Download className="mr-2 size-4" /> CSV
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Marka verisi hesaplanıyor…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Marka bilgisi olan ürün veya satış bulunamadı.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Marka sayısı" value={formatNumber(summary.vendors)} hint={`İlk 3 marka payı %${summary.topThreeShare.toFixed(0)}`} />
              <Kpi label="Dönem cirosu" value={formatMoney(summary.revenue)} />
              <Kpi label="Brüt kâr" value={formatMoney(summary.profit)} hint={`Marj %${summary.marginRate.toFixed(1)}`} />
              <Kpi label="Stok maliyet değeri" value={formatMoney(summary.stockValue)} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Insight
                title="En yüksek ciro"
                vendor={summary.bestVendor?.vendor}
                detail={summary.bestVendor ? `${formatMoney(summary.bestVendor.revenue)} · pay %${summary.bestVendor.revenueShare.toFixed(1)}` : "—"}
              />
              <Insight
                title="En düşük marj"
                vendor={summary.worstMarginVendor?.vendor}
                detail={summary.worstMarginVendor ? `Marj %${summary.worstMarginVendor.marginRate.toFixed(1)}` : "—"}
                tone="warning"
              />
              <Insight
                title="En yüksek iade"
                vendor={summary.highestReturnVendor?.vendor}
                detail={summary.highestReturnVendor ? `İade %${summary.highestReturnVendor.returnRate.toFixed(1)}` : "—"}
                tone="warning"
              />
            </div>

            <section className="space-y-3">
              <h3 className="font-display flex items-center gap-2 text-lg">
                <Factory className="size-4 text-primary" /> Ciro dağılımı
              </h3>
              <div className="space-y-3 rounded-xl border p-5">
                {rows.slice(0, 12).map((row) => (
                  <div key={row.vendor} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{row.vendor}</span>
                      <span className="text-muted-foreground">
                        {formatMoney(row.revenue)} · %{row.revenueShare.toFixed(1)}
                      </span>
                    </div>
                    <div className="bg-muted h-3 overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${Math.round((row.revenue / maxRevenue) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg">Marka detayı</h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3">Marka</th>
                      <th className="p-3 text-right">Ürün</th>
                      <th className="p-3 text-right">Adet</th>
                      <th className="p-3 text-right">Ciro</th>
                      <th className="p-3 text-right">Marj</th>
                      <th className="p-3 text-right">Stok değeri</th>
                      <th className="p-3 text-right">Devir</th>
                      <th className="p-3 text-right">İade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.vendor} className="border-t">
                        <td className="p-3 font-medium">{row.vendor}</td>
                        <td className="p-3 text-right">{formatNumber(row.products)}</td>
                        <td className="p-3 text-right">{formatNumber(row.units)}</td>
                        <td className="p-3 text-right">{formatMoney(row.revenue)}</td>
                        <td className="p-3 text-right">
                          {row.marginRate < 15 && row.revenue > 0 ? (
                            <Badge variant="destructive">%{row.marginRate.toFixed(1)}</Badge>
                          ) : (
                            `%${row.marginRate.toFixed(1)}`
                          )}
                        </td>
                        <td className="p-3 text-right">{formatMoney(row.stockValue)}</td>
                        <td className="p-3 text-right">
                          {row.turnover === null ? "—" : `${row.turnover.toFixed(2)}x`}
                        </td>
                        <td className="p-3 text-right">%{row.returnRate.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
      <p className="font-display mt-2 text-2xl">{value}</p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

function Insight({
  title,
  vendor,
  detail,
  tone,
}: {
  title: string;
  vendor?: string | undefined;
  detail: string;
  tone?: "warning";
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{title}</p>
      <p className={`font-display mt-2 text-xl ${tone === "warning" ? "text-destructive" : ""}`}>
        {vendor ?? "—"}
      </p>
      <p className="text-muted-foreground mt-1 text-sm">{detail}</p>
    </div>
  );
}
