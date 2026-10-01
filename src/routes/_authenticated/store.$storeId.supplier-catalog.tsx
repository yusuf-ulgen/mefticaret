import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronRight, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutoImportTab, CategoryMapTab, ImportedTab } from "@/components/supplier-catalog/seller-tabs";
import {
  getCatalogProduct,
  importCatalogProducts,
  listCatalogFacets,
  listCatalogProducts,
  listCatalogSuppliers,
} from "@/lib/supplier-catalog.functions";
import { formatMoney } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/supplier-catalog")({
  head: () => ({
    meta: [
      { title: "Tedarikçi Ürünleri — Mefticaret" },
      { name: "description", content: "Tedarikçilerin ürünlerini seçip tek tıkla mağazanıza aktarın." },
      { property: "og:title", content: "Tedarikçi Ürünleri — Mefticaret" },
      { property: "og:description", content: "Tedarikçi kataloğundan tekli veya toplu ürün aktarımı." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupplierCatalogPage,
});

function SupplierCatalogPage() {
  const { storeId } = Route.useParams();
  const qc = useQueryClient();
  const listSuppliers = useServerFn(listCatalogSuppliers);
  const listProducts = useServerFn(listCatalogProducts);
  const runImport = useServerFn(importCatalogProducts);

  const [supplierId, setSupplierId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [markup, setMarkup] = useState("0");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [tab, setTab] = useState("catalog");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStock, setInStock] = useState(false);
  const [notImported, setNotImported] = useState(false);
  const [sort, setSort] = useState<"title" | "price_asc" | "price_desc" | "newest" | "stock">("title");
  const listFacets = useServerFn(listCatalogFacets);
  const facets = useQuery({ queryKey: ["catalog-facets", storeId, supplierId], enabled: !!supplierId, queryFn: () => listFacets({ data: { storeId, supplierId } }) });
  const filters = {
    category,
    brand,
    minPrice: minPrice === "" ? null : Math.max(0, Number(minPrice) || 0),
    maxPrice: maxPrice === "" ? null : Math.max(0, Number(maxPrice) || 0),
    inStock,
    notImported,
    sort,
  };

  const suppliers = useQuery({ queryKey: ["catalog-suppliers", storeId], queryFn: () => listSuppliers({ data: { storeId } }) });
  useEffect(() => {
    if (!supplierId && suppliers.data?.[0]) setSupplierId(suppliers.data[0].id);
  }, [suppliers.data, supplierId]);

  const products = useQuery({
    queryKey: ["catalog-products", storeId, supplierId, term, page, filters],
    enabled: !!supplierId,
    queryFn: () => listProducts({ data: { storeId, supplierId, search: term, page, ...filters } }),
  });

  const importMut = useMutation({
    mutationFn: (ids: string[]) => runImport({ data: { storeId, ids, markup: Math.max(0, Number(markup) || 0) } }),
    onSuccess: (res) => {
      toast.success(`${res.imported} ürün mağazanıza aktarıldı${res.skipped ? `, ${res.skipped} zaten vardı` : ""}`);
      if (res.failed.length) toast.error(`${res.failed.length} ürün aktarılamadı: ${res.failed[0]}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["catalog-products", storeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Aktarım başarısız"),
  });

  const items = products.data?.items ?? [];
  const selectable = items.filter((i) => !i.productId);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const totalPages = products.data ? Math.ceil(products.data.total / products.data.pageSize) : 0;

  return (
    <AppShell storeId={storeId} title="Tedarikçi Ürünleri" description="Bir tedarikçi seçin, ürünlerini tek tek veya toplu olarak mağazanıza aktarın.">
      <div className="space-y-4 pb-28">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {suppliers.isLoading && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
          {suppliers.data?.length === 0 && <p className="text-sm text-muted-foreground">Henüz ürün yükleyen tedarikçi yok.</p>}
          {suppliers.data?.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSupplierId(s.id);
                setPage(0);
                setSelected(new Set());
                setCategory("");
                setBrand("");
              }}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm ${s.id === supplierId ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground"}`}
            >
              {s.name} <span className="opacity-70">({s.count})</span>
            </button>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex w-full overflow-x-auto">
            <TabsTrigger value="catalog">Katalog</TabsTrigger>
            <TabsTrigger value="imported">Aktarılanlar</TabsTrigger>
            <TabsTrigger value="categories">Kategori eşleştirme</TabsTrigger>
            <TabsTrigger value="auto">Otomatik aktarım</TabsTrigger>
          </TabsList>
          <TabsContent value="imported" className="mt-4"><ImportedTab storeId={storeId} /></TabsContent>
          <TabsContent value="categories" className="mt-4"><CategoryMapTab storeId={storeId} supplierId={supplierId} /></TabsContent>
          <TabsContent value="auto" className="mt-4">
            <AutoImportTab storeId={storeId} supplierId={supplierId} supplierName={suppliers.data?.find((x) => x.id === supplierId)?.name ?? ""} />
          </TabsContent>
          <TabsContent value="catalog" className="mt-4 space-y-4">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setTerm(search);
            setPage(0);
          }}
        >
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ürün adı veya stok kodu" className="pl-9" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Kâr oranı %
            <Input type="number" min={0} max={1000} value={markup} onChange={(e) => setMarkup(e.target.value)} className="w-20" />
          </label>
        </form>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }}>
            <option value="">Tüm kategoriler</option>
            {facets.data?.categories.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={brand} onChange={(e) => { setBrand(e.target.value); setPage(0); }}>
            <option value="">Tüm markalar</option>
            {facets.data?.brands.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
          </select>
          <Input type="number" min={0} placeholder="Min alış ₺" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(0); }} />
          <Input type="number" min={0} placeholder="Maks alış ₺" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(0); }} />
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={sort} onChange={(e) => { setSort(e.target.value as typeof sort); setPage(0); }}>
            <option value="title">Ada göre</option>
            <option value="newest">Yeni gelenler</option>
            <option value="price_asc">Fiyat artan</option>
            <option value="price_desc">Fiyat azalan</option>
            <option value="stock">Stok çok olan</option>
          </select>
          <label className="flex items-center gap-2 text-sm"><Switch checked={inStock} onCheckedChange={(v) => { setInStock(v); setPage(0); }} /> Stokta olanlar</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={notImported} onCheckedChange={(v) => { setNotImported(v); setPage(0); }} /> Aktarılmamışlar</label>
          <span className="self-center text-sm text-muted-foreground">{products.data?.total ?? 0} ürün</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Kâr oranı 0 ise tedarikçinin satış fiyatı kullanılır. Aktarılan ürünler hemen yayına alınır; stok ve fiyat tedarikçi güncelledikçe otomatik eşitlenir.
        </p>

        {products.isLoading && <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />}
        {products.error && <p className="text-sm text-destructive">{(products.error as Error).message}</p>}

        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const isSel = selected.has(item.id);
            return (
              <div key={item.id} className="flex overflow-hidden rounded-2xl border border-border bg-card">
                <div className="relative w-32 shrink-0 bg-muted sm:w-36">
                  {item.image ? (
                    <img src={item.image} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : null}
                  {!item.productId && (
                    <button
                      type="button"
                      aria-label={isSel ? "Seçimi kaldır" : "Seç"}
                      onClick={() => toggle(item.id)}
                      className={`absolute left-2 top-2 flex size-9 items-center justify-center rounded-full border-2 shadow ${isSel ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
                    >
                      {isSel ? <Check className="size-4" /> : <span className="size-3 rounded-full border border-muted-foreground/40" />}
                    </button>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
                  <button type="button" onClick={() => setDetailId(item.id)} className="flex items-start gap-2 text-left">
                    <span className="line-clamp-2 flex-1 text-sm font-medium text-foreground">{item.title}</span>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                  </button>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-lg font-semibold text-foreground">{formatMoney(item.price, item.currency)}</span>
                    {item.marginPercent != null && item.marginPercent > 0 && <span className="text-xs text-success">%{item.marginPercent} kâr</span>}
                    {item.isNew && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] uppercase text-accent-foreground">Yeni</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">Alış {formatMoney(item.purchasePrice, item.currency)}{item.brand ? ` · ${item.brand}` : ""}</div>
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className="text-sm text-success">{item.stock} stok</span>
                    {item.productId ? (
                      <Link
                        to="/store/$storeId/products/$productId"
                        params={{ storeId, productId: item.productId }}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                      >
                        Mağazada
                      </Link>
                    ) : (
                      <Button size="sm" className="rounded-full" disabled={importMut.isPending} onClick={() => importMut.mutate([item.id])}>
                        Mağazaya aktar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              Önceki
            </Button>
            <span>
              {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Sonraki
            </Button>
          </div>
        )}
          </TabsContent>
        </Tabs>
      </div>

      {tab === "catalog" && items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSelected((s) => (s.size === selectable.length ? new Set() : new Set(selectable.map((i) => i.id))))
              }
            >
              {selected.size === selectable.length && selectable.length > 0 ? "Seçimi temizle" : "Tümünü seç"}
            </Button>
            <Button
              className="flex-1 rounded-full"
              disabled={!selected.size || importMut.isPending}
              onClick={() => importMut.mutate([...selected])}
            >
              {importMut.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Seçilenleri aktar ({selected.size})
            </Button>
          </div>
        </div>
      )}

      <ProductSheet storeId={storeId} id={detailId} onClose={() => setDetailId(null)} onImport={(id) => importMut.mutate([id])} busy={importMut.isPending} />
    </AppShell>
  );
}

function ProductSheet({
  storeId,
  id,
  onClose,
  onImport,
  busy,
}: {
  storeId: string;
  id: string | null;
  onClose: () => void;
  onImport: (id: string) => void;
  busy: boolean;
}) {
  const getProduct = useServerFn(getCatalogProduct);
  const q = useQuery({ queryKey: ["catalog-product", storeId, id], enabled: !!id, queryFn: () => getProduct({ data: { storeId, id: id! } }) });
  const p = q.data;
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{p?.title ?? "Ürün"}</SheetTitle>
        </SheetHeader>
        {q.isLoading && <Loader2 className="mx-auto mt-6 size-6 animate-spin" />}
        {p && (
          <div className="mt-4 space-y-4 text-sm">
            <div className="flex gap-2 overflow-x-auto">
              {p.images.map((src) => (
                <img key={src} src={src} alt={p.title} loading="lazy" className="h-40 w-32 shrink-0 rounded-lg object-cover" />
              ))}
            </div>
            <dl className="grid grid-cols-2 gap-2">
              <dt className="text-muted-foreground">Tedarikçi</dt><dd>{p.supplierName}</dd>
              <dt className="text-muted-foreground">Satış fiyatı</dt><dd>{formatMoney(p.price, p.currency)}</dd>
              <dt className="text-muted-foreground">Alış fiyatı</dt><dd>{formatMoney(p.purchasePrice, p.currency)}</dd>
              <dt className="text-muted-foreground">KDV</dt><dd>{p.taxRate != null ? `%${p.taxRate}` : "—"}</dd>
              <dt className="text-muted-foreground">Stok</dt><dd>{p.stock}</dd>
              <dt className="text-muted-foreground">Marka</dt><dd>{p.brand ?? "—"}</dd>
              <dt className="text-muted-foreground">Kategori</dt><dd>{p.category ?? "—"}</dd>
              <dt className="text-muted-foreground">Stok kodu</dt><dd>{p.sku ?? "—"}</dd>
            </dl>
            {p.variants.length > 0 && (
              <div>
                <h3 className="mb-2 font-medium">Varyantlar ({p.variants.length})</h3>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {p.variants.map((v, i) => (
                    <li key={i} className="flex justify-between gap-2 p-2">
                      <span>{v.options || v.barcode || `Varyant ${i + 1}`}</span>
                      <span className="text-muted-foreground">{v.stock} stok</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {p.description && (
              <div>
                <h3 className="mb-2 font-medium">Açıklama</h3>
                <p className="whitespace-pre-line text-muted-foreground">{p.description.replace(/<[^>]+>/g, "\n").replace(/\n{2,}/g, "\n").trim()}</p>
              </div>
            )}
            {p.productId ? (
              <p className="text-success">Bu ürün mağazanızda.</p>
            ) : (
              <Button className="w-full rounded-full" disabled={busy} onClick={() => onImport(p.id)}>
                Mağazaya aktar
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
