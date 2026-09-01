import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { productQuery } from "@/lib/catalog-queries";
import { deleteVariant, generateVariants, setVariantOptions, upsertVariant } from "@/lib/catalog.functions";
import { productImagesQuery } from "@/lib/media";
import { formatMoney } from "@/lib/mefti";

type OptionGroup = { name: string; values: string[] };

type VariantRowData = {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  compare_at_price: number | null;
  cost_price: number | null;
  stock: number;
  weight_grams: number | null;
  image_id: string | null;
  options: Record<string, string> | null;
};

type VariantInput = {
  title: string;
  sku: string;
  barcode: string;
  price: number;
  compareAtPrice: number | null;
  costPrice: number | null;
  stock: number;
  weightGrams: number | null;
  imageId: string | null;
  options: Record<string, string>;
};

function num(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Sınırsız varyant yönetimi: seçenek grupları (Renk, Beden…) tanımlanır,
 * kombinasyonlar otomatik üretilir ve her varyantın SKU, barkod, fiyat,
 * stok, görsel ve ağırlık alanı ayrı ayrı düzenlenir.
 */
export function VariantManager({
  productId,
  currency,
}: {
  productId: string;
  currency: string;
}) {
  const queryClient = useQueryClient();
  const { data: product } = useQuery(productQuery(productId));
  const { data: images } = useQuery(productImagesQuery(productId));

  const saveOptions = useServerFn(setVariantOptions);
  const generate = useServerFn(generateVariants);
  const saveVariant = useServerFn(upsertVariant);
  const removeVariant = useServerFn(deleteVariant);

  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [valueDrafts, setValueDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!product) return;
    const raw = ((product as { variant_options?: unknown }).variant_options ?? []) as OptionGroup[];
    setGroups(
      Array.isArray(raw)
        ? raw.map((group) => ({ name: group?.name ?? "", values: group?.values ?? [] }))
        : [],
    );
  }, [product]);

  const variants = ((product?.product_variants ?? []) as VariantRowData[])
    .slice()
    .sort((a, b) => a.title.localeCompare(b.title, "tr"));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["product", productId] });

  const optionsMutation = useMutation({
    mutationFn: (next: OptionGroup[]) => saveOptions({ data: { productId, options: next } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Seçenekler kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const generateMutation = useMutation({
    mutationFn: () => generate({ data: { productId, options: groups } }),
    onSuccess: async (result) => {
      await invalidate();
      toast.success(
        result.created > 0
          ? `${result.created} yeni varyant oluşturuldu`
          : "Tüm kombinasyonlar zaten mevcut",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const variantMutation = useMutation({
    mutationFn: (input: VariantInput & { variantId?: string }) =>
      saveVariant({ data: { productId, ...input } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Varyant kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (variantId: string) => removeVariant({ data: { variantId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Varyant silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const comboCount = useMemo(
    () =>
      groups
        .filter((group) => group.name.trim() && group.values.length)
        .reduce((total, group) => total * group.values.length, 1),
    [groups],
  );
  const activeGroups = groups.filter((group) => group.name.trim() && group.values.length);

  const imageOptions = (images ?? []).map((image) => ({
    id: image.id,
    url: image.displayUrl || image.url,
  }));

  return (
    <div className="surface-card space-y-6 p-6 lg:col-span-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Varyantlar</h2>
          <p className="text-sm text-muted-foreground">
            Seçenek gruplarını tanımlayın (örn. Renk: Siyah, Beyaz · Beden: S, M, L) ve
            kombinasyonları otomatik üretin. Her varyantın SKU, barkod, fiyat, stok, görsel ve
            ağırlık alanı ayrıdır.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={optionsMutation.isPending}
            onClick={() => optionsMutation.mutate(groups)}
          >
            Seçenekleri kaydet
          </Button>
          <Button
            size="sm"
            className="gap-1"
            disabled={!activeGroups.length || generateMutation.isPending}
            onClick={() => generateMutation.mutate()}
          >
            <Sparkles className="size-4" />
            {generateMutation.isPending ? "Üretiliyor…" : `Kombinasyon üret (${comboCount})`}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group, index) => (
          <div key={index} className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2">
              <Input
                value={group.name}
                placeholder="Seçenek adı (Renk, Beden…)"
                onChange={(event) =>
                  setGroups((prev) =>
                    prev.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)),
                  )
                }
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Seçeneği kaldır"
                onClick={() => setGroups((prev) => prev.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {group.values.map((value) => (
                <span
                  key={value}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs"
                >
                  {value}
                  <button
                    type="button"
                    aria-label={`${value} değerini kaldır`}
                    onClick={() =>
                      setGroups((prev) =>
                        prev.map((row, i) =>
                          i === index
                            ? { ...row, values: row.values.filter((item) => item !== value) }
                            : row,
                        ),
                      )
                    }
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <form
              className="mt-3 flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const value = (valueDrafts[index] ?? "").trim();
                if (!value) return;
                setGroups((prev) =>
                  prev.map((row, i) =>
                    i === index && !row.values.includes(value)
                      ? { ...row, values: [...row.values, value] }
                      : row,
                  ),
                );
                setValueDrafts((prev) => ({ ...prev, [index]: "" }));
              }}
            >
              <Input
                value={valueDrafts[index] ?? ""}
                placeholder="Değer ekle ve Enter'a bas"
                onChange={(event) =>
                  setValueDrafts((prev) => ({ ...prev, [index]: event.target.value }))
                }
              />
              <Button type="submit" size="sm" variant="outline">
                Ekle
              </Button>
            </form>
          </div>
        ))}
        <button
          type="button"
          className="flex min-h-32 items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground transition hover:border-primary hover:text-foreground"
          onClick={() => setGroups((prev) => [...prev, { name: "", values: [] }])}
        >
          <Plus className="size-4" /> Seçenek grubu ekle
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Varyant</th>
              <th className="py-2 pr-3">SKU</th>
              <th className="py-2 pr-3">Barkod</th>
              <th className="py-2 pr-3">Fiyat</th>
              <th className="py-2 pr-3">Liste fiyatı</th>
              <th className="py-2 pr-3">Stok</th>
              <th className="py-2 pr-3">Ağırlık (g)</th>
              <th className="py-2 pr-3">Görsel</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {variants.map((variant) => (
              <VariantRow
                key={variant.id}
                variant={variant}
                currency={currency}
                imageOptions={imageOptions}
                pending={variantMutation.isPending}
                onSave={(input) => variantMutation.mutate({ variantId: variant.id, ...input })}
                onDelete={() => deleteMutation.mutate(variant.id)}
              />
            ))}
            {variants.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-4 text-sm text-muted-foreground">
                  Henüz varyant yok. Seçenek tanımlayıp kombinasyon üretin veya elle bir varyant
                  ekleyin.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ManualVariantForm
        pending={variantMutation.isPending}
        onCreate={(input) => variantMutation.mutate(input)}
      />

      <p className="text-xs text-muted-foreground">
        Toplam {variants.length} varyant · {variants.reduce((sum, row) => sum + (row.stock ?? 0), 0)}{" "}
        adet stok · Ortalama fiyat{" "}
        {formatMoney(
          variants.length
            ? variants.reduce((sum, row) => sum + Number(row.price ?? 0), 0) / variants.length
            : 0,
          currency,
        )}
      </p>
    </div>
  );
}

function VariantRow({
  variant,
  currency,
  imageOptions,
  pending,
  onSave,
  onDelete,
}: {
  variant: VariantRowData;
  currency: string;
  imageOptions: { id: string; url: string }[];
  pending: boolean;
  onSave: (input: VariantInput) => void;
  onDelete: () => void;
}) {
  const [state, setState] = useState({
    title: variant.title,
    sku: variant.sku ?? "",
    barcode: variant.barcode ?? "",
    price: String(variant.price ?? 0),
    compare: variant.compare_at_price == null ? "" : String(variant.compare_at_price),
    stock: String(variant.stock ?? 0),
    weight: variant.weight_grams == null ? "" : String(variant.weight_grams),
    imageId: variant.image_id ?? "",
  });

  useEffect(() => {
    setState({
      title: variant.title,
      sku: variant.sku ?? "",
      barcode: variant.barcode ?? "",
      price: String(variant.price ?? 0),
      compare: variant.compare_at_price == null ? "" : String(variant.compare_at_price),
      stock: String(variant.stock ?? 0),
      weight: variant.weight_grams == null ? "" : String(variant.weight_grams),
      imageId: variant.image_id ?? "",
    });
  }, [variant]);

  const selectedImage = imageOptions.find((image) => image.id === state.imageId);

  return (
    <tr>
      <td className="py-2 pr-3">
        <Input value={state.title} onChange={(e) => setState((p) => ({ ...p, title: e.target.value }))} />
        {variant.options && Object.keys(variant.options).length ? (
          <span className="text-[0.7rem] text-muted-foreground">
            {Object.entries(variant.options)
              .map(([key, value]) => `${key}: ${value}`)
              .join(" · ")}
          </span>
        ) : null}
      </td>
      <td className="py-2 pr-3">
        <Input value={state.sku} onChange={(e) => setState((p) => ({ ...p, sku: e.target.value }))} />
      </td>
      <td className="py-2 pr-3">
        <Input
          value={state.barcode}
          onChange={(e) => setState((p) => ({ ...p, barcode: e.target.value }))}
        />
      </td>
      <td className="py-2 pr-3">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={state.price}
          onChange={(e) => setState((p) => ({ ...p, price: e.target.value }))}
        />
        <span className="text-[0.7rem] text-muted-foreground">
          {formatMoney(Number(state.price || 0), currency)}
        </span>
      </td>
      <td className="py-2 pr-3">
        <Input
          type="number"
          min={0}
          step="0.01"
          value={state.compare}
          onChange={(e) => setState((p) => ({ ...p, compare: e.target.value }))}
        />
      </td>
      <td className="py-2 pr-3">
        <Input
          type="number"
          min={0}
          value={state.stock}
          onChange={(e) => setState((p) => ({ ...p, stock: e.target.value }))}
        />
      </td>
      <td className="py-2 pr-3">
        <Input
          type="number"
          min={0}
          value={state.weight}
          onChange={(e) => setState((p) => ({ ...p, weight: e.target.value }))}
        />
      </td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          {selectedImage?.url ? (
            <img
              src={selectedImage.url}
              alt=""
              className="size-9 rounded-md border border-border object-cover"
            />
          ) : null}
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={state.imageId}
            onChange={(e) => setState((p) => ({ ...p, imageId: e.target.value }))}
            aria-label="Varyant görseli"
          >
            <option value="">Görsel yok</option>
            {imageOptions.map((image, index) => (
              <option key={image.id} value={image.id}>
                Görsel {index + 1}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className="py-2">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              onSave({
                title: state.title,
                sku: state.sku,
                barcode: state.barcode,
                price: Number(state.price || 0),
                compareAtPrice: num(state.compare),
                costPrice: variant.cost_price ?? null,
                stock: Math.round(Number(state.stock || 0)),
                weightGrams: state.weight.trim() ? Math.round(Number(state.weight)) : null,
                imageId: state.imageId || null,
                options: (variant.options ?? {}) as Record<string, string>,
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

function ManualVariantForm({
  pending,
  onCreate,
}: {
  pending: boolean;
  onCreate: (input: VariantInput) => void;
}) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("0");

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border p-4">
      <div className="grid gap-1">
        <Label htmlFor="manual-variant-title">Varyant adı</Label>
        <Input
          id="manual-variant-title"
          placeholder="Örn. Siyah / M"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="manual-variant-price">Fiyat</Label>
        <Input
          id="manual-variant-price"
          type="number"
          min={0}
          step="0.01"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="manual-variant-stock">Stok</Label>
        <Input
          id="manual-variant-stock"
          type="number"
          min={0}
          value={stock}
          onChange={(event) => setStock(event.target.value)}
        />
      </div>
      <Button
        className="gap-1"
        disabled={pending || title.trim().length === 0}
        onClick={() => {
          onCreate({
            title: title.trim(),
            sku: "",
            barcode: "",
            price: Number(price || 0),
            compareAtPrice: null,
            costPrice: null,
            stock: Math.round(Number(stock || 0)),
            weightGrams: null,
            imageId: null,
            options: {},
          });
          setTitle("");
          setPrice("");
          setStock("0");
        }}
      >
        <Plus className="size-4" /> Varyant ekle
      </Button>
    </div>
  );
}
