import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Download, Grid3x3 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { analyticsOrdersQuery } from "@/lib/analytics-queries";
import { averageRetention, buildCohorts, heatClass } from "@/lib/cohorts";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";
import { cn } from "@/lib/utils";

const MONTHS = 6;

export const Route = createFileRoute("/_authenticated/store/$storeId/cohorts")({
  head: () => ({
    meta: [
      { title: "Kohort Analizi — Mefticaret" },
      {
        name: "description",
        content:
          "Müşterileri ilk sipariş ayına göre gruplayarak geri dönüş oranlarını ve kohort bazlı ciroyu ısı haritasıyla izleyin.",
      },
      { property: "og:title", content: "Kohort Analizi — Mefticaret" },
      {
        property: "og:description",
        content: "Aylık müşteri kohortları, tutundurma oranları ve kohort bazlı ciro dağılımı.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CohortsPage,
});

function CohortsPage() {
  const { storeId } = Route.useParams();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: orders, isLoading } = useQuery(analyticsOrdersQuery(storeId, 365));
  const currency = store?.currency ?? "TRY";

  const rows = useMemo(() => buildCohorts(orders ?? [], MONTHS), [orders]);
  const averages = useMemo(() => averageRetention(rows, MONTHS), [rows]);

  const totals = useMemo(
    () => ({
      customers: rows.reduce((sum, row) => sum + row.size, 0),
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
      repeat: averages[1] ?? 0,
    }),
    [rows, averages],
  );

  function exportCsv() {
    const header = ["Kohort", "Müşteri", "Ciro", ...Array.from({ length: MONTHS }, (_, i) => `Ay ${i}`)];
    const content = toCsv(
      header,
      rows.map((row) => [
        row.cohort,
        row.size,
        row.revenue.toFixed(2),
        ...row.cells.map((cell) => `${Math.round(cell.rate * 100)}%`),
      ]),
    );
    downloadCsv(`kohortlar-${new Date().toISOString().slice(0, 10)}.csv`, content);
  }

  return (
    <AppShell storeId={storeId} title="Kohort Analizi">
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Grid3x3 className="size-5 text-primary" /> Kohort analizi
            </h1>
            <p className="text-sm text-muted-foreground">
              Müşteriler ilk sipariş ayına göre gruplanır; sonraki aylarda tekrar sipariş verme oranı
              (retention) ısı haritasında gösterilir.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="mr-2 size-4" /> CSV indir
          </Button>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Toplam müşteri</p>
            <p className="mt-1 text-2xl font-semibold">{formatNumber(totals.customers)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Kohort cirosu (12 ay)</p>
            <p className="mt-1 text-2xl font-semibold">{formatMoney(totals.revenue, currency)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Ortalama 2. ay dönüşü
            </p>
            <p className="mt-1 text-2xl font-semibold">{Math.round(totals.repeat * 100)}%</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-card">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Henüz kohort oluşturacak sipariş yok. İlk siparişler geldikçe tablo otomatik dolar.
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Kohort</th>
                  <th className="px-3 py-2 text-right font-medium">Müşteri</th>
                  {Array.from({ length: MONTHS }).map((_, index) => (
                    <th key={index} className="px-3 py-2 text-center font-medium">
                      Ay {index}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right font-medium">Ciro</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.cohort}>
                    <td className="px-4 py-2 font-medium">{row.cohort}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(row.size)}</td>
                    {row.cells.map((cell) => (
                      <td key={cell.index} className="px-1 py-1 text-center">
                        <span
                          title={`${formatNumber(cell.customers)} müşteri · ${formatMoney(cell.revenue, currency)}`}
                          className={cn(
                            "inline-flex min-w-14 justify-center rounded-md px-2 py-1 text-xs font-medium",
                            heatClass(cell.rate),
                          )}
                        >
                          {cell.rate > 0 ? `${Math.round(cell.rate * 100)}%` : "—"}
                        </span>
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-medium">
                      {formatMoney(row.revenue, currency)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/30 text-xs">
                  <td className="px-4 py-2 font-medium">Ortalama</td>
                  <td className="px-3 py-2" />
                  {averages.map((rate, index) => (
                    <td key={index} className="px-3 py-2 text-center font-medium">
                      {Math.round(rate * 100)}%
                    </td>
                  ))}
                  <td className="px-4 py-2" />
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppShell>
  );
}
