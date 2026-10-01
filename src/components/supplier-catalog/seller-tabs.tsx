import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getAutoImport,
  getCategoryMaps,
  listStoreImports,
  removeStoreImports,
  saveAutoImport,
  saveCategoryMaps,
  updateStoreImports,
} from "@/lib/supplier-catalog.functions";
import { formatMoney } from "@/lib/mefti";

const err = (e: unknown) => toast.error(e instanceof Error ? e.message : "İşlem başarısız");

/* ----------------------------- Aktarılanlar ----------------------------- */

export function ImportedTab({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listStoreImports);
  const update = useServerFn(updateStoreImports);
  const remove = useServerFn(removeStoreImports);
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkMarkup, setBulkMarkup] = useState("");
  const q = useQuery({ queryKey: ["store-imports", storeId, page], queryFn: () => list({ data: { storeId, page, supplierId: null } }) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["store-imports", storeId] });
  const upd = useMutation({
    mutationFn: (input: { ids: string[]; markup?: number; syncEnabled?: boolean; status?: "active" | "draft" | "archived" }) => update({ data: { storeId, ...input } }),
    onSuccess: (r) => {
      toast.success(`${r.updated} ürün güncellendi`);
      refresh();
    },
    onError: err,
  });
  const rem = useMutation({
    mutationFn: (input: { ids: string[]; deleteProducts: boolean }) => remove({ data: { storeId, ...input } }),
    onSuccess: (r) => {
      toast.success(`${r.removed} bağlantı kaldırıldı`);
      setSel(new Set());
      refresh();
      qc.invalidateQueries({ queryKey: ["catalog-products", storeId] });
    },
    onError: err,
  });
  const items = q.data?.items ?? [];
  const ids = [...sel];
  const pages = q.data ? Math.ceil(q.data.total / q.data.pageSize) : 0;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Toplam {q.data?.total ?? 0} aktarılmış ürün.</p>
      {sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted p-3 text-sm">
          <span className="font-medium">{sel.size} seçili</span>
          <Input className="w-24" type="number" min={0} placeholder="Kâr %" value={bulkMarkup} onChange={(e) => setBulkMarkup(e.target.value)} />
          <Button size="sm" variant="outline" disabled={bulkMarkup === ""} onClick={() => upd.mutate({ ids, markup: Math.max(0, Number(bulkMarkup) || 0) })}>Kâr oranını uygula</Button>
          <Button size="sm" variant="outline" onClick={() => upd.mutate({ ids, syncEnabled: false })}>Eşitlemeyi durdur</Button>
          <Button size="sm" variant="outline" onClick={() => upd.mutate({ ids, syncEnabled: true })}>Eşitlemeyi aç</Button>
          <Button size="sm" variant="outline" onClick={() => upd.mutate({ ids, status: "draft" })}>Taslağa al</Button>
          <Button size="sm" variant="outline" onClick={() => upd.mutate({ ids, status: "active" })}>Yayına al</Button>
          <Button size="sm" variant="outline" onClick={() => rem.mutate({ ids, deleteProducts: false })}>Bağlantıyı kaldır</Button>
          <Button size="sm" variant="destructive" onClick={() => confirm("Ürünler mağazada arşivlenecek. Emin misiniz?") && rem.mutate({ ids, deleteProducts: true })}>Kaldır + arşivle</Button>
        </div>
      )}
      {q.isLoading && <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />}
      <div className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={items.length > 0 && items.every((i) => sel.has(i.id))} onChange={(e) => setSel(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())} />
        <span>Sayfadakileri seç</span>
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2">
            <input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} aria-label="Seç" />
            {it.image ? <img src={it.image} alt="" loading="lazy" className="size-14 rounded-lg object-cover" /> : <div className="size-14 rounded-lg bg-muted" />}
            <div className="min-w-0 flex-1">
              <Link to="/store/$storeId/products/$productId" params={{ storeId, productId: it.productId }} className="line-clamp-1 text-sm font-medium text-foreground">{it.title}</Link>
              <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                <span>{it.supplierName}</span>
                <span>Alış {formatMoney(it.purchasePrice, it.currency)}</span>
                <span className="text-foreground">Satış {formatMoney(it.salePrice, it.currency)}</span>
                <span className="text-success">{it.supplierStock} stok</span>
                <span>Kâr %{it.markup}</span>
                <span>{it.status === "active" ? "Yayında" : it.status === "draft" ? "Taslak" : "Arşiv"}</span>
              </div>
            </div>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Eşitle
              <Switch checked={it.syncEnabled} onCheckedChange={(v) => upd.mutate({ ids: [it.id], syncEnabled: v })} />
            </label>
          </div>
        ))}
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Önceki</Button>
          <span>{page + 1} / {pages}</span>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Sonraki</Button>
        </div>
      )}
    </div>
  );
}

/* -------------------------- Kategori eşleştirme -------------------------- */

