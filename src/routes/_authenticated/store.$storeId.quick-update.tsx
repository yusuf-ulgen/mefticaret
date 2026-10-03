import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { adjustStock } from "@/lib/inventory.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/quick-update")({
  head: () => ({
    meta: [
      { title: "Hızlı Güncelleme — Mefticaret" },
      { name: "description", content: "Ürün fiyat ve stoklarını tek tabloda hızlıca düzenleyin." },
      { property: "og:title", content: "Hızlı Güncelleme — Mefticaret" },
      { property: "og:description", content: "Fiyat ve stokları satır içinde güncelleyin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuickUpdatePage,
});

type Row = { id: string; title: string; sku: string | null; price: number; compare_at_price: number | null; stock: number; product: string };
type Edit = { price?: string; compare?: string; stock?: string };

function QuickUpdatePage() {
  const { storeId } = Route.useParams();
  const qc = useQueryClient();
  const adjust = useServerFn(adjustStock);
  const [q, setQ] = useState("");
  const [edits, setEdits] = useState<Record<string, Edit>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["quick-update", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, title, sku, price, compare_at_price, stock, is_default, products!inner(title)")
        .eq("store_id", storeId)
        .order("updated_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((v): Row => {
        const p = (v.products as unknown as { title: string } | null)?.title ?? "";
        return { id: v.id, sku: v.sku, price: Number(v.price), compare_at_price: v.compare_at_price, stock: v.stock, product: p, title: v.is_default ? "" : v.title };
      });
    },
  });

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (data ?? []).filter((r) => !s || [r.product, r.title, r.sku].some((x) => x?.toLowerCase().includes(s)));
  }, [data, q]);

  const set = (id: string, k: keyof Edit, v: string) => setEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  const dirty = Object.keys(edits).length;

  const save = useMutation({
    mutationFn: async () => {
      const byId = new Map((data ?? []).map((r) => [r.id, r]));
      let ok = 0;
      const errors: string[] = [];
      for (const [id, e] of Object.entries(edits)) {
        const r = byId.get(id);
        if (!r) continue;
        try {
          const patch: { price?: number; compare_at_price?: number | null } = {};
          if (e.price !== undefined) {
            const n = Number(e.price.replace(",", "."));
            if (!Number.isFinite(n) || n < 0) throw new Error("geçersiz fiyat");
            if (n !== r.price) patch.price = n;
          }
          if (e.compare !== undefined) {
            const n = e.compare.trim() === "" ? null : Number(e.compare.replace(",", "."));
            if (n !== null && (!Number.isFinite(n) || n < 0)) throw new Error("geçersiz eski fiyat");
            if (n !== r.compare_at_price) patch.compare_at_price = n;
          }
          if (Object.keys(patch).length) {
            const { error } = await supabase.from("product_variants").update(patch).eq("id", id).eq("store_id", storeId);
            if (error) throw error;
          }
          if (e.stock !== undefined) {
            const n = Number(e.stock);
            if (!Number.isInteger(n) || n < 0) throw new Error("geçersiz stok");
            if (n !== r.stock) await adjust({ data: { storeId, variantId: id, kind: "count", amount: n, reason: "Hızlı Güncelleme" } });
          }
          ok++;
        } catch (err) {
          errors.push(`${r.product}: ${(err as Error).message}`);
        }
      }
      return { ok, errors };
    },
    onSuccess: (r) => {
      if (r.errors.length) toast.error(`${r.errors.length} satır kaydedilemedi: ${r.errors[0]}`);
      if (r.ok) toast.success(`${r.ok} satır güncellendi`);
      setEdits({});
      void qc.invalidateQueries({ queryKey: ["quick-update", storeId] });
    },
  });

  return (
    <AppShell storeId={storeId} title="Hızlı Güncelleme" description="Fiyat ve stokları tabloda değiştirin, sonra tek seferde kaydedin. Stok değişiklikleri stok hareketlerine 'Hızlı Güncelleme' olarak yazılır.">
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Ürün adı, varyant veya stok kodu ara" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
          <div className="ml-auto flex items-center gap-2">
            {dirty > 0 && <span className="text-sm text-muted-foreground">{dirty} satır değişti</span>}
            <Button variant="outline" disabled={!dirty || save.isPending} onClick={() => setEdits({})}>Vazgeç</Button>
            <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>{save.isPending ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</Button>
          </div>
        </div>
        {isLoading ? <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        : error ? <p className="text-sm text-destructive">Liste yüklenemedi: {(error as Error).message}</p>
        : rows.length === 0 ? <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Ürün bulunamadı.</div>
        : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs text-muted-foreground">
                <tr><th className="p-3">Ürün</th><th className="p-3">Stok kodu</th><th className="p-3">Satış fiyatı</th><th className="p-3">Eski fiyat</th><th className="p-3">Stok</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const e = edits[r.id] ?? {};
                  return (
                    <tr key={r.id} className={`border-b last:border-0 ${edits[r.id] ? "bg-primary/5" : ""}`}>
                      <td className="p-3"><div className="font-medium">{r.product}</div>{r.title && <div className="text-xs text-muted-foreground">{r.title}</div>}</td>
                      <td className="p-3 text-muted-foreground">{r.sku ?? "—"}</td>
                      <td className="p-2"><Input aria-label={`${r.product} satış fiyatı`} inputMode="decimal" className="h-8 w-28 tabular-nums" value={e.price ?? String(r.price)} onChange={(ev) => set(r.id, "price", ev.target.value)} /></td>
                      <td className="p-2"><Input aria-label={`${r.product} eski fiyat`} inputMode="decimal" className="h-8 w-28 tabular-nums" value={e.compare ?? (r.compare_at_price == null ? "" : String(r.compare_at_price))} onChange={(ev) => set(r.id, "compare", ev.target.value)} /></td>
                      <td className="p-2"><Input aria-label={`${r.product} stok`} inputMode="numeric" className="h-8 w-20 tabular-nums" value={e.stock ?? String(r.stock)} onChange={(ev) => set(r.id, "stock", ev.target.value)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
