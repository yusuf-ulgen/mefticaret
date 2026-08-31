import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Link2, ShoppingBasket } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { basketDataQuery } from "@/lib/basket-queries";
import { analyzeBaskets, recommendationsFor } from "@/lib/basket";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/basket")({
  head: () => ({
    meta: [
      { title: "Sepet Analizi — Mefticaret" },
      {
        name: "description",
        content:
          "Birlikte satın alınan ürün çiftlerini, çapraz satış güvenini ve lift metriğini analiz ederek paket önerileri oluştur.",
      },
      { property: "og:title", content: "Sepet Analizi — Mefticaret" },
      {
        property: "og:description",
        content: "Birlikte alınan ürünler, çapraz satış güveni ve lift metriği raporu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BasketPage,
});

function BasketPage() {
  const { storeId } = Route.useParams();
  const [search, setSearch] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [minSupport, setMinSupport] = useState(2);

  const { data, isLoading } = useQuery(basketDataQuery(storeId));
  const analysis = useMemo(() => analyzeBaskets(data ?? []), [data]);

  const term = search.trim().toLowerCase();
  const pairs = analysis.pairs.filter(
    (pair) =>
      pair.support >= minSupport &&
      (!term ||
        pair.aTitle.toLowerCase().includes(term) ||
        pair.bTitle.toLowerCase().includes(term)),
  );

  const recommendations = focus ? recommendationsFor(analysis, focus) : [];
  const focusTitle = analysis.products.find((product) => product.productId === focus)?.title;

  const exportCsv = () => {
    downloadCsv(
      `sepet-analizi-${storeId}.csv`,
      toCsv(
        ["Ürün A", "Ürün B", "Birlikte sipariş", "Destek %", "Güven A→B %", "Güven B→A %", "Lift"],
        pairs.map((pair) => [
          pair.aTitle,
          pair.bTitle,
          pair.support,
          (pair.supportRate * 100).toFixed(2),
          (pair.confidenceAB * 100).toFixed(1),
          (pair.confidenceBA * 100).toFixed(1),
          pair.lift.toFixed(2),
        ]),
      ),
    );
  };

  return (
    <AppShell
      storeId={storeId}
      title="Sepet Analizi"
      description="Hangi ürünler birlikte alınıyor? Çapraz satış, paket ve öneri kurgularını verilerle planla."
    >
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Analiz edilen sipariş", value: formatNumber(analysis.summary.orders) },
            {
              label: "Çoklu ürünlü sipariş",
              value: `${(analysis.summary.attachRate * 100).toFixed(1)}%`,
            },
            {
              label: "Sipariş başına ürün",
              value: analysis.summary.avgItemsPerOrder.toFixed(2),
            },
            { label: "Ortalama sepet", value: formatMoney(analysis.summary.avgOrderValue) },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{kpi.value}</p>
            </div>
          ))}
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link2 className="size-4 text-muted-foreground" />
              <h2 className="font-display text-lg font-semibold">Birlikte alınan ürün çiftleri</h2>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="basket-search">Ürün ara</Label>
                <Input
                  id="basket-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Örn. gömlek"
                  className="w-56"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="basket-support">Min. birlikte sipariş</Label>
                <Input
                  id="basket-support"
                  type="number"
                  min={1}
                  value={minSupport}
                  onChange={(event) => setMinSupport(Math.max(1, Number(event.target.value) || 1))}
                  className="w-32"
                />
              </div>
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!pairs.length}>
                <Download className="mr-2 size-4" /> CSV
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Ürün çifti</th>
                  <th className="py-2 pr-3 text-right">Birlikte</th>
                  <th className="py-2 pr-3 text-right">Destek</th>
                  <th className="py-2 pr-3 text-right">Güven A→B</th>
                  <th className="py-2 pr-3 text-right">Güven B→A</th>
                  <th className="py-2 pr-3 text-right">Lift</th>
                </tr>
              </thead>
              <tbody>
                {pairs.slice(0, 100).map((pair) => (
                  <tr key={pair.key} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <button
                        className="text-left underline-offset-4 hover:underline"
                        onClick={() => setFocus(pair.aId)}
                      >
                        {pair.aTitle}
                      </button>
                      <span className="px-1.5 text-muted-foreground">+</span>
                      <button
                        className="text-left underline-offset-4 hover:underline"
                        onClick={() => setFocus(pair.bId)}
                      >
                        {pair.bTitle}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-right">{formatNumber(pair.support)}</td>
                    <td className="py-2 pr-3 text-right">
                      {(pair.supportRate * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {(pair.confidenceAB * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {(pair.confidenceBA * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <Badge variant={pair.lift >= 1.5 ? "default" : "outline"}>
                        {pair.lift.toFixed(2)}×
                      </Badge>
                    </td>
                  </tr>
                ))}
                {pairs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      {isLoading
                        ? "Yükleniyor…"
                        : "Yeterli birlikte satın alma verisi yok. Eşik değerini düşürmeyi deneyin."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {focus && (
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShoppingBasket className="size-4 text-muted-foreground" />
                <h2 className="font-display text-lg font-semibold">
                  “{focusTitle ?? "Ürün"}” ile önerilecek ürünler
                </h2>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setFocus(null)}>
                Temizle
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recommendations.map((item) => (
                <div key={item.productId} className="rounded-lg border p-4">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="mt-2 font-display text-lg font-semibold">
                    {(item.confidence * 100).toFixed(0)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(item.support)} birlikte sipariş · lift {item.lift.toFixed(2)}×
                  </p>
                </div>
              ))}
              {recommendations.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Bu ürün için birlikte satın alma kaydı yok.
                </p>
              )}
            </div>
          </section>
        )}

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Ürün bazlı sepet davranışı</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Ürün</th>
                  <th className="py-2 pr-3 text-right">Sipariş</th>
                  <th className="py-2 pr-3 text-right">Adet</th>
                  <th className="py-2 pr-3 text-right">Ciro</th>
                  <th className="py-2 pr-3 text-right">Tek başına</th>
                  <th className="py-2 pr-3 text-right">Eşlik eden ürün</th>
                </tr>
              </thead>
              <tbody>
                {analysis.products.slice(0, 50).map((product) => (
                  <tr key={product.productId} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <button
                        className="text-left underline-offset-4 hover:underline"
                        onClick={() => setFocus(product.productId)}
                      >
                        {product.title}
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-right">{formatNumber(product.orders)}</td>
                    <td className="py-2 pr-3 text-right">{formatNumber(product.units)}</td>
                    <td className="py-2 pr-3 text-right">{formatMoney(product.revenue)}</td>
                    <td className="py-2 pr-3 text-right">
                      {(product.soloRate * 100).toFixed(0)}%
                    </td>
                    <td className="py-2 pr-3 text-right">{formatNumber(product.partners)}</td>
                  </tr>
                ))}
                {analysis.products.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      {isLoading ? "Yükleniyor…" : "Henüz sipariş kalemi yok."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
