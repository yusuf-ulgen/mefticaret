import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { collectionsQuery, productQuery } from "@/lib/catalog-queries";
import {
  deleteProduct,
  deleteVariant,
  setProductCollections,
  updateProduct,
  upsertVariant,
} from "@/lib/catalog.functions";
import { formatMoney } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/products/$productId")({
  head: () => ({
    meta: [
      { title: "Ürün detayı — Mefticaret" },
      {
        name: "description",
        content: "Ürün bilgilerini, varyantlarını, stoğunu ve koleksiyonlarını düzenle.",
      },
      { property: "og:title", content: "Ürün detayı — Mefticaret" },
      {
        property: "og:description",
        content: "Varyant bazlı fiyat ve stok yönetimi, koleksiyon eşleştirme.",
      },
    ],
  }),
  component: ProductDetailPage,
});

type VariantDraft = {
  title: string;
  sku: string;
  price: string;
  stock: string;
};

const EMPTY_DRAFT: VariantDraft = { title: "", sku: "", price: "", stock: "0" };

function ProductDetailPage() {
  const { storeId, productId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery(productQuery(productId));
  const { data: collections } = useQuery(collectionsQuery(storeId));

  const saveProduct = useServerFn(updateProduct);
  const removeProduct = useServerFn(deleteProduct);
  const saveVariant = useServerFn(upsertVariant);
  const removeVariant = useServerFn(deleteVariant);
  const saveCollections = useServerFn(setProductCollections);

  const [form, setForm] = useState({
    title: "",
    description: "",
    vendor: "",
    product_type: "",
    base_price: "",
    status: "draft" as "draft" | "active" | "archived",
  });
  const [draft, setDraft] = useState<VariantDraft>(EMPTY_DRAFT);

  useEffect(() => {
    if (!product) return;
    setForm({
      title: product.title,
      description: product.description ?? "",
      vendor: product.vendor ?? "",
      product_type: product.product_type ?? "",
      base_price: String(product.base_price ?? 0),
      status: product.status,
    });
  }, [product]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["product", productId] });
    await queryClient.invalidateQueries({ queryKey: ["products", storeId] });
  };

  const productMutation = useMutation({
    mutationFn: () =>
      saveProduct({
        data: {
          productId,
          patch: {
            title: form.title,
            description: form.description,
            vendor: form.vendor,
            product_type: form.product_type,
            base_price: Number(form.base_price || 0),
            status: form.status,
          },
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Ürün güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const variantMutation = useMutation({
    mutationFn: (input: {
      variantId?: string;
      title: string;
      sku: string;
      price: number;
      stock: number;
    }) => saveVariant({ data: { productId, ...input } }),
    onSuccess: async () => {
      await invalidate();
      setDraft(EMPTY_DRAFT);
      toast.success("Varyant kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const variantDeleteMutation = useMutation({
    mutationFn: (variantId: string) => removeVariant({ data: { variantId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Varyant silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const collectionMutation = useMutation({
    mutationFn: (collectionIds: string[]) =>
      saveCollections({ data: { productId, collectionIds } }),
    onSuccess: async () => {
      await invalidate();
      await queryClient.invalidateQueries({ queryKey: ["collections", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => removeProduct({ data: { productId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["products", storeId] });
      toast.success("Ürün silindi");
      void navigate({ to: "/store/$storeId/products", params: { storeId } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const variants = product?.product_variants ?? [];
  const selectedCollections = (product?.product_collections ?? []).map((row) => row.collection_id);

  return (
    <AppShell
      storeId={storeId}
      title={product?.title ?? "Ürün"}
      description="Ürün bilgileri, varyantlar ve koleksiyonlar."
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/store/$storeId/products" params={{ storeId }} className="gap-2">
              <ArrowLeft className="size-4" /> Kataloğa dön
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            Sil
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-muted-foreground">Yükleniyor…</p>
      ) : !product ? (
        <p className="text-muted-foreground">Ürün bulunamadı veya erişim yetkiniz yok.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <form
            className="surface-card space-y-4 p-6 lg:col-span-2"
            onSubmit={(event) => {
              event.preventDefault();
              productMutation.mutate();
            }}
          >
            <h2 className="text-lg font-semibold">Ürün bilgileri</h2>
            <div className="space-y-2">
              <Label htmlFor="p-title">Başlık</Label>
              <Input
                id="p-title"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-desc">Açıklama</Label>
              <Textarea
                id="p-desc"
                rows={4}
                value={form.description}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-vendor">Marka</Label>
                <Input
                  id="p-vendor"
                  value={form.vendor}
                  onChange={(event) => setForm((prev) => ({ ...prev, vendor: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-type">Ürün tipi</Label>
                <Input
                  id="p-type"
                  value={form.product_type}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, product_type: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-price">Liste fiyatı ({product.currency})</Label>
                <Input
                  id="p-price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.base_price}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, base_price: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Durum</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, status: value as typeof prev.status }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Taslak</SelectItem>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="archived">Arşiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={productMutation.isPending}>
              {productMutation.isPending ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
            </Button>
          </form>

          <div className="surface-card space-y-3 p-6">
            <h2 className="text-lg font-semibold">Koleksiyonlar</h2>
            {(collections ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Henüz koleksiyon yok.{" "}
                <Link
                  to="/store/$storeId/collections"
                  params={{ storeId }}
                  className="underline underline-offset-4"
                >
                  Koleksiyon oluştur
                </Link>
              </p>
            ) : (
              (collections ?? []).map((collection) => {
                const checked = selectedCollections.includes(collection.id);
                return (
                  <label
                    key={collection.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={checked}
                      onChange={() =>
                        collectionMutation.mutate(
                          checked
                            ? selectedCollections.filter((id) => id !== collection.id)
                            : [...selectedCollections, collection.id],
                        )
                      }
                    />
                    <span>{collection.title}</span>
                  </label>
                );
              })
            )}
          </div>

          <div className="surface-card p-6 lg:col-span-3">
            <h2 className="mb-4 text-lg font-semibold">Varyantlar</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3">Varyant</th>
                    <th className="py-2 pr-3">SKU</th>
                    <th className="py-2 pr-3">Fiyat</th>
                    <th className="py-2 pr-3">Stok</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {variants.map((variant) => (
                    <VariantRow
                      key={variant.id}
                      variant={variant}
                      currency={product.currency}
                      onSave={(input) => variantMutation.mutate({ variantId: variant.id, ...input })}
                      onDelete={() => variantDeleteMutation.mutate(variant.id)}
                    />
                  ))}
                  <tr>
                    <td className="py-2 pr-3">
                      <Input
                        placeholder="Örn. Siyah / M"
                        value={draft.title}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, title: event.target.value }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        placeholder="SKU"
                        value={draft.sku}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, sku: event.target.value }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={draft.price}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, price: event.target.value }))
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        type="number"
                        min={0}
                        value={draft.stock}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, stock: event.target.value }))
                        }
                      />
                    </td>
                    <td className="py-2">
                      <Button
                        size="sm"
                        className="gap-1"
                        disabled={draft.title.trim().length === 0 || variantMutation.isPending}
                        onClick={() =>
                          variantMutation.mutate({
                            title: draft.title,
                            sku: draft.sku,
                            price: Number(draft.price || 0),
                            stock: Number(draft.stock || 0),
                          })
                        }
                      >
                        <Plus className="size-4" /> Ekle
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Toplam stok:{" "}
              {variants.reduce((sum, variant) => sum + (variant.stock ?? 0), 0)} adet · Ortalama
              fiyat{" "}
              {formatMoney(
                variants.length
                  ? variants.reduce((sum, variant) => sum + Number(variant.price ?? 0), 0) /
                      variants.length
                  : 0,
                product.currency,
              )}
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function VariantRow({
  variant,
  currency,
  onSave,
  onDelete,
}: {
  variant: { id: string; title: string; sku: string | null; price: number; stock: number };
  currency: string;
  onSave: (input: { title: string; sku: string; price: number; stock: number }) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(variant.title);
  const [sku, setSku] = useState(variant.sku ?? "");
  const [price, setPrice] = useState(String(variant.price));
  const [stock, setStock] = useState(String(variant.stock));

  const dirty =
    title !== variant.title ||
    sku !== (variant.sku ?? "") ||
    Number(price) !== Number(variant.price) ||
    Number(stock) !== Number(variant.stock);

  return (
    <tr>
      <td className="py-2 pr-3">
        <Input value={title} onChange={(event) => setTitle(event.target.value)} />
      </td>
      <td className="py-2 pr-3">
        <Input value={sku} onChange={(event) => setSku(event.target.value)} />
      </td>
      <td className="py-2 pr-3">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
        <span className="text-[0.7rem] text-muted-foreground">
          {formatMoney(Number(price || 0), currency)}
        </span>
      </td>
      <td className="py-2 pr-3">
        <Input
          type="number"
          min={0}
          value={stock}
          onChange={(event) => setStock(event.target.value)}
        />
      </td>
      <td className="py-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!dirty}
            onClick={() =>
              onSave({
                title,
                sku,
                price: Number(price || 0),
                stock: Number(stock || 0),
              })
            }
          >
            Kaydet
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Varyantı sil">
            <Trash2 className="size-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
