import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Layers, Percent, Tags, Trash2, Warehouse, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { collectionsQuery } from "@/lib/catalog-queries";
import { bulkUpdateProducts } from "@/lib/bulk.functions";

type Sheetkind = "price" | "stock" | "collections" | "tags" | "fields" | null;

type Props = {
  storeId: string;
  productIds: string[];
  currency: string;
  onClear: () => void;
};

/** Seçili ürünler için toplu düzenleme çubuğu. */
export function BulkProductActions({ storeId, productIds, currency, onClear }: Props) {
  const queryClient = useQueryClient();
  const run = useServerFn(bulkUpdateProducts);
  const { data: collections } = useQuery(collectionsQuery(storeId));

  const [kind, setKind] = useState<Sheetkind>(null);
  const [status, setStatus] = useState<"draft" | "active" | "archived">("active");

  // fiyat
  const [priceMode, setPriceMode] = useState<
    "set" | "increase_percent" | "decrease_percent" | "increase_amount" | "decrease_amount"
  >("increase_percent");
  const [priceValue, setPriceValue] = useState("10");
  const [priceTarget, setPriceTarget] = useState<"base" | "compare_at" | "cost">("base");
  const [priceRounding, setPriceRounding] = useState<"none" | "integer" | "ends_99">("none");
  const [applyToVariants, setApplyToVariants] = useState(true);

  // stok
  const [stockMode, setStockMode] = useState<"set" | "increase" | "decrease">("set");
  const [stockValue, setStockValue] = useState("0");

  // etiket
  const [tagMode, setTagMode] = useState<"add" | "remove" | "replace">("add");
  const [tagInput, setTagInput] = useState("");

  // koleksiyon
  const [collectionMode, setCollectionMode] = useState<"add" | "remove" | "replace">("add");
  const [collectionIds, setCollectionIds] = useState<string[]>([]);

  // diğer alanlar
  const [vendor, setVendor] = useState("");
  const [productType, setProductType] = useState("");
  const [taxRate, setTaxRate] = useState("");

  const mutation = useMutation({
    mutationFn: (operation: Record<string, unknown>) =>
      run({ data: { storeId, productIds, operation: operation as never } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      await queryClient.invalidateQueries({ queryKey: ["collections", storeId] });
      if (result.errors.length > 0) {
        toast.warning(`${result.affected} kayıt güncellendi · ${result.errors[0]}`);
      } else {
        toast.success(`${result.affected} kayıt güncellendi`);
      }
      setKind(null);
      onClear();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const tags = tagInput
    .split(/[,\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);

  return (
    <div className="surface-card mb-4 flex flex-wrap items-center gap-2 p-4">
      <Badge variant="secondary" className="mr-1">
        {productIds.length} ürün seçildi
      </Badge>

      <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Aktif</SelectItem>
          <SelectItem value="draft">Taslak</SelectItem>
          <SelectItem value="archived">Arşiv</SelectItem>
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ kind: "status", status })}
      >
        Durumu uygula
      </Button>

      <Button size="sm" variant="outline" className="gap-2" onClick={() => setKind("price")}>
        <Percent className="size-4" /> Fiyat
      </Button>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => setKind("stock")}>
        <Warehouse className="size-4" /> Stok
      </Button>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => setKind("collections")}>
        <Layers className="size-4" /> Kategori
      </Button>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => setKind("tags")}>
        <Tags className="size-4" /> Etiket
      </Button>
      <Button size="sm" variant="outline" className="gap-2" onClick={() => setKind("fields")}>
        <Wrench className="size-4" /> Alanlar
      </Button>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" variant="destructive" className="gap-2">
            <Trash2 className="size-4" /> Sil
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{productIds.length} ürün silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz. Ürünlerin varyantları, görselleri ve koleksiyon bağlantıları da
              silinir. Sipariş geçmişi korunur.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={() => mutation.mutate({ kind: "delete" })}>
              Kalıcı olarak sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button size="sm" variant="ghost" onClick={onClear}>
        Seçimi temizle
      </Button>

      {/* Fiyat */}
      <Dialog open={kind === "price"} onOpenChange={(value) => !value && setKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Toplu fiyat değiştirme</DialogTitle>
            <DialogDescription>
              {productIds.length} ürünün fiyatı seçtiğiniz kurala göre yeniden hesaplanır.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Alan</Label>
                <Select
                  value={priceTarget}
                  onValueChange={(value) => setPriceTarget(value as typeof priceTarget)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base">Satış fiyatı</SelectItem>
                    <SelectItem value="compare_at">Liste (indirimsiz) fiyat</SelectItem>
                    <SelectItem value="cost">Maliyet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kural</Label>
                <Select
                  value={priceMode}
                  onValueChange={(value) => setPriceMode(value as typeof priceMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="increase_percent">% artır</SelectItem>
                    <SelectItem value="decrease_percent">% azalt</SelectItem>
                    <SelectItem value="increase_amount">Tutar ekle</SelectItem>
                    <SelectItem value="decrease_amount">Tutar çıkar</SelectItem>
                    <SelectItem value="set">Sabit değere ayarla</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Değer {priceMode.includes("percent") ? "(%)" : `(${currency})`}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={priceValue}
                  onChange={(event) => setPriceValue(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Yuvarlama</Label>
                <Select
                  value={priceRounding}
                  onValueChange={(value) => setPriceRounding(value as typeof priceRounding)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Yok (kuruşlu)</SelectItem>
                    <SelectItem value="integer">Tam sayıya</SelectItem>
                    <SelectItem value="ends_99">,99 ile bitir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={applyToVariants}
                onCheckedChange={(value) => setApplyToVariants(value === true)}
              />
              Varyant fiyatlarına da uygula
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  kind: "price",
                  mode: priceMode,
                  value: Number(priceValue || 0),
                  target: priceTarget,
                  applyToVariants,
                  rounding: priceRounding,
                })
              }
            >
              {mutation.isPending ? "Uygulanıyor…" : "Fiyatları güncelle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stok */}
      <Dialog open={kind === "stock"} onOpenChange={(value) => !value && setKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Toplu stok değiştirme</DialogTitle>
            <DialogDescription>
              Seçili ürünlerin tüm varyantlarının stok adedi güncellenir.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kural</Label>
              <Select
                value={stockMode}
                onValueChange={(value) => setStockMode(value as typeof stockMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Şu değere ayarla</SelectItem>
                  <SelectItem value="increase">Ekle</SelectItem>
                  <SelectItem value="decrease">Çıkar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Adet</Label>
              <Input
                type="number"
                min={0}
                value={stockValue}
                onChange={(event) => setStockValue(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  kind: "stock",
                  mode: stockMode,
                  value: Math.max(0, Math.round(Number(stockValue || 0))),
                })
              }
            >
              {mutation.isPending ? "Uygulanıyor…" : "Stokları güncelle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Koleksiyon / kategori */}
      <Dialog open={kind === "collections"} onOpenChange={(value) => !value && setKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Toplu kategori değiştirme</DialogTitle>
            <DialogDescription>
              Seçili ürünleri koleksiyonlara ekleyin, çıkarın veya koleksiyonlarını sıfırlayın.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kural</Label>
              <Select
                value={collectionMode}
                onValueChange={(value) => setCollectionMode(value as typeof collectionMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Seçilenlere ekle</SelectItem>
                  <SelectItem value="remove">Seçilenlerden çıkar</SelectItem>
                  <SelectItem value="replace">Yalnızca seçilenler olsun</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-border p-3">
              {(collections ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Henüz koleksiyon yok.</p>
              ) : (
                (collections ?? []).map((collection) => (
                  <label key={collection.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={collectionIds.includes(collection.id)}
                      onCheckedChange={(value) =>
                        setCollectionIds((prev) =>
                          value === true
                            ? [...prev, collection.id]
                            : prev.filter((id) => id !== collection.id),
                        )
                      }
                    />
                    {collection.title}
                  </label>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending || (collectionMode !== "replace" && collectionIds.length === 0)}
              onClick={() =>
                mutation.mutate({ kind: "collections", mode: collectionMode, collectionIds })
              }
            >
              {mutation.isPending ? "Uygulanıyor…" : "Kategorileri uygula"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Etiket */}
      <Dialog open={kind === "tags"} onOpenChange={(value) => !value && setKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Toplu etiketleme</DialogTitle>
            <DialogDescription>Etiketleri virgülle ayırarak yazın.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Kural</Label>
              <Select value={tagMode} onValueChange={(value) => setTagMode(value as typeof tagMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Etiket ekle</SelectItem>
                  <SelectItem value="remove">Etiket kaldır</SelectItem>
                  <SelectItem value="replace">Etiketleri değiştir</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Etiketler</Label>
              <Input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                placeholder="yeni-sezon, indirim, keten"
              />
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1 pt-1">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending || tags.length === 0}
              onClick={() => mutation.mutate({ kind: "tags", mode: tagMode, tags })}
            >
              {mutation.isPending ? "Uygulanıyor…" : "Etiketleri uygula"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diğer alanlar */}
      <Dialog open={kind === "fields"} onOpenChange={(value) => !value && setKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Toplu ürün düzenleme</DialogTitle>
            <DialogDescription>
              Boş bıraktığınız alanlar değiştirilmez. Marka/tür alanını temizlemek için tek tire (-)
              yazın.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Marka</Label>
              <Input value={vendor} onChange={(event) => setVendor(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Ürün türü</Label>
              <Input value={productType} onChange={(event) => setProductType(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>KDV oranı (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={taxRate}
                onChange={(event) => setTaxRate(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={() => {
                const operation: Record<string, unknown> = { kind: "fields" };
                if (vendor.trim()) operation["vendor"] = vendor.trim() === "-" ? "" : vendor.trim();
                if (productType.trim())
                  operation["productType"] = productType.trim() === "-" ? "" : productType.trim();
                if (taxRate.trim()) operation["taxRate"] = Number(taxRate);
                if (Object.keys(operation).length === 1) {
                  toast.info("Değiştirilecek alan girin");
                  return;
                }
                mutation.mutate(operation);
              }}
            >
              {mutation.isPending ? "Uygulanıyor…" : "Alanları güncelle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
