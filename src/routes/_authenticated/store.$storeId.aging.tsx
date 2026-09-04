import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Hourglass } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { agingBuckets, agingSummary, buildAging, liquidationPlan, type AgingBucketKey } from "@/lib/aging";
import { agingQuery } from "@/lib/aging-queries";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDate, formatMoney, formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/aging")({
  head: () => ({
    meta: [
      { title: "Stok Yaşlandırma — Mefticaret" },
      {
        name: "description",
        content:
          "Son satış tarihine göre stok yaşlandırma analizi: ölü stokta bağlanan sermaye, yaş dilimleri ve tasfiye önerileri.",
      },
      { property: "og:title", content: "Stok Yaşlandırma — Mefticaret" },
      {
        property: "og:description",
        content: "Ölü stok değeri, ağırlıklı ortalama stok yaşı ve kademeli tasfiye indirim planı.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgingPage,
});

const BUCKET_TONE: Record<AgingBucketKey, string> = {
  fresh: "bg-primary",
  slow: "bg-primary/70",
  stale: "bg-primary/45",
  dead: "bg-destructive",
};

function AgingPage() {
  const { storeId } = Route.useParams();
  const [filter, setFilter] = useState<AgingBucketKey | "all">("all");

  const { data, isLoading } = useQuery(agingQuery(storeId));
  const rows = useMemo(() => buildAging(data ?? []), [data]);
  const buckets = useMemo(() => agingBuckets(rows), [rows]);
  const summary = useMemo(() => agingSummary(rows), [rows]);
  const plan = useMemo(() => liquidationPlan(rows), [rows]);

  const visible = filter === "all" ? rows : rows.filter((row) => row.bucket === filter);
  const maxValue = Math.max(1, ...buckets.map((bucket) => bucket.stockValue));

  const exportCsv = () => {
    downloadCsv(
      `stok-yaslandirma-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ["Ürün", "SKU", "Stok", "Gün", "Dilim", "Maliyet değeri", "Perakende değeri", "Son satış"],
        visible.map((row) => [
          row.title,
          row.sku ?? "",
          String(row.stock),
          String(row.daysSinceSale),
          row.bucket,
          row.stockValue.toFixed(2),
          row.retailValue.toFixed(2),
          row.lastSaleAt ? row.lastSaleAt.slice(0, 10) : "",
        ]),
      ),
    );
  };

  return (
    <AppShell
      storeId={storeId}
      title="Stok Yaşlandırma"
      description="Son satış tarihine göre stokta bağlanan sermayeyi ölç, tasfiye önceliklerini belirle."
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!visible.length}>
            <Download className="mr-2 size-4" /> CSV
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Yaşlandırma hesaplanıyor…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">Stoklu ürün bulunamadı.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi label="Stok maliyet değeri" value={formatMoney(summary.stockValue)} hint={`${formatNumber(summary.units)} adet`} />
              <Kpi
                label="Ölü stok (120+ gün)"
                value={formatMoney(summary.deadValue)}
                hint={`Toplamın %${summary.deadShare.toFixed(1)}'i`}
              />
              <Kpi label="Ortalama stok yaşı" value={`${summary.averageAgeDays.toFixed(0)} gün`} hint="Değer ağırlıklı" />
              <Kpi label="Hiç satılmayan" value={formatNumber(summary.neverSold)} hint="ürün" />
            </div>

            <section className="space-y-3">
              <h3 className="font-display flex items-center gap-2 text-lg">
                <Hourglass className="size-4 text-primary" /> Yaş dilimleri
              </h3>
              <div className="space-y-3 rounded-xl border p-5">
                {buckets.map((bucket) => (
                  <button
                    key={bucket.key}
                    type="button"
                    onClick={() => setFilter(filter === bucket.key ? "all" : bucket.key)}
                    className="w-full space-y-1 text-left"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className={filter === bucket.key ? "font-semibold" : undefined}>
                        {bucket.label} · {formatNumber(bucket.products)} ürün
                      </span>
                      <span className="text-muted-foreground">
                        {formatMoney(bucket.stockValue)} · {formatNumber(bucket.units)} adet
                      </span>
                    </div>
                    <div className="bg-muted h-3 overflow-hidden rounded-full">
                      <div
                        className={`h-full rounded-full ${BUCKET_TONE[bucket.key]}`}
                        style={{ width: `${Math.round((bucket.stockValue / maxValue) * 100)}%` }}
                      />
                    </div>
                  </button>
                ))}
                <p className="text-muted-foreground text-xs">
                  Dilime tıklayarak tabloyu filtreleyebilirsin.
                </p>
              </div>
            </section>

            {plan.length > 0 ? (
              <section className="space-y-3">
                <h3 className="font-display text-lg">Tasfiye planı</h3>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-3">Ürün</th>
                        <th className="p-3 text-right">Stok</th>
                        <th className="p-3 text-right">Önerilen indirim</th>
                        <th className="p-3 text-right">Tahmini nakit</th>
                        <th className="p-3 text-right">Maliyet üstü</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.slice(0, 25).map((row) => (
                        <tr key={row.productId} className="border-t">
                          <td className="p-3">
                            <div className="font-medium">{row.title}</div>
                            <div className="text-muted-foreground text-xs">
                              {row.daysSinceSale} gündür satılmadı
                            </div>
                          </td>
                          <td className="p-3 text-right">{formatNumber(row.stock)}</td>
                          <td className="p-3 text-right">%{(row.discount * 100).toFixed(0)}</td>
                          <td className="p-3 text-right">{formatMoney(row.cashIn)}</td>
                          <td className="p-3 text-right">
                            <span className={row.marginAfter < 0 ? "text-destructive" : undefined}>
                              {formatMoney(row.marginAfter)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <h3 className="font-display text-lg">Ürün detayı</h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3">Ürün</th>
                      <th className="p-3 text-right">Stok</th>
                      <th className="p-3 text-right">Yaş</th>
                      <th className="p-3 text-right">Maliyet değeri</th>
                      <th className="p-3 text-right">Tükenme</th>
                      <th className="p-3 text-right">Son satış</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.slice(0, 150).map((row) => (
                      <tr key={row.productId} className="border-t">
                        <td className="p-3">
                          <div className="font-medium">{row.title}</div>
                          <div className="text-muted-foreground text-xs">{row.sku ?? "—"}</div>
                        </td>
                        <td className="p-3 text-right">{formatNumber(row.stock)}</td>
                        <td className="p-3 text-right">
                          {row.bucket === "dead" ? (
                            <Badge variant="destructive">{row.daysSinceSale} gün</Badge>
                          ) : (
                            `${row.daysSinceSale} gün`
                          )}
                        </td>
                        <td className="p-3 text-right">{formatMoney(row.stockValue)}</td>
                        <td className="p-3 text-right">
                          {row.coverDays === null ? "—" : `${row.coverDays.toFixed(0)} gün`}
                        </td>
                        <td className="p-3 text-right">
                          {row.lastSaleAt ? formatDate(row.lastSaleAt) : "—"}
                        </td>
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
