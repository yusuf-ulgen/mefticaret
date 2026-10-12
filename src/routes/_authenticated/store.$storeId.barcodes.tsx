import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Barcode, Printer } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { BarcodeSvg } from "@/components/barcode-svg";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inventoryQuery } from "@/lib/inventory-queries";
import { formatMoney } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/barcodes")({
  head: () => ({
    meta: [
      { title: "Barkod Etiketi Yazdır — Mefticaret" },
      {
        name: "description",
        content:
          "Ürün varyantları için Code 128 barkod etiketleri oluşturun, adet belirleyip raf ve depo etiketlerini tek sayfada yazdırın.",
      },
      { property: "og:title", content: "Barkod Etiketi Yazdır — Mefticaret" },
      {
        property: "og:description",
        content: "SKU bazlı Code 128 barkod etiketleri: adet seçimi ve yazdırmaya hazır sayfa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BarcodesPage,
});

function BarcodesPage() {
  const { storeId } = Route.useParams();
  const { data: variants, isLoading } = useQuery(inventoryQuery(storeId));

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [showPrice, setShowPrice] = useState(true);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (variants ?? [])
      .map((variant) => {
        const product = (variant as { products: { title: string } | null }).products;
        return {
          id: variant.id,
          code: variant.sku ?? variant.id,
          productTitle: product?.title ?? "—",
          variantTitle: variant.title,
          price: Number(variant.price ?? 0),
          stock: variant.stock ?? 0,
        };
      })
      .filter((row) =>
        term.length === 0
          ? true
          : `${row.code} ${row.productTitle} ${row.variantTitle}`.toLowerCase().includes(term),
      );
  }, [variants, search]);

  const labels = useMemo(
    () =>
      rows
        .filter((row) => (selected[row.id] ?? 0) > 0)
        .flatMap((row) =>
          Array.from({ length: selected[row.id] ?? 0 }, (_, index) => ({
            ...row,
            key: `${row.id}-${index}`,
          })),
        ),
    [rows, selected],
  );

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (checked) next[id] = prev[id] && prev[id]! > 0 ? prev[id]! : 1;
      else delete next[id];
      return next;
    });

  const setQty = (id: string, qty: number) =>
    setSelected((prev) => ({ ...prev, [id]: Math.max(1, Math.min(200, qty || 1)) }));

  return (
    <AppShell storeId={storeId} title="Barkod Etiketleri">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Barkod etiketi yazdır</h1>
          <p className="text-sm text-muted-foreground">
            Varyantları seçin, etiket adedini belirleyin ve Code 128 barkodlu etiketleri
            yazdırın. Barkod değeri olarak SKU (yoksa varyant kimliği) kullanılır.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="SKU veya ürün ara"
            className="max-w-xs"
          />
          <Badge variant="secondary">{labels.length} etiket</Badge>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={showPrice}
              onCheckedChange={(value) => setShowPrice(value === true)}
            />
            Fiyatı yazdır
          </label>
          <Button size="sm" disabled={labels.length === 0} onClick={() => window.print()}>
            <Printer className="mr-2 size-4" />
            Yazdır
          </Button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Seç</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Ürün / Varyant</th>
                <th className="px-4 py-3 text-right">Fiyat</th>
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3 text-right">Etiket adedi</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 300).map((row) => {
                const qty = selected[row.id] ?? 0;
                return (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <Checkbox
                        checked={qty > 0}
                        onCheckedChange={(value) => toggle(row.id, value === true)}
                      />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{row.code}</td>
                    <td className="px-4 py-2">
                      <p className="font-medium">{row.productTitle}</p>
                      <p className="text-xs text-muted-foreground">{row.variantTitle}</p>
                    </td>
                    <td className="px-4 py-2 text-right">{formatMoney(row.price)}</td>
                    <td className="px-4 py-2 text-right">{row.stock}</td>
                    <td className="px-4 py-2 text-right">
                      <Input
                        type="number"
                        min={1}
                        max={200}
                        value={qty > 0 ? qty : ""}
                        disabled={qty === 0}
                        onChange={(event) => setQty(row.id, Number(event.target.value))}
                        className="ml-auto w-20 text-right"
                      />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    {isLoading ? "Yükleniyor…" : "Varyant bulunamadı."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <Label>Önizleme</Label>
          {labels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <Barcode className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                Etiket oluşturmak için listeden varyant seçin.
              </p>
            </div>
          ) : (
            <div
              id="barcode-print-area"
              className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3"
            >
              {labels.map((label) => (
                <div
                  key={label.key}
                  className="break-inside-avoid rounded-md border border-border bg-background p-3 text-center"
                >
                  <p className="truncate text-xs font-medium">{label.productTitle}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {label.variantTitle}
                  </p>
                  <div className="mt-2">
                    <BarcodeSvg value={label.code} />
                  </div>
                  <p className="mt-1 font-mono text-[10px] tracking-widest">{label.code}</p>
                  {showPrice ? (
                    <p className="text-sm font-semibold">{formatMoney(label.price)}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
