import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductEditor, type StudioItem } from "./catalog-studio";
import { studioBulkUpdate } from "@/lib/supplier-studio.functions";
import type { CatalogProduct } from "./workspace-panels";

export function SupplierCatalogActions({
  supplierId,
  selected,
  product,
  clear,
  onChanged,
}: {
  supplierId: string;
  selected: string[];
  product: CatalogProduct | null;
  clear: () => void;
  onChanged: () => void;
}) {
  const client = useQueryClient();
  const bulk = useServerFn(studioBulkUpdate);
  const [editing, setEditing] = useState<StudioItem | "new" | null>(null);
  const [percent, setPercent] = useState("");
  const [stock, setStock] = useState("");
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["supplier-catalog-search"] });
    void client.invalidateQueries({ queryKey: ["studio-overview", supplierId] });
    void client.invalidateQueries({ queryKey: ["studio-product", supplierId] });
    onChanged();
  };
  const mutation = useMutation({
    mutationFn: (changes: {
      pricePercent?: number;
      setStock?: number;
      visible?: boolean;
      remove?: boolean;
    }) => bulk({ data: { supplierId, ids: selected, ...changes } }),
    onSuccess: (result) => {
      toast.success(`${result.updated} ürün güncellendi`);
      clear();
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const edit = () => {
    if (!product) return;
    setEditing({
      id: product.id,
      title: product.title,
      sku: product.sku,
      barcode: product.barcode,
      brand: product.brand,
      category: product.category,
      purchasePrice: product.supplierPrice,
      salePrice: product.configuredSalePrice ?? null,
      suggestedPrice: product.suggestedPrice ?? null,
      stock: product.sourceStock ?? product.stock,
      images: product.images,
      visible: product.catalogVisible !== false,
      currency: product.currency,
    });
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEditing("new")}>Ürün ekle</Button>
        {product ? (
          <Button variant="outline" onClick={edit}>
            Seçili ürünü düzenle
          </Button>
        ) : null}
      </div>
      {selected.length ? (
        <fieldset
          disabled={mutation.isPending}
          className="flex flex-wrap items-center gap-2 rounded-lg border p-3"
        >
          <legend className="px-1 text-sm">{selected.length} ürün etkilenecek</legend>
          <Input
            className="w-28"
            aria-label="Fiyat değişimi yüzdesi"
            type="number"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            placeholder="Fiyat %"
          />
          <Button
            variant="outline"
            disabled={
              !percent.trim() || !Number.isFinite(Number(percent)) || Number(percent) < -100
            }
            onClick={() => mutation.mutate({ pricePercent: Number(percent) })}
          >
            Fiyatı değiştir
          </Button>
          <Input
            className="w-28"
            aria-label="Yeni kaynak stok"
            type="number"
            min={0}
            step={1}
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="Stok"
          />
          <Button
            variant="outline"
            disabled={!stock.trim() || !Number.isInteger(Number(stock)) || Number(stock) < 0}
            onClick={() => mutation.mutate({ setStock: Number(stock) })}
          >
            Stoğu ayarla
          </Button>
          <Button variant="outline" onClick={() => mutation.mutate({ visible: true })}>
            Göster
          </Button>
          <Button variant="outline" onClick={() => mutation.mutate({ visible: false })}>
            Gizle
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              window.confirm(`${selected.length} ürün kalıcı olarak silinsin mi?`) &&
              mutation.mutate({ remove: true })
            }
          >
            Sil
          </Button>
          <Button variant="ghost" onClick={clear}>
            Seçimi temizle
          </Button>
        </fieldset>
      ) : null}
      <ProductEditor
        supplierId={supplierId}
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  );
}
