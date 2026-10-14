import { QueryStatus } from "@/components/query-status";
import { SmartImage } from "@/components/smart-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  studioBulkUpdate,
  studioGetProduct,
  studioListProducts,
  studioOverview,
  studioSaveProduct,
  studioSetCatalogPublic,
} from "@/lib/supplier-studio.functions";
import { formatMoney } from "@/lib/mefti";

const err = (e: unknown) => toast.error(e instanceof Error ? e.message : "İşlem başarısız");

/* ---------------------------- İstatistikler ---------------------------- */

export function SupplierSellerStats({ supplierId }: { supplierId: string }) {
  const qc = useQueryClient();
  const get = useServerFn(studioOverview);
  const setPublic = useServerFn(studioSetCatalogPublic);
  const q = useQuery({
    queryKey: ["studio-overview", supplierId],
    enabled: !!supplierId,
    queryFn: () => get({ data: { supplierId } }),
  });
  const m = useMutation({
    mutationFn: (isPublic: boolean) => setPublic({ data: { supplierId, isPublic } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["studio-overview", supplierId] }),
    onError: err,
  });
  const d = q.data;
  if (!d) return <QueryStatus label="Katalog istatistikleri" error={q.error} loading={q.isPending} hasData={false} onRetry={() => void q.refetch()} />;
  const stat = (label: string, value: string) => (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">Satıcı kataloğu</div>
          <p className="text-sm text-muted-foreground">
            Açıkken tüm Mefticaret mağazaları ürünlerinizi görüp kendi mağazasına aktarabilir.
          </p>
        </div>
        <Switch checked={d.isPublic} disabled={m.isPending} onCheckedChange={(v) => m.mutate(v)} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat("Ürün", String(d.totalProducts))}
        {stat("Aktaran mağaza", String(d.stores))}
        {stat("Toplam aktarım", String(d.imports))}
        {stat("Satılan adet", String(d.unitsSold))}
        {stat("Mağaza cirosu", formatMoney(d.revenue, d.currency))}
        {stat("Gizli ürün", String(d.hiddenProducts))}
        {stat("Stoksuz ürün", String(d.outOfStock))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TopList
          title="En çok aktarılanlar"
          rows={d.topImported.map((r) => [r.title, `${r.count} mağaza`])}
        />
        <TopList
          title="En çok satılanlar"
          rows={d.topSold.map((r) => [r.title, `${r.qty} adet`])}
        />
      </div>
    </div>
  );
}

