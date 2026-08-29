import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { productsQuery } from "@/lib/catalog-queries";
import { createProduct } from "@/lib/catalog.functions";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/products")({
  head: () => ({
    meta: [
      { title: "Ürünler — Mefticaret" },
      {
        name: "description",
        content: "Varyantlı ürün kataloğunu yönet: fiyat, stok, durum ve koleksiyonlar.",
      },
      { property: "og:title", content: "Ürünler — Mefticaret" },
      {
        property: "og:description",
        content: "Mefticaret katalog yönetimi: ürün, varyant, stok ve fiyatlama.",
      },
    ],
  }),
  component: ProductsPage,
});

const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  active: "Aktif",
  archived: "Arşiv",
};

function ProductsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: products, isLoading } = useQuery(productsQuery(storeId));
  const create = useServerFn(createProduct);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [filter, setFilter] = useState<"all" | "draft" | "active" | "archived">("all");

  const currency = store?.currency ?? "TRY";

  const mutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          storeId,
          title,
          basePrice: Number(price || 0),
          stock: Number(stock || 0),
          status,
        },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      toast.success("Ürün eklendi");
      setOpen(false);
      setTitle("");
      setPrice("");
      setStock("0");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = (products ?? []).filter((product) =>
    filter === "all" ? true : product.status === filter,
  );

  return (
    <AppShell
      storeId={storeId}
      title="Ürünler"
      description="Varyant, stok ve fiyat yönetimi tek ekranda."
      actions={
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tümü</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="draft">Taslak</SelectItem>
              <SelectItem value="archived">Arşiv</SelectItem>
            </SelectContent>
          </Select>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" /> Yeni ürün
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full max-w-md overflow-y-auto p-6">
              <SheetHeader className="p-0 pb-4">
                <SheetTitle>Yeni ürün</SheetTitle>
              </SheetHeader>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  mutation.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="title">Ürün adı</Label>
                  <Input
                    id="title"
                    required
                    minLength={2}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Örn. Merino Yün Triko"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="price">Fiyat ({currency})</Label>
                    <Input
                      id="price"
                      type="number"
                      min={0}
                      step="0.01"
                      required
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock">Başlangıç stoğu</Label>
                    <Input
                      id="stock"
                      type="number"
                      min={0}
                      value={stock}
                      onChange={(event) => setStock(event.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Durum</Label>
                  <Select value={status} onValueChange={(value) => setStatus(value as "draft")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Taslak</SelectItem>
                      <SelectItem value="active">Aktif (satışta)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? "Kaydediliyor…" : "Ürünü oluştur"}
                </Button>
              </form>
            </SheetContent>
          </Sheet>
        </div>
      }
    >
      <div className="surface-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Ürün</th>
              <th className="px-5 py-3">Durum</th>
              <th className="px-5 py-3">Fiyat</th>
              <th className="px-5 py-3">Varyant</th>
              <th className="px-5 py-3">Stok</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                  Yükleniyor…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center">
                  <Package className="mx-auto mb-3 size-6 text-muted-foreground" />
                  <p className="font-medium">Bu filtrede ürün yok</p>
                  <p className="text-sm text-muted-foreground">
                    Sağ üstten yeni ürün ekleyerek kataloğunu başlat.
                  </p>
                </td>
              </tr>
            ) : (
              rows.map((product) => {
                const variants = product.product_variants ?? [];
                const stockTotal = variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0);
                return (
                  <tr key={product.id} className="hover:bg-muted/40">
                    <td className="px-5 py-3">
                      <Link
                        to="/store/$storeId/products/$productId"
                        params={{ storeId, productId: product.id }}
                        className="font-medium hover:underline"
                      >
                        {product.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">/{product.slug}</p>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={product.status === "active" ? "default" : "secondary"}>
                        {STATUS_LABELS[product.status] ?? product.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {formatMoney(Number(product.base_price), product.currency)}
                    </td>
                    <td className="px-5 py-3">{variants.length}</td>
                    <td className="px-5 py-3">
                      <span className={stockTotal === 0 ? "text-destructive" : undefined}>
                        {formatNumber(stockTotal)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
