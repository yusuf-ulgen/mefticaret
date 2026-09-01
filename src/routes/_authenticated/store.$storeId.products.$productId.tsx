import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ImagePlus, Star, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { VariantManager } from "@/components/variant-manager";
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
import { deleteProduct, setProductCollections, updateProduct } from "@/lib/catalog.functions";
import {
  addProductImage,
  deleteProductImage,
  updateProductImage,
} from "@/lib/media.functions";
import { productImagesQuery, uploadProductImage, type ProductImage } from "@/lib/media";
import { slugify } from "@/lib/mefti";

/** Boş metni null'a, dolu metni sayıya çevirir. */
function numOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

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

function ProductDetailPage() {
  const { storeId, productId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: product, isLoading } = useQuery(productQuery(productId));
  const { data: collections } = useQuery(collectionsQuery(storeId));

  const saveProduct = useServerFn(updateProduct);
  const removeProduct = useServerFn(deleteProduct);
  const saveCollections = useServerFn(setProductCollections);

  const [form, setForm] = useState({
    title: "",
    description: "",
    vendor: "",
    product_type: "",
    base_price: "",
    compare_at_price: "",
    cost_price: "",
    tax_rate: "20",
    sku: "",
    barcode: "",
    seller_name: "",
    video_url: "",
    weight_grams: "",
    length_cm: "",
    width_cm: "",
    height_cm: "",
    tags: "",
    slug: "",
    status: "draft" as "draft" | "active" | "archived",
    seo_title: "",
    seo_description: "",
  });

  useEffect(() => {
    if (!product) return;
    const seo = (product.seo ?? {}) as { title?: string; description?: string };
    setForm({
      title: product.title,
      description: product.description ?? "",
      vendor: product.vendor ?? "",
      product_type: product.product_type ?? "",
      base_price: String(product.base_price ?? 0),
      compare_at_price: product.compare_at_price == null ? "" : String(product.compare_at_price),
      cost_price: product.cost_price == null ? "" : String(product.cost_price),
      tax_rate: String(product.tax_rate ?? 20),
      sku: product.sku ?? "",
      barcode: product.barcode ?? "",
      seller_name: product.seller_name ?? "",
      video_url: product.video_url ?? "",
      weight_grams: product.weight_grams == null ? "" : String(product.weight_grams),
      length_cm: product.length_cm == null ? "" : String(product.length_cm),
      width_cm: product.width_cm == null ? "" : String(product.width_cm),
      height_cm: product.height_cm == null ? "" : String(product.height_cm),
      tags: (product.tags ?? []).join(", "),
      slug: product.slug,
      status: product.status,
      seo_title: seo.title ?? "",
      seo_description: seo.description ?? "",
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
            compare_at_price: numOrNull(form.compare_at_price),
            cost_price: numOrNull(form.cost_price),
            tax_rate: Number(form.tax_rate || 0),
            sku: form.sku.trim() || null,
            barcode: form.barcode.trim() || null,
            seller_name: form.seller_name.trim() || null,
            video_url: form.video_url.trim() || null,
            weight_grams: form.weight_grams.trim() ? Math.round(Number(form.weight_grams)) : null,
            length_cm: numOrNull(form.length_cm),
            width_cm: numOrNull(form.width_cm),
            height_cm: numOrNull(form.height_cm),
            tags: form.tags
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
            slug: slugify(form.slug || form.title),
            status: form.status,
            seo: {
              title: form.seo_title.trim(),
              description: form.seo_description.trim(),
            },
          },
        },
      }),

    onSuccess: async () => {
      await invalidate();
      toast.success("Ürün güncellendi");
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

            <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <h3 className="text-sm font-semibold">Kimlik & tedarik</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-sku">SKU (stok kodu)</Label>
                <Input
                  id="p-sku"
                  value={form.sku}
                  onChange={(event) => setForm((prev) => ({ ...prev, sku: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-barcode">Barkod</Label>
                <Input
                  id="p-barcode"
                  value={form.barcode}
                  onChange={(event) => setForm((prev) => ({ ...prev, barcode: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-seller">Satıcı</Label>
                <Input
                  id="p-seller"
                  placeholder="Satışı yapan firma"
                  value={form.seller_name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, seller_name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-tags">Etiketler (virgülle ayır)</Label>
                <Input
                  id="p-tags"
                  placeholder="yazlık, pamuk, indirim"
                  value={form.tags}
                  onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="p-video">Video adresi (YouTube / Vimeo / MP4)</Label>
                <Input
                  id="p-video"
                  placeholder="https://…"
                  value={form.video_url}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, video_url: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <h3 className="text-sm font-semibold">Fiyatlandırma & vergi</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-compare">İndirimli fiyat referansı ({product.currency})</Label>
                <Input
                  id="p-compare"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Üzeri çizili eski fiyat"
                  value={form.compare_at_price}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, compare_at_price: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cost">Maliyet ({product.currency})</Label>
                <Input
                  id="p-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.cost_price}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, cost_price: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-tax">Vergi oranı (%)</Label>
                <Input
                  id="p-tax"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.tax_rate}
                  onChange={(event) => setForm((prev) => ({ ...prev, tax_rate: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Tahmini brüt marj</Label>
                <p className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                  {form.cost_price && Number(form.base_price) > 0
                    ? `${(((Number(form.base_price) - Number(form.cost_price)) / Number(form.base_price)) * 100).toFixed(1)}%`
                    : "—"}
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-4">
              <div className="sm:col-span-4">
                <h3 className="text-sm font-semibold">Kargo ölçüleri</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-weight">Ağırlık (g)</Label>
                <Input
                  id="p-weight"
                  type="number"
                  min={0}
                  step="1"
                  value={form.weight_grams}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, weight_grams: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-len">Uzunluk (cm)</Label>
                <Input
                  id="p-len"
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.length_cm}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, length_cm: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-wid">Genişlik (cm)</Label>
                <Input
                  id="p-wid"
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.width_cm}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, width_cm: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-hei">Yükseklik (cm)</Label>
                <Input
                  id="p-hei"
                  type="number"
                  min={0}
                  step="0.1"
                  value={form.height_cm}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, height_cm: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-4">
              <div>
                <h3 className="text-sm font-semibold">Arama motoru görünümü (SEO)</h3>
                <p className="text-xs text-muted-foreground">
                  Boş bırakılırsa ürün başlığı ve açıklaması kullanılır.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-seo-title">SEO başlığı</Label>
                <Input
                  id="p-seo-title"
                  maxLength={70}
                  value={form.seo_title}
                  placeholder={form.title}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, seo_title: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">{form.seo_title.length}/70 karakter</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-seo-desc">SEO açıklaması</Label>
                <Textarea
                  id="p-seo-desc"
                  rows={3}
                  maxLength={180}
                  value={form.seo_description}
                  placeholder={form.description.slice(0, 150)}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, seo_description: event.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {form.seo_description.length}/180 karakter
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-slug">SEO adresi (URL)</Label>
                <Input
                  id="p-slug"
                  value={form.slug}
                  onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
                  onBlur={(event) =>
                    setForm((prev) => ({ ...prev, slug: slugify(event.target.value) }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  /p/{slugify(form.slug || form.title) || "urun-adresi"}
                </p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="truncate text-sm text-primary">{form.seo_title || form.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {form.seo_description || form.description.slice(0, 150) || "—"}
                </p>
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

          <ProductGallery storeId={storeId} productId={productId} />

          <VariantManager productId={productId} currency={product.currency} />

        </div>
      )}
    </AppShell>
  );
}

function ProductGallery({ storeId, productId }: { storeId: string; productId: string }) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: images } = useQuery(productImagesQuery(productId));
  const addFn = useServerFn(addProductImage);
  const updateFn = useServerFn(updateProductImage);
  const deleteFn = useServerFn(deleteProductImage);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["product-images", productId] });

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 6)) {
        const path = await uploadProductImage(storeId, productId, file);
        await addFn({ data: { productId, storagePath: path } });
      }
      await invalidate();
      toast.success("Görseller yüklendi");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Görsel yüklenemedi");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const makeCover = useMutation({
    mutationFn: async (image: ProductImage) => {
      const rest = (images ?? []).filter((row) => row.id !== image.id);
      await updateFn({ data: { imageId: image.id, position: 0 } });
      await Promise.all(
        rest.map((row, index) => updateFn({ data: { imageId: row.id, position: index + 1 } })),
      );
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Kapak görseli güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (imageId: string) => deleteFn({ data: { imageId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Görsel silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="surface-card space-y-4 p-6 lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Görseller</h2>
          <p className="text-sm text-muted-foreground">
            JPG, PNG, WEBP veya AVIF · dosya başına en fazla 10 MB · ürün başına 12 görsel.
          </p>
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void handleFiles(event.target.files)}
          />
          <Button size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
            <ImagePlus className="mr-2 size-4" />
            {uploading ? "Yükleniyor…" : "Görsel yükle"}
          </Button>
        </div>
      </div>

      {!images?.length ? (
        <p className="text-sm text-muted-foreground">
          Henüz görsel yok. Vitrinde ürününüzün öne çıkması için en az bir görsel ekleyin.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {images.map((image, index) => (
            <figure key={image.id} className="space-y-2">
              <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
                <img
                  src={image.displayUrl}
                  alt={image.alt ?? ""}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
                {index === 0 ? (
                  <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold text-primary-foreground">
                    Kapak
                  </span>
                ) : null}
              </div>
              <Input
                defaultValue={image.alt ?? ""}
                placeholder="Alt metin (SEO)"
                className="h-8 text-xs"
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (value === (image.alt ?? "")) return;
                  void updateFn({ data: { imageId: image.id, alt: value } }).then(invalidate);
                }}
              />
              <div className="flex gap-2">
                {index !== 0 ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={makeCover.isPending}
                    onClick={() => makeCover.mutate(image)}
                  >
                    <Star className="size-3.5" />
                  </Button>
                ) : null}
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(image.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