function TopList({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium">{title}</div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Henüz veri yok.</p>
      ) : (
        <ol className="space-y-1 text-sm">
          {rows.map(([a, b], i) => (
            <li key={i} className="flex justify-between gap-2">
              <span className="line-clamp-1">
                {i + 1}. {a}
              </span>
              <span className="shrink-0 text-muted-foreground">{b}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------ Stüdyo ------------------------------ */

export type StudioItem = Awaited<ReturnType<typeof studioListProducts>>["items"][number];
type Item = StudioItem;

export function SupplierCatalogStudio({ supplierId }: { supplierId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(studioListProducts);
  const bulk = useServerFn(studioBulkUpdate);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "visible" | "hidden" | "out">("all");
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [percent, setPercent] = useState("");
  const [stock, setStock] = useState("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const q = useQuery({
    queryKey: ["studio-products", supplierId, term, filter, page],
    enabled: !!supplierId,
    queryFn: () => list({ data: { supplierId, search: term, filter, page } }),
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["studio-products", supplierId] });
    qc.invalidateQueries({ queryKey: ["studio-overview", supplierId] });
  };
  const b = useMutation({
    mutationFn: (input: {
      pricePercent?: number;
      setStock?: number;
      visible?: boolean;
      remove?: boolean;
    }) => bulk({ data: { supplierId, ids: [...sel], ...input } }),
    onSuccess: (r) => {
      toast.success(`${r.updated} ürün güncellendi; aktaran mağazalar da güncellendi`);
      setSel(new Set());
      refresh();
    },
    onError: err,
  });
  const items = q.data?.items ?? [];
  const pages = q.data ? Math.ceil(q.data.total / q.data.pageSize) : 0;
  const toggle = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-medium">Ürün yönetimi</div>
        <Button size="sm" className="rounded-full" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Ürün ekle
        </Button>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(search);
          setPage(0);
        }}
      >
        <Input
          className="min-w-0 flex-1"
          placeholder="Ad, stok kodu veya barkod"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value as typeof filter);
            setPage(0);
          }}
        >
          <option value="all">Tümü</option>
          <option value="visible">Katalogda görünen</option>
          <option value="hidden">Gizli</option>
          <option value="out">Stoksuz</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          Ara
        </Button>
      </form>
      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-3 text-sm">
          <span className="font-medium">{sel.size} seçili</span>
          <Input
            className="w-24"
            type="number"
            placeholder="Fiyat %"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={percent === ""}
            onClick={() => b.mutate({ pricePercent: Number(percent) || 0 })}
          >
            Fiyatı % değiştir
          </Button>
          <Input
            className="w-24"
            type="number"
            min={0}
            placeholder="Stok"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={stock === ""}
            onClick={() => b.mutate({ setStock: Math.max(0, Math.round(Number(stock) || 0)) })}
          >
            Stoğu ayarla
          </Button>
          <Button size="sm" variant="outline" onClick={() => b.mutate({ setStock: 0 })}>
            Stoğu sıfırla
          </Button>
          <Button size="sm" variant="outline" onClick={() => b.mutate({ visible: true })}>
            Katalogda göster
          </Button>
          <Button size="sm" variant="outline" onClick={() => b.mutate({ visible: false })}>
            Katalogdan gizle
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => confirm("Seçili ürünler silinsin mi?") && b.mutate({ remove: true })}
          >
            <Trash2 className="size-4" /> Sil
          </Button>
        </div>
      )}
      <div className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={items.length > 0 && items.every((i) => sel.has(i.id))}
          onChange={(e) => setSel(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())}
        />
        <span>Sayfadakileri seç · {q.data?.total ?? 0} ürün</span>
      </div>
      {q.isLoading && <Loader2 className="mx-auto size-6 animate-spin" />}
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 rounded-xl border border-border p-2">
            <input
              type="checkbox"
              checked={sel.has(it.id)}
              onChange={() => toggle(it.id)}
              aria-label="Seç"
            />
            {it.images[0] ? (
              <SmartImage
                src={it.images[0]}
                fallbackSrcs={it.images.slice(1)}
                alt={it.title}
                width={112}
                className="size-14 rounded-lg object-cover"
              />
            ) : (
              <div className="size-14 rounded-lg bg-muted" />
            )}
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => setEditing(it)}
            >
              <div className="line-clamp-1 text-sm font-medium">{it.title}</div>
              <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>{it.sku}</span>
                <span>Alış {formatMoney(it.purchasePrice, it.currency)}</span>
                {it.salePrice != null && (
                  <span>Satış {formatMoney(it.salePrice, it.currency)}</span>
                )}
                {it.suggestedPrice != null && (
                  <span>Önerilen {formatMoney(it.suggestedPrice, it.currency)}</span>
                )}
                <span className={it.stock > 0 ? "text-success" : "text-destructive"}>
                  {it.stock} stok
                </span>
                {!it.visible && <span className="text-destructive">Gizli</span>}
              </div>
            </button>
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Önceki
          </Button>
          <span>
            {page + 1} / {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Sonraki
          </Button>
        </div>
      )}
      <ProductEditor
        supplierId={supplierId}
        item={editing}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  );
}

type VariantRow = { size: string; color: string; barcode: string; stock: string; price: string };

