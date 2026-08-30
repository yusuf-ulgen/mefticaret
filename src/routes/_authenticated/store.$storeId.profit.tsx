import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Coins, Download, Percent, Save } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { buildProfitRows, marginClass, priceForMargin, profitTotals } from "@/lib/profit";
import { profitDataQuery } from "@/lib/profit-queries";
import { setVariantCosts } from "@/lib/profit.functions";
import { storeQuery } from "@/lib/store-queries";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "30", label: "Son 30 gün" },
  { value: "90", label: "Son 90 gün" },
  { value: "365", label: "Son 12 ay" },
];

export const Route = createFileRoute("/_authenticated/store/$storeId/profit")({
  head: () => ({
    meta: [
      { title: "Kârlılık Analizi — Mefticaret" },
      {
        name: "description",
        content:
          "Ürün maliyetlerini girin; brüt kâr, kâr marjı ve düşük marjlı ürünleri tek ekranda takip edin.",
      },
      { property: "og:title", content: "Kârlılık Analizi — Mefticaret" },
      {
        property: "og:description",
        content: "Maliyet bazlı brüt kâr, marj bantları ve hedef marj fiyat önerileri.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfitPage,
});

function ProfitPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [range, setRange] = useState("90");
  const [targetMargin, setTargetMargin] = useState(35);
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});

  const { data: store } = useQuery(storeQuery(storeId));
  const { data, isLoading } = useQuery(profitDataQuery(storeId, Number(range)));
  const currency = store?.currency ?? "TRY";

  const saveCosts = useServerFn(setVariantCosts);
  const mutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(costDrafts)
        .map(([variantId, raw]) => ({
          variantId,
          costPrice: raw.trim() === "" ? null : Number(raw.replace(",", ".")),
        }))
        .filter((update) => update.costPrice === null || Number.isFinite(update.costPrice));
      if (updates.length === 0) throw new Error("Kaydedilecek maliyet değişikliği yok");
      return saveCosts({ data: { storeId, updates } });
    },
    onSuccess: (result) => {
      toast.success(`${result.updated} varyantın maliyeti güncellendi`);
      setCostDrafts({});
      queryClient.invalidateQueries({ queryKey: ["profit-data", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = useMemo(() => buildProfitRows(data?.lines ?? []), [data]);
  const totals = useMemo(() => profitTotals(rows), [rows]);
  const productTitle = useMemo(
    () => new Map((data?.products ?? []).map((product) => [product.id, product.title])),
    [data],
  );

  const missingCostVariants = useMemo(
    () => (data?.variants ?? []).filter((variant) => variant.costPrice == null),
    [data],
  );

  function exportCsv() {
    const content = toCsv(
      ["Ürün", "Adet", "Ciro", "Maliyet", "Brüt kâr", "Marj %"],
      rows.map((row) => [
        row.productId ? productTitle.get(row.productId) ?? row.title : row.title,
        row.quantity,
        row.revenue.toFixed(2),
        row.cost.toFixed(2),
        row.profit.toFixed(2),
        Math.round(row.margin * 100),
      ]),
    );
    downloadCsv(`karlilik-${new Date().toISOString().slice(0, 10)}.csv`, content);
  }

  return (
    <AppShell storeId={storeId} title="Kârlılık">
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Coins className="size-5 text-primary" /> Kârlılık analizi
            </h1>
            <p className="text-sm text-muted-foreground">
              Varyant maliyetlerini (alış fiyatı) girin; satışlar üzerinden brüt kâr ve marj otomatik
              hesaplanır.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="w-40">
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
          <Kpi label="Ciro" value={formatMoney(totals.revenue, currency)} />
          <Kpi label="Maliyet" value={formatMoney(totals.cost, currency)} />
          <Kpi label="Brüt kâr" value={formatMoney(totals.profit, currency)} />
          <Kpi label="Kâr marjı" value={`${Math.round(totals.margin * 100)}%`} />
        </div>

        {totals.missing > 0 ? (
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            {formatNumber(totals.missing)} sipariş kaleminde maliyet tanımlı değil; brüt kâr olduğundan
            yüksek görünüyor. Aşağıdaki listeden maliyet girin.
          </p>
        ) : null}

        <section className="overflow-x-auto rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Ürün bazlı kâr</h2>
            <span className="text-xs text-muted-foreground">
              {formatNumber(totals.quantity)} adet satış
            </span>
          </div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Seçilen dönemde satış yok. Siparişler geldikçe kârlılık tablosu dolar.
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Ürün</th>
                  <th className="px-3 py-2 text-right font-medium">Adet</th>
                  <th className="px-3 py-2 text-right font-medium">Ciro</th>
                  <th className="px-3 py-2 text-right font-medium">Maliyet</th>
                  <th className="px-3 py-2 text-right font-medium">Brüt kâr</th>
                  <th className="px-4 py-2 text-center font-medium">Marj</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <td className="px-4 py-2 font-medium">
                      {row.productId ? productTitle.get(row.productId) ?? row.title : row.title}
                      {row.missingCost > 0 ? (
                        <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                          maliyet eksik
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right">{formatNumber(row.quantity)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(row.revenue, currency)}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(row.cost, currency)}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {formatMoney(row.profit, currency)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span
                        className={cn(
                          "inline-flex min-w-14 justify-center rounded-md px-2 py-1 text-xs font-medium",
                          marginClass(row.margin),
                        )}
                      >
                        {Math.round(row.margin * 100)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-xl border bg-card">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Maliyet girişi</h2>
              <p className="text-xs text-muted-foreground">
                Maliyeti tanımlı olmayan varyantlar önce listelenir. Hedef marja göre önerilen satış
                fiyatı sağda gösterilir.
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div className="w-32">
                <Label className="text-xs">Hedef marj (%)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={95}
                    value={targetMargin}
                    onChange={(event) => setTargetMargin(Number(event.target.value))}
                  />
                  <Percent className="pointer-events-none absolute right-2 top-2.5 size-3.5 text-muted-foreground" />
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || Object.keys(costDrafts).length === 0}
              >
                <Save className="mr-2 size-4" /> Maliyetleri kaydet
              </Button>
            </div>
          </div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : (data?.variants ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Henüz varyant yok. Ürün eklediğinizde maliyet girişi burada listelenir.
            </p>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Varyant</th>
                    <th className="px-3 py-2 text-right font-medium">Satış fiyatı</th>
                    <th className="px-3 py-2 text-right font-medium">Maliyet</th>
                    <th className="px-3 py-2 text-center font-medium">Marj</th>
                    <th className="px-4 py-2 text-right font-medium">Hedef fiyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...(data?.variants ?? [])]
                    .sort((a, b) => Number(a.costPrice != null) - Number(b.costPrice != null))
                    .map((variant) => {
                      const draft = costDrafts[variant.id];
                      const cost =
                        draft !== undefined && draft.trim() !== ""
                          ? Number(draft.replace(",", "."))
                          : variant.costPrice;
                      const margin =
                        cost != null && variant.price > 0 ? (variant.price - cost) / variant.price : 0;
                      return (
                        <tr key={variant.id}>
                          <td className="px-4 py-2">
                            <span className="font-medium">
                              {variant.productId
                                ? productTitle.get(variant.productId) ?? "Ürün"
                                : "Ürün"}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {variant.title}
                              {variant.sku ? ` · ${variant.sku}` : ""}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatMoney(variant.price, currency)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              className="ml-auto h-8 w-28 text-right"
                              inputMode="decimal"
                              placeholder={variant.costPrice == null ? "—" : ""}
                              value={draft ?? (variant.costPrice == null ? "" : String(variant.costPrice))}
                              onChange={(event) =>
                                setCostDrafts((prev) => ({ ...prev, [variant.id]: event.target.value }))
                              }
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {cost == null ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <span
                                className={cn(
                                  "inline-flex min-w-14 justify-center rounded-md px-2 py-1 text-xs font-medium",
                                  marginClass(margin),
                                )}
                              >
                                {Math.round(margin * 100)}%
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground">
                            {cost == null || cost <= 0
                              ? "—"
                              : formatMoney(priceForMargin(cost, targetMargin / 100), currency)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
          {missingCostVariants.length > 0 ? (
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">
              {formatNumber(missingCostVariants.length)} varyantın maliyeti hâlâ boş.
            </p>
          ) : null}
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
