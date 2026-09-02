import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { createProductAdvanced } from "@/lib/catalog.functions";
import { addProductImage } from "@/lib/media.functions";
import { uploadProductImage } from "@/lib/media";
import { slugify } from "@/lib/mefti";
import { warehousesQuery } from "@/lib/warehouses-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/products/new")({
  head: () => ({
    meta: [
      { title: "Yeni Ürün — Mefticaret" },
      {
        name: "description",
        content:
          "Ürün bilgisi, medya, fiyatlandırma, envanter, seçenek matrisi ve SEO alanlarını tek ekranda doldurarak ürünü yayına al.",
      },
      { property: "og:title", content: "Yeni Ürün — Mefticaret" },
      {
        property: "og:description",
        content: "Varyant matrisi, konum bazlı stok ve SEO ile profesyonel ürün ekleme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NewProductPage,
});

type OptionGroup = { name: string; values: string[] };
type MatrixRow = { key: string; title: string; options: Record<string, string>; price: string; stock: string; sku: string; barcode: string };

function numOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Seçenek gruplarından tüm kombinasyonları üretir. */
function buildCombos(groups: OptionGroup[]) {
  const usable = groups.filter((group) => group.name.trim() && group.values.length > 0);
  if (!usable.length) return [] as Record<string, string>[];
  let combos: Record<string, string>[] = [{}];
  for (const group of usable) {
    const next: Record<string, string>[] = [];
    for (const combo of combos) {
      for (const value of group.values) next.push({ ...combo, [group.name.trim()]: value });
    }
    combos = next;
    if (combos.length > 300) return combos.slice(0, 300);
  }
  return combos;
}

function NewProductPage() {
  const { storeId } = Route.useParams();
  const navigate = useNavigate();
  const create = useServerFn(createProductAdvanced);
  const attachImage = useServerFn(addProductImage);
  const { data: warehouses } = useQuery(warehousesQuery(storeId));

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [productType, setProductType] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");

  const [basePrice, setBasePrice] = useState("0");
  const [compareAt, setCompareAt] = useState("");
  const [cost, setCost] = useState("");
  const [taxRate, setTaxRate] = useState("");

  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [trackInventory, setTrackInventory] = useState(true);
  const [stock, setStock] = useState("0");
  const [warehouseId, setWarehouseId] = useState<string>("none");

  const [weight, setWeight] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");

  const [slug, setSlug] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  const [files, setFiles] = useState<File[]>([]);
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [valueDrafts, setValueDrafts] = useState<Record<number, string>>({});
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");

  const margin = useMemo(() => {
    const price = Number(basePrice) || 0;
    const costValue = numOrNull(cost);
    if (!price || costValue === null) return null;
    return Math.round(((price - costValue) / price) * 1000) / 10;
  }, [basePrice, cost]);

  const defaultWarehouseId =
    warehouseId !== "none" ? warehouseId : (warehouses ?? []).find((w) => w.is_default)?.id ?? null;

  /** Seçeneklerden matris satırlarını üretir; mevcut değerleri korur. */
  const regenerateMatrix = () => {
    const combos = buildCombos(groups);
    if (!combos.length) {
      toast.error("Önce en az bir seçenek ve değer tanımlayın");
      return;
    }
    const usable = groups.filter((g) => g.name.trim() && g.values.length > 0);
    const keyOf = (options: Record<string, string>) =>
      usable.map((g) => `${g.name.trim()}=${options[g.name.trim()] ?? ""}`).join("|");
    const existing = new Map(rows.map((row) => [row.key, row]));
    setRows(
      combos.map((options) => {
        const key = keyOf(options);
        const previous = existing.get(key);
        return (
          previous ?? {
            key,
            title: usable.map((g) => options[g.name.trim()]).join(" / "),
            options,
            price: basePrice,
            stock: "0",
            sku: "",
            barcode: "",
          }
        );
      }),
    );
    toast.success(`${combos.length} varyant hazırlandı`);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const product = (await create({
        data: {
          storeId,
          title: title.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(vendor.trim() ? { vendor: vendor.trim() } : {}),
          ...(productType.trim() ? { productType: productType.trim() } : {}),
          status,
          basePrice: Number(basePrice) || 0,
          compareAtPrice: numOrNull(compareAt),
          costPrice: numOrNull(cost),
          ...(numOrNull(taxRate) !== null ? { taxRate: numOrNull(taxRate)! } : {}),
          ...(sku.trim() ? { sku: sku.trim() } : {}),
          ...(barcode.trim() ? { barcode: barcode.trim() } : {}),
          trackInventory,
          weightGrams: numOrNull(weight) === null ? null : Math.trunc(numOrNull(weight)!),
          lengthCm: numOrNull(length),
          widthCm: numOrNull(width),
          heightCm: numOrNull(height),
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 30),
          ...(slug.trim() ? { slug: slugify(slug) } : {}),
          seo: { title: seoTitle.trim(), description: seoDescription.trim() },
          options: groups
            .filter((group) => group.name.trim() && group.values.length > 0)
            .map((group) => ({ name: group.name.trim(), values: group.values })),
          variants: rows.map((row) => ({
            title: row.title,
            options: row.options,
            ...(row.sku.trim() ? { sku: row.sku.trim() } : {}),
            ...(row.barcode.trim() ? { barcode: row.barcode.trim() } : {}),
            price: Number(row.price) || 0,
            stock: Math.max(0, Math.trunc(Number(row.stock) || 0)),
          })),
          stock: Math.max(0, Math.trunc(Number(stock) || 0)),
          ...(defaultWarehouseId ? { warehouseId: defaultWarehouseId } : {}),
        },
      })) as { id: string };

      for (const file of files) {
        try {
          const path = await uploadProductImage(storeId, product.id, file);
          await attachImage({ data: { productId: product.id, storagePath: path } });
        } catch (error) {
          toast.error(`${file.name}: ${(error as Error).message}`);
        }
      }
      return product;
    },
    onSuccess: (product) => {
      toast.success("Ürün oluşturuldu");
      void navigate({
        to: "/store/$storeId/products/$productId",
        params: { storeId, productId: product.id },
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Yeni ürün"
      description="Bilgi, medya, fiyat, envanter, varyant ve SEO alanlarını tek ekranda doldur."
    >
      <div className="flex items-center gap-3">
        <Button asChild size="sm" variant="outline">
          <Link to="/store/$storeId/products" params={{ storeId }}>
            <ArrowLeft className="size-4" /> Ürünler
          </Link>
        </Button>
      </div>

      <form
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="grid gap-6">
          <section className="surface-card grid gap-4 p-6">
            <div className="space-y-2">
              <Label htmlFor="p-title">Başlık</Label>
              <Input
                id="p-title"
                required
                minLength={2}
                placeholder="Örn. Pamuklu Oversize Tişört"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-desc">Açıklama</Label>
              <Textarea
                id="p-desc"
                rows={5}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </section>

          <section className="surface-card grid gap-4 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Medya</h2>
              <Button asChild size="sm" variant="outline" type="button">
                <label className="cursor-pointer">
                  <ImagePlus className="size-4" /> Görsel seç
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const selected = Array.from(event.target.files ?? []);
                      setFiles((prev) => [...prev, ...selected].slice(0, 10));
                      event.target.value = "";
                    }}
                  />
                </label>
              </Button>
            </div>
            {files.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Henüz görsel eklenmedi. Ürün oluşturulduğunda seçilen görseller yüklenir.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="relative overflow-hidden rounded-xl border">
                    <img src={previews[index]} alt={file.name} className="aspect-square w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-background/90 p-1"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                      aria-label="Görseli kaldır"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="surface-card grid gap-4 p-6">
            <h2 className="text-sm font-semibold">Fiyatlandırma</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-price">Fiyat</Label>
                <Input id="p-price" type="number" min={0} step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-compare">İndirim öncesi fiyat</Label>
                <Input id="p-compare" type="number" min={0} step="0.01" value={compareAt} onChange={(e) => setCompareAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-cost">Maliyet</Label>
                <Input id="p-cost" type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-tax">Vergi oranı (%)</Label>
                <Input id="p-tax" type="number" min={0} max={100} step="0.1" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tahmini brüt marj: {margin === null ? "—" : `%${margin}`}
            </p>
          </section>

          <section className="surface-card grid gap-4 p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold">Envanter</h2>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Stok takibi
                <Switch checked={trackInventory} onCheckedChange={setTrackInventory} />
              </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-sku">SKU (stok kodu)</Label>
                <Input id="p-sku" value={sku} onChange={(e) => setSku(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-barcode">Barkod</Label>
                <Input id="p-barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-stock">Başlangıç stoğu {rows.length > 0 ? "(varyantsız durumda)" : ""}</Label>
                <Input id="p-stock" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} disabled={rows.length > 0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-warehouse">Konum (depo / şube)</Label>
                <Select value={warehouseId} onValueChange={setWarehouseId}>
                  <SelectTrigger id="p-warehouse" className="h-9">
                    <SelectValue placeholder="Varsayılan depo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Varsayılan depo</SelectItem>
                    {(warehouses ?? []).map((warehouse) => (
                      <SelectItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                        {warehouse.city ? ` — ${warehouse.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="surface-card grid gap-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">Seçenekler ve varyantlar</h2>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setGroups((prev) => [...prev, { name: "", values: [] }].slice(0, 6))}
                >
                  <Plus className="size-4" /> Seçenek ekle
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={regenerateMatrix}>
                  Varyantları üret
                </Button>
              </div>
            </div>

            {groups.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Renk, beden gibi seçenekler ekleyerek varyant matrisi oluşturabilirsin.
              </p>
            ) : (
              <div className="grid gap-4">
                {groups.map((group, index) => (
                  <div key={index} className="grid gap-3 rounded-xl border p-4">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Seçenek adı (Renk, Beden…)"
                        value={group.name}
                        onChange={(event) =>
                          setGroups((prev) =>
                            prev.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                          )
                        }
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setGroups((prev) => prev.filter((_, i) => i !== index))}
                        aria-label="Seçeneği sil"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.values.map((value) => (
                        <span key={value} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs">
                          {value}
                          <button
                            type="button"
                            onClick={() =>
                              setGroups((prev) =>
                                prev.map((item, i) =>
                                  i === index ? { ...item, values: item.values.filter((v) => v !== value) } : item,
                                ),
                              )
                            }
                            aria-label={`${value} değerini kaldır`}
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Değer ekle ve Enter'a bas"
                        value={valueDrafts[index] ?? ""}
                        onChange={(event) => setValueDrafts((prev) => ({ ...prev, [index]: event.target.value }))}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          const value = (valueDrafts[index] ?? "").trim();
                          if (!value) return;
                          setGroups((prev) =>
                            prev.map((item, i) =>
                              i === index && !item.values.includes(value)
                                ? { ...item, values: [...item.values, value].slice(0, 50) }
                                : item,
                            ),
                          );
                          setValueDrafts((prev) => ({ ...prev, [index]: "" }));
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rows.length > 0 && (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-end gap-2 rounded-xl bg-muted/50 p-3">
                  <div className="space-y-1">
                    <Label htmlFor="bulk-price" className="text-xs">Tüm varyant fiyatı</Label>
                    <Input id="bulk-price" className="h-9 w-32" type="number" min={0} step="0.01" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="bulk-stock" className="text-xs">Tüm varyant stoğu</Label>
                    <Input id="bulk-stock" className="h-9 w-32" type="number" min={0} value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRows((prev) =>
                        prev.map((row) => ({
                          ...row,
                          price: bulkPrice.trim() ? bulkPrice : row.price,
                          stock: bulkStock.trim() ? bulkStock : row.stock,
                        })),
                      );
                      toast.success("Varyantlara uygulandı");
                    }}
                  >
                    Toplu uygula
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th className="p-2 text-left">Varyant</th>
                        <th className="p-2 text-left">Fiyat</th>
                        <th className="p-2 text-left">Stok</th>
                        <th className="p-2 text-left">SKU</th>
                        <th className="p-2 text-left">Barkod</th>
                        <th className="p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={row.key} className="border-b last:border-0">
                          <td className="p-2 font-medium">{row.title}</td>
                          <td className="p-2">
                            <Input
                              className="h-9 w-28"
                              type="number"
                              min={0}
                              step="0.01"
                              value={row.price}
                              onChange={(e) =>
                                setRows((prev) => prev.map((r, i) => (i === index ? { ...r, price: e.target.value } : r)))
                              }
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              className="h-9 w-24"
                              type="number"
                              min={0}
                              value={row.stock}
                              onChange={(e) =>
                                setRows((prev) => prev.map((r, i) => (i === index ? { ...r, stock: e.target.value } : r)))
                              }
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              className="h-9 w-32"
                              value={row.sku}
                              onChange={(e) =>
                                setRows((prev) => prev.map((r, i) => (i === index ? { ...r, sku: e.target.value } : r)))
                              }
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              className="h-9 w-32"
                              value={row.barcode}
                              onChange={(e) =>
                                setRows((prev) => prev.map((r, i) => (i === index ? { ...r, barcode: e.target.value } : r)))
                              }
                            />
                          </td>
                          <td className="p-2 text-right">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                              aria-label="Varyantı kaldır"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="surface-card grid gap-4 p-6">
            <h2 className="text-sm font-semibold">Kargo</h2>
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="p-weight">Ağırlık (g)</Label>
                <Input id="p-weight" type="number" min={0} value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-len">Uzunluk (cm)</Label>
                <Input id="p-len" type="number" min={0} step="0.1" value={length} onChange={(e) => setLength(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-wid">Genişlik (cm)</Label>
                <Input id="p-wid" type="number" min={0} step="0.1" value={width} onChange={(e) => setWidth(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-hei">Yükseklik (cm)</Label>
                <Input id="p-hei" type="number" min={0} step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="surface-card grid gap-4 p-6">
            <h2 className="text-sm font-semibold">Arama motoru görünümü</h2>
            <div className="space-y-2">
              <Label htmlFor="p-seo-title">SEO başlığı</Label>
              <Input id="p-seo-title" maxLength={70} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
              <p className="text-xs text-muted-foreground">{seoTitle.length}/70 karakter</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-seo-desc">SEO açıklaması</Label>
              <Textarea
                id="p-seo-desc"
                rows={3}
                maxLength={180}
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{seoDescription.length}/180 karakter</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-slug">SEO adresi (URL)</Label>
              <Input
                id="p-slug"
                placeholder={slugify(title) || "urun-adresi"}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onBlur={() => setSlug((prev) => (prev.trim() ? slugify(prev) : ""))}
              />
            </div>
            <div className="rounded-xl border p-4">
              <p className="truncate text-sm text-primary">{seoTitle || title || "Ürün başlığı"}</p>
              <p className="text-xs text-muted-foreground">
                /p/{slugify(slug) || slugify(title) || "urun-adresi"}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {seoDescription || description.slice(0, 150) || "—"}
              </p>
            </div>
          </section>
        </div>

        <aside className="grid h-fit gap-6 lg:sticky lg:top-24">
          <section className="surface-card grid gap-4 p-6">
            <h2 className="text-sm font-semibold">Durum</h2>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Taslak</SelectItem>
                <SelectItem value="active">Yayında</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </section>

          <section className="surface-card grid gap-4 p-6">
            <h2 className="text-sm font-semibold">Organizasyon</h2>
            <div className="space-y-2">
              <Label htmlFor="p-vendor">Marka / Satıcı</Label>
              <Input id="p-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-type">Ürün tipi</Label>
              <Input id="p-type" value={productType} onChange={(e) => setProductType(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-tags">Etiketler (virgülle ayır)</Label>
              <Input id="p-tags" value={tags} onChange={(e) => setTags(e.target.value)} />
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            Kaydettikten sonra koleksiyonlar, ek görseller ve depo bazlı stok hareketleri ürün
            detayında yönetilir.
          </p>
        </aside>
      </form>
    </AppShell>
  );
}