export function ProductEditor({
  supplierId,
  item,
  onClose,
  onSaved,
}: {
  supplierId: string;
  item: Item | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = item !== null;
  const existing = item && item !== "new" ? item : null;
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="h-[100dvh] w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="sticky top-0 z-20 flex-row items-center justify-between bg-background py-2 pr-8">
          <SheetTitle>{existing ? "Ürünü düzenle" : "Yeni ürün"}</SheetTitle>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>Kapat</Button>
        </SheetHeader>
        {open && (
          <EditorForm
            key={existing?.id ?? "new"}
            supplierId={supplierId}
            existing={existing}
            onDone={() => {
              onSaved();
              onClose();
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function EditorForm({
  supplierId,
  existing,
  onDone,
}: {
  supplierId: string;
  existing: Item | null;
  onDone: () => void;
}) {
  const formId = useId();
  const getDetail = useServerFn(studioGetProduct);
  const save = useServerFn(studioSaveProduct);
  const [f, setF] = useState({
    title: existing?.title ?? "",
    sku: existing?.sku ?? "",
    barcode: existing?.barcode ?? "",
    brand: existing?.brand ?? "",
    category: existing?.category ?? "",
    purchasePrice: existing ? String(existing.purchasePrice) : "",
    salePrice: existing?.salePrice != null ? String(existing.salePrice) : "",
    suggestedPrice: existing?.suggestedPrice != null ? String(existing.suggestedPrice) : "",
    taxRate: "20",
    stock: existing ? String(existing.stock) : "0",
    images: (existing?.images ?? []).join("\n"),
    description: "",
    visible: existing?.visible ?? true,
  });
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const detail = useQuery({
    queryKey: ["studio-product", supplierId, existing?.id],
    enabled: !!existing,
    queryFn: async () => {
      const d = await getDetail({ data: { supplierId, id: existing!.id } });
      setF((x) => ({
        ...x,
        description: d.description,
        taxRate: d.taxRate != null ? String(d.taxRate) : x.taxRate,
      }));
      const named = d.variants.filter((v) => v.size || v.color);
      setVariants(
        named.map((v) => ({
          size: v.size,
          color: v.color,
          barcode: v.barcode,
          stock: String(v.stock),
          price: v.price != null ? String(v.price) : "",
        })),
      );
      return d;
    },
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((x) => ({ ...x, [k]: e.target.value }));
  const optNum = (v: string) => (v.trim() === "" ? null : Math.max(0, Number(v) || 0));
  const m = useMutation({
    mutationFn: () =>
      save({
        data: {
          supplierId,
          id: existing?.id ?? null,
          title: f.title,
          sku: f.sku,
          barcode: f.barcode,
          brand: f.brand,
          category: f.category,
          purchasePrice: Math.max(0, Number(f.purchasePrice) || 0),
          salePrice: optNum(f.salePrice),
          suggestedPrice: optNum(f.suggestedPrice),
          taxRate: optNum(f.taxRate),
          stock: Math.max(0, Math.round(Number(f.stock) || 0)),
          images: f.images.split(/[\s,]+/).filter((u) => /^https?:\/\//.test(u)),
          description: f.description,
          visible: f.visible,
          variants: variants.map((v) => ({
            size: v.size,
            color: v.color,
            barcode: v.barcode,
            stock: Math.max(0, Math.round(Number(v.stock) || 0)),
            price: optNum(v.price),
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Ürün kaydedildi");
      onDone();
    },
    onError: err,
  });
  if (existing && detail.isLoading) return <Loader2 className="mx-auto mt-6 size-6 animate-spin" />;
  if (existing && detail.isError)
    return (
      <div role="alert" className="space-y-3 p-4">
        <p>{detail.error.message}</p>
        <Button onClick={() => void detail.refetch()}>Tekrar dene</Button>
      </div>
    );
  const field = (label: string, k: keyof typeof f, type = "text") => (
    <div className="space-y-1">
      <Label htmlFor={`${formId}-${k}`}>{label}</Label>
      <Input
        id={`${formId}-${k}`}
        type={type}
        value={f[k] as string}
        onChange={set(k)}
        required={k === "title"}
        aria-describedby={m.isError ? `${formId}-error` : undefined}
      />
    </div>
  );
  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
    >
      {field("Ürün adı", "title")}
      <div className="grid grid-cols-2 gap-2">
        {field("Stok kodu", "sku")}
        {field("Barkod", "barcode")}
        {field("Marka", "brand")}
        {field("Kategori", "category")}
        {field("Alış (bayi) fiyatı", "purchasePrice", "number")}
        {field("Satış fiyatı", "salePrice", "number")}
        {field("Önerilen satış fiyatı", "suggestedPrice", "number")}
        {field("KDV %", "taxRate", "number")}
        {variants.length === 0 && field("Stok", "stock", "number")}
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${formId}-images`}>Görsel adresleri (her satıra bir)</Label>
        <Textarea
          id={`${formId}-images`}
          rows={3}
          value={f.images}
          onChange={set("images")}
          aria-describedby={m.isError ? `${formId}-error` : undefined}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${formId}-description`}>Açıklama</Label>
        <Textarea
          id={`${formId}-description`}
          rows={6}
          value={f.description}
          onChange={set("description")}
          aria-describedby={m.isError ? `${formId}-error` : undefined}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Varyantlar (beden / renk)</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setVariants((v) => [
                ...v,
                { size: "", color: "", barcode: "", stock: "0", price: "" },
              ])
            }
          >
            <Plus className="size-4" /> Varyant
          </Button>
        </div>
        {variants.map((v, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_1fr_70px_80px_auto] sm:border-0 sm:p-0">
            {(["size", "color", "barcode", "stock", "price"] as const).map((k) => (
              <div key={k}>
                <Label className="text-[10px]" htmlFor={`${formId}-variant-${i}-${k}`}>
                  {
                    {
                      size: "Beden",
                      color: "Renk",
                      barcode: "Barkod",
                      stock: "Stok",
                      price: "Fiyat",
                    }[k]
                  }
                </Label>
                <Input
                  id={`${formId}-variant-${i}-${k}`}
                  placeholder={
                    {
                      size: "Beden",
                      color: "Renk",
                      barcode: "Barkod",
                      stock: "Stok",
                      price: "Fiyat",
                    }[k]
                  }
                  type={k === "stock" || k === "price" ? "number" : "text"}
                  value={v[k]}
                  onChange={(e) =>
                    setVariants((all) =>
                      all.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)),
                    )
                  }
                  aria-describedby={m.isError ? `${formId}-error` : undefined}
                />
              </div>
            ))}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Sil"
              onClick={() => setVariants((all) => all.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={f.visible} onCheckedChange={(v) => setF((x) => ({ ...x, visible: v }))} />{" "}
        Satıcı kataloğunda göster
      </label>
      {m.isError ? (
        <p id={`${formId}-error`} role="alert" className="text-sm text-destructive">
          {m.error instanceof Error
            ? m.error.message
            : "Ürün kaydedilemedi. Alanları kontrol edin."}
        </p>
      ) : null}
      <Button type="submit" className="sticky bottom-0 z-10 w-full rounded-full shadow-lg" disabled={m.isPending}>
        {m.isPending && <Loader2 className="size-4 animate-spin" />} Kaydet
      </Button>
    </form>
  );
}
