import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownUp, Copy, Package, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { V2ErrorState } from "@/components/v2/feature-gate";
import { PRODUCT_STATUS_LABELS } from "@/lib/commerce-v2";
import { v2BulkProducts, v2DuplicateProduct, v2ListCollections, v2ListProducts } from "@/lib/commerce-v2.functions";
import { signMediaPaths } from "@/lib/media";
import { formatMoney } from "@/lib/mefti";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/catalog-v2/")({
  head: () => ({
    meta: [
      { title: "Ürünler v2 — Mefticaret" },
      { name: "description", content: "Ürünleri durum, tür, marka ve etikete göre filtrele; toplu yayınla, arşivle veya koleksiyona ekle." },
      { property: "og:title", content: "Ürünler v2 — Mefticaret" },
      { property: "og:description", content: "Shopify benzeri ürün listesi: anlık arama, sıralama ve toplu işlemler." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductListV2,
});

const ALL = "__all";
const STATUS_TONE: Record<string, string> = {
  active: "bg-success/15 text-success",
  draft: "bg-muted text-muted-foreground",
  archived: "bg-destructive/10 text-destructive",
};

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

function ProductListV2() {
  const { storeId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const listFn = useServerFn(v2ListProducts);
  const bulkFn = useServerFn(v2BulkProducts);
  const dupFn = useServerFn(v2DuplicateProduct);
  const colFn = useServerFn(v2ListCollections);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [vendor, setVendor] = useState(ALL);
  const [tag, setTag] = useState(ALL);
  const [sort, setSort] = useState("created_at:desc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const dq = useDebounced(q);
  const limit = 50;

  const filters = useMemo(() => {
    const [s, dir] = sort.split(":");
    return {
      q: dq || undefined,
      status: status === ALL ? undefined : status,
      product_type: type === ALL ? undefined : type,
      vendor: vendor === ALL ? undefined : vendor,
      tag: tag === ALL ? undefined : tag,
      sort: s, dir, limit, offset: page * limit,
    };
  }, [dq, status, type, vendor, tag, sort, page]);

  useEffect(() => { setPage(0); setSelected(new Set()); }, [dq, status, type, vendor, tag, sort]);

  const list = useQuery({
    queryKey: ["v2-products", storeId, filters],
    queryFn: () => listFn({ data: { storeId, filters } }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const collections = useQuery({
    queryKey: ["v2-collections-pick", storeId],
    queryFn: () => colFn({ data: { storeId, module: "products" } }),
    enabled: list.isSuccess,
  });

  const rows = list.data?.data ?? [];
  const paths = rows.map((r) => [...(r.product_images ?? [])].sort((a: any, b: any) => a.position - b.position)[0]?.storage_path).filter(Boolean) as string[];
  const thumbs = useQuery({
    queryKey: ["v2-thumbs", paths.join(",")],
    queryFn: () => signMediaPaths(paths),
    enabled: paths.length > 0,
    staleTime: 30 * 60_000,
  });

  const bulk = useMutation({
    mutationFn: (v: { action: "publish" | "archive" | "delete" | "add_to_collection"; collectionId?: string }) =>
      bulkFn({ data: { storeId, ids: [...selected], ...v } }),
    onSuccess: (r, v) => {
      toast.success(`${r.count} ürün güncellendi${v.action === "delete" ? " (silindi)" : ""}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["v2-products", storeId] });
      qc.invalidateQueries({ queryKey: ["products", storeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "İşlem başarısız"),
  });

  const dup = useMutation({
    mutationFn: (productId: string) => dupFn({ data: { storeId, productId } }),
    onSuccess: (r) => {
      toast.success("Ürün kopyalandı (taslak)");
      navigate({ to: "/store/$storeId/catalog-v2/$productId", params: { storeId, productId: r.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kopyalanamadı"),
  });

  const facets = list.data?.facets;
  const total = list.data?.meta.total ?? 0;
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  return (
    <AppShell
      storeId={storeId}
      title="Ürünler"
      description="Ürünlerini ara, filtrele ve toplu yönet."
      actions={
        <Button asChild className="rounded-full">
          <Link to="/store/$storeId/catalog-v2/$productId" params={{ storeId, productId: "new" }}>
            <Plus className="size-4" /> Ürün ekle
          </Link>
        </Button>
      }
    >
      {list.isError ? <V2ErrorState error={list.error} /> : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Başlık veya SKU ara" className="h-11 pl-9" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <FilterSelect value={status} onChange={setStatus} label="Durum" options={Object.entries(PRODUCT_STATUS_LABELS).map(([v, l]) => [v, l])} />
            <FilterSelect value={type} onChange={setType} label="Tür" options={(facets?.types ?? []).map((x) => [x, x])} />
            <FilterSelect value={vendor} onChange={setVendor} label="Marka" options={(facets?.vendors ?? []).map((x) => [x, x])} />
            <FilterSelect value={tag} onChange={setTag} label="Etiket" options={(facets?.tags ?? []).map((x) => [x, x])} />
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="h-11 col-span-2 sm:col-span-1"><ArrowDownUp className="size-4" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at:desc">En yeni</SelectItem>
                <SelectItem value="created_at:asc">En eski</SelectItem>
                <SelectItem value="title:asc">İsim A→Z</SelectItem>
                <SelectItem value="title:desc">İsim Z→A</SelectItem>
                <SelectItem value="price:asc">Fiyat artan</SelectItem>
                <SelectItem value="price:desc">Fiyat azalan</SelectItem>
                <SelectItem value="updated_at:desc">Son güncellenen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selected.size > 0 && (
            <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
              <span className="px-2 text-sm font-medium">{selected.size} seçili</span>
              <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => bulk.mutate({ action: "publish" })}>Yayınla</Button>
              <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => bulk.mutate({ action: "archive" })}>Arşivle</Button>
              <Select onValueChange={(cid) => bulk.mutate({ action: "add_to_collection", collectionId: cid })}>
                <SelectTrigger className="h-8 w-auto text-xs"><SelectValue placeholder="Koleksiyona ekle" /></SelectTrigger>
                <SelectContent>
                  {(collections.data ?? []).map((c) => <SelectItem key={c.id} value={c.id} disabled={c.collection_type === "smart"}>{c.title}{c.collection_type === "smart" ? " (akıllı)" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" variant="destructive" disabled={bulk.isPending} onClick={() => {
                if (window.confirm(`${selected.size} ürün kalıcı olarak silinsin mi?`)) bulk.mutate({ action: "delete" });
              }}>Sil</Button>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-3 py-2 text-xs text-muted-foreground">
              <Checkbox checked={allChecked} onCheckedChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Tümünü seç" />
              <span className="flex-1">Ürün</span>
              <span className="hidden w-24 text-right sm:block">Stok</span>
              <span className="hidden w-24 text-right sm:block">Fiyat</span>
              <span className="w-20 text-right">Durum</span>
              <span className="w-8" />
            </div>
            {list.isLoading && <div className="p-6 text-center text-sm text-muted-foreground">Yükleniyor…</div>}
            {!list.isLoading && rows.length === 0 && (
              <div className="p-10 text-center">
                <Package className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Ürün bulunamadı.</p>
              </div>
            )}
            {rows.map((r) => {
              const img = [...(r.product_images ?? [])].sort((a: any, b: any) => a.position - b.position)[0];
              const src = img?.storage_path ? thumbs.data?.[img.storage_path] : img?.url;
              return (
                <div key={r.id} className={cn("flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0", selected.has(r.id) && "bg-muted/50")}>
                  <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={`${r.title} seç`} />
                  <Link to="/store/$storeId/catalog-v2/$productId" params={{ storeId, productId: r.id }} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="size-11 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                      {src ? <img src={src} alt="" loading="lazy" className="size-full object-cover" /> : <Package className="m-auto mt-3 size-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        <span className={cn(r.inventory_total <= 0 && "text-destructive")}>{r.inventory_total} stok</span>
                        {r.variants_count > 1 ? ` · ${r.variants_count} varyant` : ""}
                        <span className="sm:hidden"> · {formatMoney(Number(r.base_price))}</span>
                        {r.vendor ? ` · ${r.vendor}` : ""}
                      </p>
                    </div>
                  </Link>
                  <span className={cn("hidden w-24 text-right text-sm tabular-nums sm:block", r.inventory_total <= 0 && "text-destructive")}>{r.inventory_total}</span>
                  <span className="hidden w-24 text-right text-sm tabular-nums sm:block">{formatMoney(Number(r.base_price))}</span>
                  <span className="w-20 text-right"><Badge className={cn("border-0", STATUS_TONE[r.status])}>{PRODUCT_STATUS_LABELS[r.status]}</Badge></span>
                  <button type="button" aria-label="Kopyala" title="Kopyala" onClick={() => dup.mutate(r.id)} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted">
                    <Copy className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} ürün</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Önceki</Button>
              <Button size="sm" variant="outline" disabled={(page + 1) * limit >= total} onClick={() => setPage((p) => p + 1)}>Sonraki</Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function FilterSelect({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: string[][] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11"><SelectValue placeholder={label} /></SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: Tümü</SelectItem>
        {options.map(([v, l]) => <SelectItem key={v} value={v!}>{l}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
