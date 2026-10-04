import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BigButton, SoftCard, inputClass } from "@/components/homemaker/kolay-parts";
import { formatMoney } from "@/lib/mefti";
import {
  getKolayImportQuota,
  importCatalogProducts,
  listCatalogProducts,
  listCatalogSuppliers,
} from "@/lib/supplier-catalog.functions";

/** Kolay Panel "Tedarikçi" sekmesi: tedarikçi ürünlerini kota dahilinde mağazaya aktarır. */
export function SupplierTab({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const listSuppliers = useServerFn(listCatalogSuppliers);
  const listProducts = useServerFn(listCatalogProducts);
  const runImport = useServerFn(importCatalogProducts);
  const fetchQuota = useServerFn(getKolayImportQuota);

  const [supplierId, setSupplierId] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const quota = useQuery({ queryKey: ["kolay-supplier-quota", storeId], queryFn: () => fetchQuota({ data: { storeId } }) });
  const suppliers = useQuery({ queryKey: ["catalog-suppliers", storeId], queryFn: () => listSuppliers({ data: { storeId } }) });
  useEffect(() => {
    if (!supplierId && suppliers.data?.[0]) setSupplierId(suppliers.data[0].id);
  }, [suppliers.data, supplierId]);

  const products = useQuery({
    queryKey: ["kolay-catalog-products", storeId, supplierId, term, page],
    enabled: !!supplierId,
    queryFn: () => listProducts({ data: { storeId, supplierId, search: term, page } }),
  });

  const left = quota.data ? Math.max(0, quota.data.limit - quota.data.used) : 0;

  const importMut = useMutation({
    mutationFn: (ids: string[]) => runImport({ data: { storeId, ids, markup: 0 } }),
    onSuccess: (res) => {
      if (res.imported) toast.success(`${res.imported} ürün mağazanıza eklendi`);
      if (res.failed.length) toast.error(res.failed[0]);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["kolay-catalog-products", storeId] });
      qc.invalidateQueries({ queryKey: ["kolay-supplier-quota", storeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Aktarım başarısız"),
  });

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size < left) n.add(id);
      else toast.error(`Kotanız en fazla ${left} ürün daha eklemenize izin veriyor`);
      return n;
    });

  const items = products.data?.items ?? [];
  const totalPages = products.data ? Math.ceil(products.data.total / products.data.pageSize) : 0;

  return (
    <div className="space-y-4 pb-24">
      <SoftCard>
        <h2 className="text-lg font-bold text-hm-ink">Tedarikçi Ürünleri</h2>
        <p className="mt-1 text-sm text-hm-ink-soft">Beğendiğiniz ürünü seçin, tek dokunuşla mağazanıza ekleyin.</p>
        {quota.data ? (
          <div className="mt-3">
            <div className="flex justify-between text-sm font-semibold text-hm-ink">
              <span>Ürün hakkınız</span>
              <span>
                {quota.data.used} / {quota.data.limit}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-hm-sand">
              <div
                className="h-full bg-hm-rose"
                style={{ width: `${quota.data.limit ? Math.min(100, (quota.data.used / quota.data.limit) * 100) : 100}%` }}
              />
            </div>
            {left === 0 ? <p className="mt-2 text-sm text-hm-ink-soft">Ürün hakkınız doldu. Daha fazlası için destekle iletişime geçin.</p> : null}
          </div>
        ) : null}
      </SoftCard>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {suppliers.isLoading ? <Loader2 className="size-5 animate-spin text-hm-ink-soft" /> : null}
        {suppliers.data?.length === 0 ? <p className="text-sm text-hm-ink-soft">Henüz ürün yükleyen tedarikçi yok.</p> : null}
        {suppliers.data?.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setSupplierId(s.id);
              setPage(0);
              setSelected(new Set());
            }}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
              supplierId === s.id ? "border-hm-rose bg-hm-rose text-white" : "border-hm-line bg-white text-hm-ink"
            }`}
          >
            {s.name} · {s.count}
          </button>
        ))}
      </div>

      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          setTerm(search);
          setPage(0);
        }}
      >
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-hm-ink-soft" />
        <input className={`${inputClass} pl-10`} placeholder="Ürün ara" value={search} onChange={(e) => setSearch(e.target.value)} />
      </form>

      {products.isLoading ? <Loader2 className="mx-auto size-6 animate-spin text-hm-ink-soft" /> : null}
      <div className="space-y-2">
        {items.map((it) => {
          const done = !!it.productId;
          const on = selected.has(it.id);
          return (
            <button
              key={it.id}
              type="button"
              disabled={done}
              onClick={() => toggle(it.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-2 text-left ${on ? "border-hm-rose" : "border-hm-line"}`}
            >
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-hm-sand">
                {it.image ? <img src={it.image} alt="" loading="lazy" className="size-full object-cover" /> : null}
                {on ? (
                  <span className="absolute inset-0 grid place-items-center bg-hm-rose/60 text-white">
                    <Check className="size-6" />
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-sm font-semibold text-hm-ink">{it.title}</div>
                <div className="mt-1 text-sm text-hm-ink">{formatMoney(it.price, it.currency)}</div>
                <div className="text-xs text-hm-ink-soft">Stok: {it.stock}</div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${done ? "bg-hm-sand text-hm-ink-soft" : "text-hm-rose"}`}>
                {done ? "Mağazada" : on ? "Seçildi" : "Seç"}
              </span>
            </button>
          );
        })}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-hm-ink">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-hm-line px-4 py-2 disabled:opacity-40">
            Önceki
          </button>
          <span>
            {page + 1} / {totalPages}
          </span>
          <button type="button" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-hm-line px-4 py-2 disabled:opacity-40">
            Sonraki
          </button>
        </div>
      ) : null}

      {selected.size ? (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-lg px-4">
          <BigButton disabled={importMut.isPending} onClick={() => importMut.mutate([...selected])} className="w-full">
            {importMut.isPending ? "Ekleniyor…" : `Mağazama ekle (${selected.size})`}
          </BigButton>
        </div>
      ) : null}
    </div>
  );
}
