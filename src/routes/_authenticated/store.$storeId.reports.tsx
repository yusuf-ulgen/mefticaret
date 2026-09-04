import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, PackageSearch, Search, TrendingDown, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  analyticsItemsQuery,
  productPerformanceStockQuery,
} from "@/lib/analytics-queries";
import { storeQuery } from "@/lib/store-queries";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";

const RANGES = [7, 30, 90] as const;

export const Route = createFileRoute("/_authenticated/store/$storeId/reports")({
  head: () => ({
    meta: [
      { title: "Ürün Performans Raporu — Mefticaret" },
      {
        name: "description",
        content:
          "Ürün bazlı satış adedi, ciro, ortalama satış fiyatı, stok devir hızı ve tükenme tahmini raporu.",
      },
      { property: "og:title", content: "Ürün Performans Raporu — Mefticaret" },
      {
        property: "og:description",
        content: "Hangi ürünler satıyor, hangileri stokta bekliyor? Dönemsel ürün performans analizi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportsPage,
});

type Row = {
  productId: string | null;
  title: string;
  quantity: number;
  revenue: number;
  orders: number;
  stock: number | null;
  status: string | null;
  perDay: number;
  daysLeft: number | null;
};

function ReportsPage() {
  const { storeId } = Route.useParams();
  const [days, setDays] = useState<number>(30);
  const [term, setTerm] = useState("");

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: items, isLoading } = useQuery(analyticsItemsQuery(storeId, days));
  const { data: catalog } = useQuery(productPerformanceStockQuery(storeId));

  const currency = store?.currency ?? "TRY";

  const rows = useMemo<Row[]>(() => {
    const byProduct = new Map<string, Row>();
    for (const item of items ?? []) {
      const key = item.product_id ? String(item.product_id) : `t:${item.title}`;
      const entry =
        byProduct.get(key) ??
        ({
          productId: item.product_id ? String(item.product_id) : null,
          title: item.title,
          quantity: 0,
          revenue: 0,
          orders: 0,
          stock: null,
          status: null,
          perDay: 0,
          daysLeft: null,
        } satisfies Row);
      entry.quantity += Number(item.quantity ?? 0);
      entry.revenue += Number(item.line_total ?? 0);
      entry.orders += 1;
      byProduct.set(key, entry);
    }

    // Hiç satmayan aktif ürünler de raporda görünsün.
    for (const product of catalog ?? []) {
      const existing = byProduct.get(product.id);
      if (existing) {
        existing.stock = product.stock;
        existing.status = product.status;
        continue;
      }
      byProduct.set(product.id, {
        productId: product.id,
        title: product.title,
        quantity: 0,
        revenue: 0,
        orders: 0,
        stock: product.stock,
        status: product.status,
        perDay: 0,
        daysLeft: null,
      });
    }

    return [...byProduct.values()]
      .map((row) => {
        const perDay = row.quantity / days;
        const daysLeft = perDay > 0 && row.stock !== null ? row.stock / perDay : null;
        return { ...row, perDay, daysLeft };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }, [items, catalog, days]);

  const filtered = useMemo(() => {
    const needle = term.trim().toLocaleLowerCase("tr");
    if (!needle) return rows;
    return rows.filter((row) => row.title.toLocaleLowerCase("tr").includes(needle));
  }, [rows, term]);

  const totals = useMemo(() => {
    const revenue = rows.reduce((total, row) => total + row.revenue, 0);
    const quantity = rows.reduce((total, row) => total + row.quantity, 0);
    return {
      revenue,
      quantity,
      selling: rows.filter((row) => row.quantity > 0).length,
      idle: rows.filter((row) => row.quantity === 0 && (row.stock ?? 0) > 0).length,
      risky: rows.filter((row) => row.daysLeft !== null && row.daysLeft < 14).length,
    };
  }, [rows]);

  function exportCsv() {
    const csv = toCsv(
      ["Ürün", "Satış adedi", "Ciro", "Sipariş satırı", "Ortalama fiyat", "Stok", "Günlük satış", "Tahmini tükenme (gün)"],
      filtered.map((row) => [
        row.title,
        row.quantity,
        row.revenue.toFixed(2),
        row.orders,
        row.quantity > 0 ? (row.revenue / row.quantity).toFixed(2) : "0",
        row.stock ?? "",
        row.perDay.toFixed(2),
        row.daysLeft === null ? "" : Math.round(row.daysLeft),
      ]),
    );
    downloadCsv(`urun-performans-${days}g.csv`, csv);
  }

  return (
    <AppShell storeId={storeId} title="Ürün Performans Raporu">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ürün performansı</h1>
            <p className="text-sm text-muted-foreground">
              Son {days} günün ürün bazlı satış, ciro ve stok devir analizi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {RANGES.map((range) => (
              <Button
                key={range}
                size="sm"
                variant={days === range ? "default" : "outline"}
                onClick={() => setDays(range)}
              >
                {range} gün
              </Button>
            ))}
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download className="mr-2 size-4" /> CSV indir
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Toplam ciro" value={formatMoney(totals.revenue, currency)} icon={TrendingUp} />
          <StatCard label="Satılan adet" value={formatNumber(totals.quantity)} icon={PackageSearch} />
          <StatCard label="Satan ürün" value={formatNumber(totals.selling)} icon={TrendingUp} />
          <StatCard label="Hiç satmayan (stoklu)" value={formatNumber(totals.idle)} icon={TrendingDown} />
          <StatCard label="14 günde tükenecek" value={formatNumber(totals.risky)} icon={TrendingDown} />
        </div>

        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b p-3">
            <Search className="size-4 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Ürün ara..."
              className="h-9 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3, 4].map((key) => (
                <Skeleton key={key} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Bu dönem için veri bulunmuyor.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Ürün</th>
                    <th className="px-4 py-2 text-right font-medium">Adet</th>
                    <th className="px-4 py-2 text-right font-medium">Ciro</th>
                    <th className="px-4 py-2 text-right font-medium">Ort. fiyat</th>
                    <th className="px-4 py-2 text-right font-medium">Stok</th>
                    <th className="px-4 py-2 text-right font-medium">Günlük satış</th>
                    <th className="px-4 py-2 text-right font-medium">Tükenme</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.productId ?? row.title} className="border-t">
                      <td className="px-4 py-2">
                        {row.productId ? (
                          <Link
                            to="/store/$storeId/products/$productId"
                            params={{ storeId, productId: row.productId }}
                            className="font-medium hover:underline"
                          >
                            {row.title}
                          </Link>
                        ) : (
                          <span className="font-medium">{row.title}</span>
                        )}
                        {row.status && row.status !== "active" ? (
                          <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                            {row.status === "draft" ? "taslak" : "arşiv"}
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-right">{formatNumber(row.quantity)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatMoney(row.revenue, currency)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {row.quantity > 0 ? formatMoney(row.revenue / row.quantity, currency) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">{row.stock === null ? "—" : formatNumber(row.stock)}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{row.perDay.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right">
                        {row.daysLeft === null ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Badge variant={row.daysLeft < 14 ? "destructive" : "secondary"}>
                            {Math.round(row.daysLeft)} gün
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs uppercase tracking-wide">{label}</span>
        <Icon className="size-4" />
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
