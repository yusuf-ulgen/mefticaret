import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import {
  GROUP_LABEL,
  buildValuation,
  groupValuation,
  valuationSummary,
  type ValuationGroupBy,
} from "@/lib/valuation";
import { valuationDataQuery } from "@/lib/valuation-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/valuation")({
  head: () => ({
    meta: [
      { title: "Envanter Değerleme — Mefticaret" },
      {
        name: "description",
        content:
          "Elde tutulan stoğun maliyet ve perakende değerini, potansiyel brüt kârı ve marka bazlı dağılımı raporla.",
      },
      { property: "og:title", content: "Envanter Değerleme — Mefticaret" },
      {
        property: "og:description",
        content: "Stok maliyet değeri, perakende değeri, brüt marj ve eksik maliyet denetimi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ValuationPage,
});

const GROUP_OPTIONS: ValuationGroupBy[] = ["vendor", "productType", "status"];

function ValuationPage() {
  const { storeId } = Route.useParams();
  const [groupBy, setGroupBy] = useState<ValuationGroupBy>("vendor");
  const [search, setSearch] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);

  const { data, isLoading } = useQuery(valuationDataQuery(storeId));
  const lines = useMemo(() => buildValuation(data ?? []), [data]);
  const summary = useMemo(() => valuationSummary(lines), [lines]);
  const groups = useMemo(() => groupValuation(lines, groupBy), [lines, groupBy]);

  const term = search.trim().toLowerCase();
  const visible = lines.filter((line) => {
    const matches =
      !term ||
      line.title.toLowerCase().includes(term) ||
      (line.sku ?? "").toLowerCase().includes(term);
    const issue = line.missingCost || (line.margin !== null && line.margin < 0);
    return matches && (!onlyIssues || issue);
  });

  const exportCsv = () => {
    downloadCsv(
      `envanter-degerleme-${storeId}.csv`,
      toCsv(
        [
          "Ürün",
          "SKU",
          "Marka",
          "Tip",
          "Durum",
          "Stok",
          "Satış fiyatı",
          "Maliyet",
          "Maliyet değeri",
          "Perakende değeri",
          "Potansiyel kâr",
          "Marj %",
        ],
        visible.map((line) => [
          line.title,
          line.sku ?? "",
          line.vendor ?? "",
          line.productType ?? "",
          line.status,
          line.stock,
          line.price.toFixed(2),
          line.costPrice == null ? "" : line.costPrice.toFixed(2),
          line.costValue.toFixed(2),
          line.retailValue.toFixed(2),
          line.potentialProfit.toFixed(2),
          line.margin == null ? "" : (line.margin * 100).toFixed(1),
        ]),
      ),
    );
  };

  return (
    <AppShell
      storeId={storeId}
      title="Envanter Değerleme"
      description="Depodaki stoğun maliyet ve satış değerini, potansiyel brüt kârı ve eksik maliyet kayıtlarını gör."
    >
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Maliyet değeri", value: formatMoney(summary.costValue) },
            { label: "Perakende değeri", value: formatMoney(summary.retailValue) },
            { label: "Potansiyel brüt kâr", value: formatMoney(summary.potentialProfit) },
            {
              label: "Karma marj",
              value:
                summary.blendedMargin === null
                  ? "—"
                  : `${(summary.blendedMargin * 100).toFixed(1)}%`,
            },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{kpi.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Toplam SKU", value: formatNumber(summary.skuCount) },
            { label: "Toplam adet", value: formatNumber(summary.units) },
            { label: "Stoğu tükenen", value: formatNumber(summary.outOfStockCount) },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="mt-1 font-display text-xl font-semibold">{item.value}</p>
            </div>
          ))}
        </section>

        {(summary.missingCostCount > 0 || summary.negativeMarginCount > 0) && (
          <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 text-destructive" />
              <div className="space-y-1 text-sm">
                {summary.missingCostCount > 0 && (
                  <p>
                    <strong>{formatNumber(summary.missingCostCount)}</strong> varyantta maliyet
                    fiyatı yok; bu kalemler maliyet değerine dahil edilmedi.{" "}
                    <Link
                      to="/store/$storeId/products"
                      params={{ storeId }}
                      className="underline underline-offset-4"
                    >
                      Ürünleri düzenle
                    </Link>
                  </p>
                )}
                {summary.negativeMarginCount > 0 && (
                  <p>
                    <strong>{formatNumber(summary.negativeMarginCount)}</strong> varyant maliyetin
                    altında fiyatlanmış — zararına satış riski.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Warehouse className="size-4 text-muted-foreground" />
              <h2 className="font-display text-lg font-semibold">Dağılım</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {GROUP_OPTIONS.map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={groupBy === option ? "default" : "outline"}
                  onClick={() => setGroupBy(option)}
                >
                  {GROUP_LABEL[option]}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groups.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Yükleniyor…" : "Henüz stok verisi yok."}
              </p>
            )}
            {groups.map((group) => (
              <div key={group.key} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{group.label}</p>
                  <Badge variant="outline">{(group.share * 100).toFixed(0)}%</Badge>
                </div>
                <p className="mt-2 font-display text-lg font-semibold">
                  {formatMoney(group.retailValue)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Maliyet {formatMoney(group.costValue)} · {formatNumber(group.units)} adet ·{" "}
                  {formatNumber(group.items)} SKU
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="valuation-search">Ürün / SKU ara</Label>
              <Input
                id="valuation-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Örn. gömlek veya MEF-001"
                className="w-64"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={onlyIssues ? "default" : "outline"}
                onClick={() => setOnlyIssues((value) => !value)}
              >
                Sorunlu kalemler
              </Button>
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!visible.length}>
                <Download className="mr-2 size-4" /> CSV
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Ürün</th>
                  <th className="py-2 pr-3">SKU</th>
                  <th className="py-2 pr-3 text-right">Stok</th>
                  <th className="py-2 pr-3 text-right">Maliyet değeri</th>
                  <th className="py-2 pr-3 text-right">Perakende</th>
                  <th className="py-2 pr-3 text-right">Potansiyel kâr</th>
                  <th className="py-2 text-right">Marj</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-muted-foreground">
                      {isLoading ? "Yükleniyor…" : "Kayıt bulunamadı."}
                    </td>
                  </tr>
                )}
                {visible.slice(0, 300).map((line) => (
                  <tr key={line.variantId} className="border-b last:border-0">
                    <td className="max-w-[280px] truncate py-2 pr-3">
                      {line.productId ? (
                        <Link
                          to="/store/$storeId/products/$productId"
                          params={{ storeId, productId: line.productId }}
                          className="hover:underline"
                        >
                          {line.title}
                        </Link>
                      ) : (
                        line.title
                      )}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{line.sku ?? "—"}</td>
                    <td className="py-2 pr-3 text-right">{formatNumber(line.stock)}</td>
                    <td className="py-2 pr-3 text-right">
                      {line.missingCost ? (
                        <Badge variant="outline">Maliyet yok</Badge>
                      ) : (
                        formatMoney(line.costValue)
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right">{formatMoney(line.retailValue)}</td>
                    <td className="py-2 pr-3 text-right">
                      {line.missingCost ? "—" : formatMoney(line.potentialProfit)}
                    </td>
                    <td className="py-2 text-right">
                      {line.margin == null ? (
                        "—"
                      ) : (
                        <span className={line.margin < 0 ? "text-destructive" : undefined}>
                          {(line.margin * 100).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visible.length > 300 && (
            <p className="text-xs text-muted-foreground">
              İlk 300 kalem gösteriliyor; tamamı için CSV indir.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
