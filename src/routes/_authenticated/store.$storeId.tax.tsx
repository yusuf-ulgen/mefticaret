import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Receipt } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { storeQuery, storeSettingsQuery } from "@/lib/store-queries";
import { buildTaxPeriods, taxTotals } from "@/lib/tax";
import { taxOrdersQuery } from "@/lib/tax-queries";

const RANGES = [
  { value: "90", label: "Son 3 ay" },
  { value: "180", label: "Son 6 ay" },
  { value: "365", label: "Son 12 ay" },
];

export const Route = createFileRoute("/_authenticated/store/$storeId/tax")({
  head: () => ({
    meta: [
      { title: "KDV & Vergi Raporu — Mefticaret" },
      {
        name: "description",
        content:
          "Aylık ve çeyreklik KDV matrahı, hesaplanan vergi ve brüt satışları tek ekranda görüntüleyip CSV olarak indirin.",
      },
      { property: "og:title", content: "KDV & Vergi Raporu — Mefticaret" },
      {
        property: "og:description",
        content: "Dönemsel vergi matrahı, hesaplanan KDV ve muhasebe için CSV çıktısı.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TaxPage,
});

function TaxPage() {
  const { storeId } = Route.useParams();
  const [range, setRange] = useState("365");
  const [granularity, setGranularity] = useState<"month" | "quarter">("month");

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: settings } = useQuery(storeSettingsQuery(storeId));
  const { data: orders, isLoading } = useQuery(taxOrdersQuery(storeId, Number(range)));

  const currency = store?.currency ?? "TRY";
  const rate = Number(settings?.default_tax_rate ?? 0);
  const included = Boolean(settings?.tax_included_prices ?? true);

  const rows = useMemo(
    () =>
      buildTaxPeriods(orders ?? [], {
        rate: rate > 1 ? rate / 100 : rate,
        includedInPrices: included,
        granularity,
      }),
    [orders, rate, included, granularity],
  );
  const totals = useMemo(() => taxTotals(rows), [rows]);

  function exportCsv() {
    const content = toCsv(
      ["Dönem", "Sipariş", "Net satış", "Kargo", "Vergi matrahı", "Hesaplanan KDV", "Brüt"],
      rows.map((row) => [
        row.period,
        row.orders,
        row.netSales.toFixed(2),
        row.shipping.toFixed(2),
        row.taxableBase.toFixed(2),
        row.tax.toFixed(2),
        row.gross.toFixed(2),
      ]),
    );
    downloadCsv(`kdv-raporu-${new Date().toISOString().slice(0, 10)}.csv`, content);
  }

  return (
    <AppShell storeId={storeId} title="KDV Raporu">
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Receipt className="size-5 text-primary" /> KDV & vergi raporu
            </h1>
            <p className="text-sm text-muted-foreground">
              İptal ve iade edilen siparişler matrahtan çıkarılır. Varsayılan oran %
              {formatNumber(rate > 1 ? rate : rate * 100)} ·{" "}
              {included ? "fiyatlar vergi dahil" : "fiyatlar vergi hariç"}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={granularity} onValueChange={(value) => setGranularity(value as "month" | "quarter")}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Aylık</SelectItem>
                <SelectItem value="quarter">Çeyreklik</SelectItem>
              </SelectContent>
            </Select>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="mr-2 size-4" /> CSV
            </Button>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Sipariş" value={formatNumber(totals.orders)} />
          <Kpi label="Vergi matrahı" value={formatMoney(totals.taxableBase, currency)} />
          <Kpi label="Hesaplanan KDV" value={formatMoney(totals.tax, currency)} />
          <Kpi label="Brüt satış" value={formatMoney(totals.gross, currency)} />
        </div>

        <section className="overflow-x-auto rounded-xl border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Dönemsel döküm</h2>
            <p className="text-xs text-muted-foreground">
              Siparişte kayıtlı vergi tutarı yoksa mağaza ayarındaki orandan türetilir.
            </p>
          </div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Seçilen dönemde vergiye tabi sipariş yok.
            </p>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Dönem</th>
                  <th className="px-3 py-2 text-right font-medium">Sipariş</th>
                  <th className="px-3 py-2 text-right font-medium">Net satış</th>
                  <th className="px-3 py-2 text-right font-medium">Kargo</th>
                  <th className="px-3 py-2 text-right font-medium">Matrah</th>
                  <th className="px-3 py-2 text-right font-medium">KDV</th>
                  <th className="px-4 py-2 text-right font-medium">Brüt</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.period}>
                    <td className="px-4 py-2 font-medium">{row.period}</td>
                    <td className="px-3 py-2 text-right">{formatNumber(row.orders)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(row.netSales, currency)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(row.shipping, currency)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(row.taxableBase, currency)}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatMoney(row.tax, currency)}
                    </td>
                    <td className="px-4 py-2 text-right">{formatMoney(row.gross, currency)}</td>
                  </tr>
                ))}
                <tr className="border-t bg-muted/30">
                  <td className="px-4 py-2 font-medium">Toplam</td>
                  <td className="px-3 py-2 text-right">{formatNumber(totals.orders)}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right font-medium">
                    {formatMoney(totals.taxableBase, currency)}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatMoney(totals.tax, currency)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    {formatMoney(totals.gross, currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