export function CategoryMapTab({ storeId, supplierId }: { storeId: string; supplierId: string }) {
  const get = useServerFn(getCategoryMaps);
  const save = useServerFn(saveCategoryMaps);
  const q = useQuery({ queryKey: ["cat-maps", storeId, supplierId], enabled: !!supplierId, queryFn: () => get({ data: { storeId, supplierId } }) });
  const [rows, setRows] = useState<{ source: string; count: number; categoryId: string | null; markup: string }[]>([]);
  useEffect(() => {
    if (q.data) setRows(q.data.rows.map((r) => ({ ...r, markup: r.markup == null ? "" : String(r.markup) })));
  }, [q.data]);
  const m = useMutation({
    mutationFn: () => save({ data: { storeId, supplierId, rows: rows.map((r) => ({ source: r.source, categoryId: r.categoryId, markup: r.markup === "" ? null : Math.max(0, Number(r.markup) || 0) })) } }),
    onSuccess: (r) => toast.success(`${r.saved} kategori eşleşmesi kaydedildi`),
    onError: err,
  });
  if (!supplierId) return <p className="text-sm text-muted-foreground">Önce bir tedarikçi seçin.</p>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Tedarikçi kategorisini kendi kategorinize eşleyin ve kategoriye özel kâr oranı verin. Boş bırakırsanız aynı adla yeni kategori açılır; kâr oranı boşsa genel oran kullanılır.</p>
      {q.isLoading && <Loader2 className="mx-auto size-6 animate-spin" />}
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.source} className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_1fr_100px] sm:items-center">
            <div className="text-sm"><span className="font-medium">{r.source}</span> <span className="text-muted-foreground">({r.count})</span></div>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={r.categoryId ?? ""}
              onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, categoryId: e.target.value || null } : x)))}
            >
              <option value="">Aynı adla oluştur</option>
              {q.data?.storeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <Input type="number" min={0} placeholder="Kâr %" value={r.markup} onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, markup: e.target.value } : x)))} />
          </div>
        ))}
      </div>
      {rows.length > 0 && (
        <Button className="rounded-full" disabled={m.isPending} onClick={() => m.mutate()}>
          {m.isPending && <Loader2 className="size-4 animate-spin" />} Eşleşmeleri kaydet
        </Button>
      )}
    </div>
  );
}

/* --------------------------- Otomatik aktarım --------------------------- */

export function AutoImportTab({ storeId, supplierId, supplierName }: { storeId: string; supplierId: string; supplierName: string }) {
  const qc = useQueryClient();
  const get = useServerFn(getAutoImport);
  const save = useServerFn(saveAutoImport);
  const q = useQuery({ queryKey: ["auto-import", storeId, supplierId], enabled: !!supplierId, queryFn: () => get({ data: { storeId, supplierId } }) });
  const [enabled, setEnabled] = useState(false);
  const [markup, setMarkup] = useState("0");
  useEffect(() => {
    if (q.data) {
      setEnabled(q.data.enabled);
      setMarkup(String(q.data.markup));
    }
  }, [q.data]);
  const m = useMutation({
    mutationFn: (runNow: boolean) => save({ data: { storeId, supplierId, enabled, markup: Math.max(0, Number(markup) || 0), runNow } }),
    onSuccess: (r) => {
      toast.success(r.imported ? `${r.imported} ürün aktarıldı${r.remaining ? `, ${r.remaining} kaldı — tekrar çalıştırın` : ""}` : "Kaydedildi");
      qc.invalidateQueries({ queryKey: ["auto-import", storeId, supplierId] });
      qc.invalidateQueries({ queryKey: ["catalog-products", storeId] });
    },
    onError: err,
  });
  if (!supplierId) return <p className="text-sm text-muted-foreground">Önce bir tedarikçi seçin.</p>;
  const last = q.data?.lastResult;
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-medium">{supplierName} — tüm ürünleri otomatik aktar</div>
          <p className="text-sm text-muted-foreground">Açıkken tedarikçinin tüm ürünleri ve sonradan eklediği yeni ürünler mağazanıza kendiliğinden eklenir.</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        Kâr oranı %
        <Input className="w-24" type="number" min={0} value={markup} onChange={(e) => setMarkup(e.target.value)} />
        <span className="text-xs text-muted-foreground">(0 = tedarikçi satış fiyatı veya kategori oranı)</span>
      </label>
      {q.data?.lastRunAt && (
        <p className="text-xs text-muted-foreground">
          Son çalışma: {new Date(q.data.lastRunAt).toLocaleString("tr-TR")}
          {last ? ` — ${last.imported} eklendi, ${last.failed} hata, ${last.remaining} sırada` : ""}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="rounded-full" disabled={m.isPending} onClick={() => m.mutate(false)}>Kaydet</Button>
        <Button className="rounded-full" disabled={m.isPending || !enabled} onClick={() => m.mutate(true)}>
          {m.isPending && <Loader2 className="size-4 animate-spin" />} Kaydet ve şimdi aktar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Her çalıştırmada en çok 200 ürün eklenir; kalanlar tedarikçinin sonraki eşitlemesinde veya yeniden çalıştırınca eklenir.</p>
    </div>
  );
}
