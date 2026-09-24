import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Eye, GripVertical, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { V2ErrorState } from "@/components/v2/feature-gate";
import { RichTextEditor } from "@/components/v2/rich-text-editor";
import { TagInput } from "@/components/v2/tag-input";
import { supabase } from "@/integrations/supabase/client";
import { buildVariants, margin, type ProductOptionInput, type VariantDraft } from "@/lib/commerce-v2";
import { v2GetProduct, v2ListCollections, v2SaveProduct } from "@/lib/commerce-v2.functions";
import { productImagesQuery, uploadProductImage, type ProductImage } from "@/lib/media";
import { addProductImage, deleteProductImage } from "@/lib/media.functions";
import { slugify } from "@/lib/mefti";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/catalog-v2/$productId")({
  head: () => ({
    meta: [
      { title: "Ürün Düzenle — Mefticaret" },
      { name: "description", content: "Başlık, zengin açıklama, medya, fiyat, seçenek/varyant, SEO, koleksiyon ve etiketleri tek ekranda düzenle." },
      { property: "og:title", content: "Ürün Düzenle — Mefticaret" },
      { property: "og:description", content: "Mobil öncelikli ürün formu: varyant tablosu, SEO önizlemesi ve sürükle-bırak medya." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductFormV2,
});

type Form = {
  title: string; description: string; handle: string; vendor: string; product_type: string;
  status: "draft" | "active" | "archived"; seo_title: string; seo_description: string; tags: string[];
  price: string; compare_at_price: string; cost_price: string;
};
const EMPTY: Form = { title: "", description: "", handle: "", vendor: "", product_type: "", status: "draft", seo_title: "", seo_description: "", tags: [], price: "0", compare_at_price: "", cost_price: "" };
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

function ProductFormV2() {
  const { storeId, productId } = Route.useParams();
  const isNew = productId === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(v2GetProduct);
  const saveFn = useServerFn(v2SaveProduct);
  const colFn = useServerFn(v2ListCollections);

  const product = useQuery({
    queryKey: ["v2-product", productId],
    queryFn: () => getFn({ data: { storeId, productId } }),
    enabled: !isNew,
  });
  const collections = useQuery({ queryKey: ["v2-collections-pick", storeId], queryFn: () => colFn({ data: { storeId, module: "products" } }) });
  const store = useQuery({
    queryKey: ["store-slug", storeId],
    queryFn: async () => (await supabase.from("stores").select("slug").eq("id", storeId).maybeSingle()).data,
  });

  const [form, setForm] = useState<Form>(EMPTY);
  const [options, setOptions] = useState<ProductOptionInput[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [handleTouched, setHandleTouched] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    const p = product.data;
    if (!p || loaded.current) return;
    loaded.current = true;
    setForm({
      title: p.title ?? "", description: p.description ?? "", handle: p.slug ?? "", vendor: p.vendor ?? "",
      product_type: p.product_type ?? "", status: p.status, seo_title: p.seo_title ?? p.seo?.title ?? "",
      seo_description: p.seo_description ?? p.seo?.description ?? "", tags: p.tags ?? [],
      price: String(p.base_price ?? 0), compare_at_price: p.compare_at_price != null ? String(p.compare_at_price) : "",
      cost_price: p.cost_price != null ? String(p.cost_price) : "",
    });
    setHandleTouched(true);
    const opts = (p.variant_options ?? []) as ProductOptionInput[];
    setOptions(opts);
    setVariants((p.product_variants ?? []).map((v: any) => {
      const vals = opts.map((o) => v.options?.[o.name] ?? null);
      return {
        id: v.id, title: v.title, option1: v.option1 ?? vals[0] ?? null, option2: v.option2 ?? vals[1] ?? null, option3: v.option3 ?? vals[2] ?? null,
        sku: v.sku ?? "", barcode: v.barcode ?? "", price: Number(v.price), compare_at_price: v.compare_at_price, cost_price: v.cost_price,
        stock: v.stock ?? 0, inventory_policy: v.inventory_policy ?? "deny",
        weight: v.weight_grams != null ? (v.weight_unit === "kg" ? v.weight_grams / 1000 : v.weight_unit === "lb" ? Math.round((v.weight_grams / 453.59237) * 100) / 100 : v.weight_grams) : null,
        weight_unit: v.weight_unit ?? "g",
      } satisfies VariantDraft;
    }));
    setCollectionIds((p.product_collections ?? []).map((c: any) => c.collection_id));
  }, [product.data]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const defaults = { price: Number(num(form.price) ?? 0), compare_at_price: num(form.compare_at_price), cost_price: num(form.cost_price) };
  function applyOptions(next: ProductOptionInput[]) {
    setOptions(next);
    setVariants((cur) => buildVariants(next, cur, defaults));
  }
  const hasOptions = options.some((o) => o.name.trim() && o.values.length);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title, description: form.description || null, handle: form.handle || form.title,
        vendor: form.vendor || null, product_type: form.product_type || null, status: form.status,
        seo_title: form.seo_title || null, seo_description: form.seo_description || null, tags: form.tags,
        price: defaults.price, compare_at_price: defaults.compare_at_price, cost_price: defaults.cost_price,
        options: options.filter((o) => o.name.trim()),
        variants: (hasOptions ? variants : [{ ...(variants[0] ?? buildVariants([], [], defaults)[0]!), ...defaults, title: "Varsayılan", option1: null, option2: null, option3: null }]).map((v, i) => ({
          id: v.id, title: v.title, sku: v.sku || null, barcode: v.barcode || null, price: v.price, compare_at_price: v.compare_at_price,
          cost_price: v.cost_price, stock: v.stock, inventory_policy: v.inventory_policy, weight: v.weight, weight_unit: v.weight_unit,
          option1: v.option1, option2: v.option2, option3: v.option3, is_default: i === 0, position: i,
        })),
        collection_ids: collectionIds,
      };
      return saveFn({ data: { storeId, productId: isNew ? undefined : productId, product: payload } });
    },
    onSuccess: (r) => {
      toast.success("Ürün kaydedildi");
      qc.invalidateQueries({ queryKey: ["v2-products", storeId] });
      qc.invalidateQueries({ queryKey: ["products", storeId] });
      loaded.current = false;
      qc.invalidateQueries({ queryKey: ["v2-product", r.id] });
      set("handle", r.handle);
      if (isNew) navigate({ to: "/store/$storeId/catalog-v2/$productId", params: { storeId, productId: r.id }, replace: true });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kaydedilemedi"),
  });

  if (!isNew && product.isError) return <AppShell storeId={storeId} title="Ürün"><V2ErrorState error={product.error} /></AppShell>;
  if (collections.isError) return <AppShell storeId={storeId} title="Ürün"><V2ErrorState error={collections.error} /></AppShell>;
  if (!isNew && product.isSuccess && !product.data) return <AppShell storeId={storeId} title="Ürün"><p className="text-sm text-muted-foreground">Ürün bulunamadı.</p></AppShell>;

  const m = margin(defaults.price, defaults.cost_price);
  const previewUrl = store.data?.slug && form.handle && !isNew ? `/s/${store.data.slug}/p/${form.handle}` : null;

  return (
    <AppShell storeId={storeId} title={isNew ? "Yeni ürün" : form.title || "Ürün"}>
      <div className="mx-auto max-w-3xl space-y-4 pb-28">
        <Link to="/store/$storeId/catalog-v2" params={{ storeId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Ürünler
        </Link>

        <Card>
          <Field label="Başlık">
            <Input value={form.title} maxLength={300} placeholder="Örn. Pamuklu tişört" className="h-11" onChange={(e) => {
              set("title", e.target.value);
              if (!handleTouched) set("handle", slugify(e.target.value));
            }} />
          </Field>
          <Field label="Açıklama">
            <RichTextEditor value={form.description} onChange={(h) => set("description", h)} />
          </Field>
        </Card>

        <Card title="Medya">
          {isNew ? <p className="text-sm text-muted-foreground">Görsel eklemek için önce ürünü kaydet.</p> : <MediaManager storeId={storeId} productId={productId} />}
        </Card>

        <Card title="Fiyatlandırma">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Fiyat (₺)"><Input inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} className="h-11" /></Field>
            <Field label="Karşılaştırma fiyatı"><Input inputMode="decimal" value={form.compare_at_price} onChange={(e) => set("compare_at_price", e.target.value)} className="h-11" /></Field>
            <Field label="Maliyet"><Input inputMode="decimal" value={form.cost_price} onChange={(e) => set("cost_price", e.target.value)} className="h-11" /></Field>
          </div>
          {m !== null && <p className="text-xs text-muted-foreground">Kâr marjı: <span className={cn("font-medium", m < 0 ? "text-destructive" : "text-success")}>%{m}</span></p>}
        </Card>

        <Card title="Seçenekler">
          {options.map((o, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex gap-2">
                <Input value={o.name} placeholder="Seçenek adı (Renk, Beden, Malzeme)" className="h-11" onChange={(e) => applyOptions(options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Button variant="ghost" size="icon" className="size-11 shrink-0" aria-label="Seçeneği kaldır" onClick={() => applyOptions(options.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
              </div>
              <TagInput value={o.values} placeholder="Değer yaz, Enter'a bas (Kırmızı, Mavi…)" onChange={(vals) => applyOptions(options.map((x, j) => (j === i ? { ...x, values: vals } : x)))} />
            </div>
          ))}
          {options.length < 3 && (
            <Button variant="outline" className="h-11 w-full" onClick={() => setOptions([...options, { name: "", values: [] }])}>
              <Plus className="size-4" /> Seçenek ekle
            </Button>
          )}
        </Card>

        {hasOptions && variants.length > 0 && <VariantTable variants={variants} onChange={setVariants} />}
        {!hasOptions && (
          <Card title="Stok">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Stok adedi"><Input inputMode="numeric" value={String(variants[0]?.stock ?? 0)} className="h-11" onChange={(e) => setVariants([{ ...(variants[0] ?? buildVariants([], [], defaults)[0]!), stock: Math.max(0, Number(e.target.value) || 0) }])} /></Field>
              <Field label="SKU"><Input value={variants[0]?.sku ?? ""} className="h-11" onChange={(e) => setVariants([{ ...(variants[0] ?? buildVariants([], [], defaults)[0]!), sku: e.target.value }])} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={variants[0]?.inventory_policy === "continue"} onCheckedChange={(c) => setVariants([{ ...(variants[0] ?? buildVariants([], [], defaults)[0]!), inventory_policy: c ? "continue" : "deny" }])} />
              Stok bitince de satışa devam et
            </label>
          </Card>
        )}

        <Card title="SEO">
          <div className="rounded-lg border border-border bg-background p-3">
            <p className="truncate text-xs text-muted-foreground">{store.data?.slug ?? "magaza"}.mefticaret.com › p › {form.handle || "urun"}</p>
            <p className="truncate text-base text-brand">{form.seo_title || form.title || "Ürün başlığı"}</p>
            <p className="line-clamp-2 text-sm text-muted-foreground">{form.seo_description || form.description.replace(/<[^>]+>/g, " ").slice(0, 160) || "Meta açıklama…"}</p>
          </div>
          <Field label={`Meta başlık (${form.seo_title.length}/70)`}><Input value={form.seo_title} maxLength={120} onChange={(e) => set("seo_title", e.target.value)} className="h-11" /></Field>
          <Field label={`Meta açıklama (${form.seo_description.length}/160)`}><Textarea value={form.seo_description} maxLength={320} rows={3} onChange={(e) => set("seo_description", e.target.value)} /></Field>
          <Field label="URL handle"><Input value={form.handle} onChange={(e) => { setHandleTouched(true); set("handle", slugify(e.target.value)); }} className="h-11" /></Field>
        </Card>

        <Card title="Düzen">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Ürün tipi"><Input value={form.product_type} onChange={(e) => set("product_type", e.target.value)} className="h-11" /></Field>
            <Field label="Marka / Satıcı"><Input value={form.vendor} onChange={(e) => set("vendor", e.target.value)} className="h-11" /></Field>
          </div>
          <Field label="Koleksiyonlar">
            <div className="flex flex-wrap gap-2">
              {(collections.data ?? []).filter((c) => c.collection_type !== "smart").map((c) => {
                const on = collectionIds.includes(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => setCollectionIds(on ? collectionIds.filter((x) => x !== c.id) : [...collectionIds, c.id])}
                    className={cn("min-h-9 rounded-full border px-3 text-sm", on ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
                    {c.title}
                  </button>
                );
              })}
              {(collections.data ?? []).length === 0 && <span className="text-sm text-muted-foreground">Henüz koleksiyon yok.</span>}
            </div>
            <p className="text-xs text-muted-foreground">Akıllı koleksiyonlar kurallarına göre otomatik dolar.</p>
          </Field>
          <Field label="Etiketler"><TagInput value={form.tags} onChange={(t) => set("tags", t)} /></Field>
          <Field label="Durum">
            <Select value={form.status} onValueChange={(v) => set("status", v as Form["status"])}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Taslak</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="archived">Arşivlendi</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button className="h-11 flex-1 rounded-full" disabled={save.isPending || !form.title.trim()} onClick={() => save.mutate()}>
            {save.isPending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
          <Button variant="outline" className="h-11 rounded-full" disabled={!previewUrl} asChild={!!previewUrl}>
            {previewUrl ? <a href={previewUrl} target="_blank" rel="noreferrer"><Eye className="size-4" /> Önizle</a> : <span><Eye className="size-4" /> Önizle</span>}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      {title && <h2 className="text-sm font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function VariantTable({ variants, onChange }: { variants: VariantDraft[]; onChange: (v: VariantDraft[]) => void }) {
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkStock, setBulkStock] = useState("");
  const upd = (i: number, patch: Partial<VariantDraft>) => onChange(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <Card title={`Varyantlar (${variants.length})`}>
      <div className="flex flex-wrap gap-2">
        <Input className="h-9 w-28" placeholder="Toplu fiyat" inputMode="decimal" value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)} />
        <Button size="sm" variant="outline" disabled={!bulkPrice} onClick={() => { onChange(variants.map((v) => ({ ...v, price: Number(bulkPrice.replace(",", ".")) || 0 }))); setBulkPrice(""); }}>Tümüne uygula</Button>
        <Input className="h-9 w-28" placeholder="Toplu stok" inputMode="numeric" value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} />
        <Button size="sm" variant="outline" disabled={!bulkStock} onClick={() => { onChange(variants.map((v) => ({ ...v, stock: Math.max(0, Number(bulkStock) || 0) }))); setBulkStock(""); }}>Tümüne uygula</Button>
      </div>
      <div className="divide-y divide-border rounded-lg border border-border">
        {variants.map((v, i) => (
          <div key={`${v.title}-${i}`} className="grid grid-cols-2 items-center gap-2 p-2.5 sm:grid-cols-[1fr_7rem_6rem_8rem]">
            <p className="col-span-2 truncate text-sm font-medium sm:col-span-1">{v.title}</p>
            <Input aria-label={`${v.title} fiyat`} inputMode="decimal" className="h-10" value={String(v.price)} onChange={(e) => upd(i, { price: Number(e.target.value.replace(",", ".")) || 0 })} />
            <Input aria-label={`${v.title} stok`} inputMode="numeric" className="h-10" value={String(v.stock)} onChange={(e) => upd(i, { stock: Math.max(0, Number(e.target.value) || 0) })} />
            <Input aria-label={`${v.title} SKU`} placeholder="SKU" className="col-span-2 h-10 sm:col-span-1" value={v.sku} onChange={(e) => upd(i, { sku: e.target.value })} />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Fiyat · Stok · SKU. Kaydedilince seçeneklere göre varyantlar oluşturulur; kaldırılan kombinasyonlar silinir.</p>
    </Card>
  );
}

function MediaManager({ storeId, productId }: { storeId: string; productId: string }) {
  const qc = useQueryClient();
  const addFn = useServerFn(addProductImage);
  const delFn = useServerFn(deleteProductImage);
  const saveFn = useServerFn(v2SaveProduct);
  const getFn = useServerFn(v2GetProduct);
  const images = useQuery(productImagesQuery(productId));
  const [order, setOrder] = useState<ProductImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (images.data) setOrder(images.data); }, [images.data]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));
  const ids = useMemo(() => order.map((o) => o.id), [order]);

  async function upload(files: FileList | File[] | null) {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 12)) {
        const path = await uploadProductImage(storeId, productId, f);
        await addFn({ data: { productId, storagePath: path } });
      }
      await qc.invalidateQueries({ queryKey: ["product-images", productId] });
      toast.success("Görseller yüklendi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function persistOrder(next: ProductImage[]) {
    setOrder(next);
    try {
      // Yalnız sıralamayı kaydetmek için mevcut ürün verisiyle kısmi kayıt.
      const p = await getFn({ data: { storeId, productId } });
      if (!p) return;
      await saveFn({ data: { storeId, productId, product: {
        title: p.title, description: p.description, handle: p.slug, vendor: p.vendor, product_type: p.product_type, status: p.status,
        seo_title: p.seo_title, seo_description: p.seo_description, tags: p.tags ?? [], price: Number(p.base_price),
        compare_at_price: p.compare_at_price, cost_price: p.cost_price, options: p.variant_options ?? [],
        media_order: next.map((n) => n.id),
      } } });
      qc.invalidateQueries({ queryKey: ["product-images", productId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sıralama kaydedilemedi");
    }
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = ids.indexOf(String(e.active.id));
    const to = ids.indexOf(String(e.over.id));
    void persistOrder(arrayMove(order, from, to));
  }

  return (
    <div
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); setDragOver(false); void upload(e.dataTransfer.files); } }}
      className={cn("rounded-lg", dragOver && "ring-2 ring-brand")}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <button type="button" onClick={() => input.current?.click()} disabled={uploading}
              className="grid aspect-square place-items-center rounded-lg border border-dashed border-border text-muted-foreground hover:bg-muted">
              <span className="flex flex-col items-center gap-1 text-xs"><ImagePlus className="size-5" />{uploading ? "Yükleniyor…" : "Ekle"}</span>
            </button>
            {order.map((img, i) => (
              <SortableThumb key={img.id} img={img} cover={i === 0} onDelete={async () => {
                await delFn({ data: { imageId: img.id } });
                qc.invalidateQueries({ queryKey: ["product-images", productId] });
              }} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files)} />
      <p className="mt-2 text-xs text-muted-foreground">Dosyaları buraya sürükle-bırak. Sıralamak için görseli sürükle; ilk görsel kapak olur.</p>
    </div>
  );
}

function SortableThumb({ img, cover, onDelete }: { img: ProductImage; cover: boolean; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted", isDragging && "z-10 opacity-70")}>
      {img.displayUrl && <img src={img.displayUrl} alt={img.alt ?? ""} className="size-full object-cover" />}
      <button type="button" {...attributes} {...listeners} aria-label="Sürükle" className="absolute left-1 top-1 grid size-7 touch-none place-items-center rounded-md bg-background/80">
        <GripVertical className="size-3.5" />
      </button>
      <button type="button" onClick={onDelete} aria-label="Görseli sil" className="absolute right-1 top-1 grid size-7 place-items-center rounded-md bg-background/80">
        <X className="size-3.5" />
      </button>
      {cover && <span className="absolute inset-x-1 bottom-1 rounded bg-background/85 text-center text-[10px] font-medium">Kapak</span>}
    </div>
  );
}
