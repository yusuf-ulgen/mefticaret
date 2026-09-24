import { DndContext, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Boxes, GripVertical, Plus, Search, Sparkles, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { V2ErrorState } from "@/components/v2/feature-gate";
import {
  COLLECTION_FIELD_LABELS,
  COLLECTION_FIELDS,
  OP_LABELS,
  parseCollectionRules,
  type CollectionOp,
  type CollectionRules,
} from "@/lib/commerce-v2";
import {
  v2CollectionProducts,
  v2DeleteCollection,
  v2ListCollections,
  v2ListProducts,
  v2SaveCollection,
  v2SetCollectionProducts,
} from "@/lib/commerce-v2.functions";
import { formatMoney } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/collections-v2")({
  head: () => ({
    meta: [
      { title: "Koleksiyonlar v2 — Mefticaret" },
      { name: "description", content: "Manuel koleksiyonlarda ürünleri sürükleyerek sırala, akıllı koleksiyonlarda etiket, fiyat, stok, tür ve marka kuralları kur." },
      { property: "og:title", content: "Koleksiyonlar v2 — Mefticaret" },
      { property: "og:description", content: "Manuel ve kurallı (akıllı) koleksiyon yönetimi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CollectionsV2,
});

const FIELD_OPS: Record<string, CollectionOp[]> = {
  tag: ["eq", "neq"], price: ["gt", "lt", "eq"], stock: ["gt", "lt", "eq"],
  product_type: ["eq", "neq", "contains"], vendor: ["eq", "neq", "contains"], title: ["contains", "not_contains", "eq"],
};

type Draft = { id?: string; title: string; description: string; type: "manual" | "smart"; rules: CollectionRules; seo_title: string; seo_description: string };
const EMPTY: Draft = { title: "", description: "", type: "manual", rules: { match: "all", conditions: [] }, seo_title: "", seo_description: "" };

function CollectionsV2() {
  const { storeId } = Route.useParams();
  const qc = useQueryClient();
  const listFn = useServerFn(v2ListCollections);
  const saveFn = useServerFn(v2SaveCollection);
  const delFn = useServerFn(v2DeleteCollection);
  const [draft, setDraft] = useState<Draft | null>(null);

  const list = useQuery({ queryKey: ["v2-collections", storeId], queryFn: () => listFn({ data: { storeId } }) });

  const save = useMutation({
    mutationFn: (d: Draft) => saveFn({ data: { storeId, collectionId: d.id, collection: {
      title: d.title, description: d.description || null, collection_type: d.type,
      rules: d.rules, seo_title: d.seo_title || null, seo_description: d.seo_description || null,
    } } }),
    onSuccess: (r, d) => {
      toast.success(d.type === "smart" ? "Akıllı koleksiyon kaydedildi, ürünler kurallara göre eşlendi" : "Koleksiyon kaydedildi");
      qc.invalidateQueries({ queryKey: ["v2-collections", storeId] });
      qc.invalidateQueries({ queryKey: ["v2-col-products", r.id] });
      setDraft({ ...d, id: r.id });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kaydedilemedi"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { storeId, collectionId: id } }),
    onSuccess: () => { toast.success("Koleksiyon silindi"); setDraft(null); qc.invalidateQueries({ queryKey: ["v2-collections", storeId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Silinemedi"),
  });

  return (
    <AppShell storeId={storeId} title="Koleksiyonlar" description="Manuel veya kurallı koleksiyonlar oluştur."
      actions={<Button className="rounded-full" onClick={() => setDraft({ ...EMPTY })}><Plus className="size-4" /> Koleksiyon</Button>}>
      {list.isError ? <V2ErrorState error={list.error} /> : (
        <div className="grid gap-2">
          {list.isLoading && <p className="text-sm text-muted-foreground">Yükleniyor…</p>}
          {list.data?.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              <Boxes className="mx-auto mb-2 size-6" /> Henüz koleksiyon yok.
            </div>
          )}
          {list.data?.map((c) => (
            <button key={c.id} type="button" onClick={() => setDraft({
              id: c.id, title: c.title, description: c.description ?? "", type: c.collection_type ?? "manual",
              rules: parseCollectionRules(c.rules), seo_title: c.seo?.title ?? "", seo_description: c.seo?.description ?? "",
            })} className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.products_count} ürün · /{c.handle}</p>
              </div>
              <Badge variant={c.collection_type === "smart" ? "default" : "secondary"}>
                {c.collection_type === "smart" ? <><Sparkles className="size-3" /> Akıllı</> : "Manuel"}
              </Badge>
            </button>
          ))}
        </div>
      )}

      <Sheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader><SheetTitle>{draft?.id ? "Koleksiyonu düzenle" : "Yeni koleksiyon"}</SheetTitle></SheetHeader>
          {draft && (
            <div className="space-y-4 p-4">
              <div className="space-y-1.5"><Label>Başlık</Label><Input className="h-11" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Açıklama</Label><Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                {(["manual", "smart"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setDraft({ ...draft, type: t })}
                    className={`min-h-16 rounded-lg border p-3 text-left text-sm ${draft.type === t ? "border-foreground bg-muted" : "border-border"}`}>
                    <p className="font-medium">{t === "manual" ? "Manuel" : "Akıllı"}</p>
                    <p className="text-xs text-muted-foreground">{t === "manual" ? "Ürünleri sen seç ve sırala" : "Kurallara uyanlar otomatik"}</p>
                  </button>
                ))}
              </div>

              {draft.type === "smart" && <RuleBuilder rules={draft.rules} onChange={(rules) => setDraft({ ...draft, rules })} />}

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Meta başlık</Label><Input value={draft.seo_title} maxLength={120} onChange={(e) => setDraft({ ...draft, seo_title: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Meta açıklama</Label><Input value={draft.seo_description} maxLength={320} onChange={(e) => setDraft({ ...draft, seo_description: e.target.value })} /></div>
              </div>

              <div className="flex gap-2">
                <Button className="h-11 flex-1 rounded-full" disabled={save.isPending || !draft.title.trim() || (draft.type === "smart" && !draft.rules.conditions.length)} onClick={() => save.mutate(draft)}>
                  {save.isPending ? "Kaydediliyor…" : "Kaydet"}
                </Button>
                {draft.id && <Button variant="outline" size="icon" className="size-11" aria-label="Sil" onClick={() => window.confirm("Koleksiyon silinsin mi?") && remove.mutate(draft.id!)}><Trash2 className="size-4" /></Button>}
              </div>

              {draft.id && <CollectionProducts storeId={storeId} collectionId={draft.id} smart={draft.type === "smart"} />}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function RuleBuilder({ rules, onChange }: { rules: CollectionRules; onChange: (r: CollectionRules) => void }) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 text-sm">
        Ürünler
        <Select value={rules.match} onValueChange={(v) => onChange({ ...rules, match: v as "all" | "any" })}>
          <SelectTrigger className="h-9 w-auto"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">tüm koşullara</SelectItem><SelectItem value="any">herhangi bir koşula</SelectItem></SelectContent>
        </Select>
        uymalı
      </div>
      {rules.conditions.map((c, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <Select value={c.field} onValueChange={(v) => onChange({ ...rules, conditions: rules.conditions.map((x, j) => j === i ? { ...x, field: v as typeof c.field, op: FIELD_OPS[v]![0]! } : x) })}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>{COLLECTION_FIELDS.map((f) => <SelectItem key={f} value={f}>{COLLECTION_FIELD_LABELS[f]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={c.op} onValueChange={(v) => onChange({ ...rules, conditions: rules.conditions.map((x, j) => j === i ? { ...x, op: v as CollectionOp } : x) })}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>{FIELD_OPS[c.field]!.map((o) => <SelectItem key={o} value={o}>{OP_LABELS[o]}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="col-span-2 h-10 sm:col-span-1" inputMode={c.field === "price" || c.field === "stock" ? "decimal" : "text"} value={c.value} placeholder="Değer"
            onChange={(e) => onChange({ ...rules, conditions: rules.conditions.map((x, j) => j === i ? { ...x, value: e.target.value } : x) })} />
          <Button variant="ghost" size="icon" className="row-start-1 size-10 sm:row-auto" aria-label="Koşulu kaldır" onClick={() => onChange({ ...rules, conditions: rules.conditions.filter((_, j) => j !== i) })}><X className="size-4" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange({ ...rules, conditions: [...rules.conditions, { field: "tag", op: "eq", value: "" }] })}>
        <Plus className="size-4" /> Koşul ekle
      </Button>
    </div>
  );
}

function CollectionProducts({ storeId, collectionId, smart }: { storeId: string; collectionId: string; smart: boolean }) {
  const qc = useQueryClient();
  const getFn = useServerFn(v2CollectionProducts);
  const setFn = useServerFn(v2SetCollectionProducts);
  const searchFn = useServerFn(v2ListProducts);
  const [items, setItems] = useState<{ id: string; title: string; base_price: number }[]>([]);
  const [q, setQ] = useState("");
  const current = useQuery({ queryKey: ["v2-col-products", collectionId], queryFn: () => getFn({ data: { storeId, collectionId } }) });
  useEffect(() => { if (current.data) setItems(current.data); }, [current.data]);
  const search = useQuery({
    queryKey: ["v2-col-search", storeId, q],
    queryFn: () => searchFn({ data: { storeId, filters: { q, limit: 10 } } }),
    enabled: !smart && q.trim().length >= 2,
  });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }));

  const persist = useMutation({
    mutationFn: (next: typeof items) => setFn({ data: { storeId, collectionId, productIds: next.map((i) => i.id) } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["v2-collections", storeId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kaydedilemedi"),
  });
  const update = (next: typeof items) => { setItems(next); persist.mutate(next); };

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = items.map((i) => i.id);
    update(arrayMove(items, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Ürünler ({items.length})</h3>
      {!smart && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ürün ara ve ekle" className="h-11 pl-9" />
          {q.trim().length >= 2 && (search.data?.data ?? []).length > 0 && (
            <div className="absolute inset-x-0 top-12 z-20 max-h-64 overflow-auto rounded-lg border border-border bg-popover shadow-md">
              {search.data!.data.filter((p) => !items.some((i) => i.id === p.id)).map((p) => (
                <button key={p.id} type="button" className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-muted"
                  onClick={() => { update([...items, { id: p.id, title: p.title, base_price: Number(p.base_price) }]); setQ(""); }}>
                  <span className="truncate">{p.title}</span><Plus className="size-4" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {smart && <p className="text-xs text-muted-foreground">Akıllı koleksiyonda liste kurallara göre oluşur; kaydettikçe güncellenir.</p>}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-border rounded-lg border border-border">
            {items.map((p) => <Row key={p.id} p={p} draggable={!smart} onRemove={smart ? undefined : () => update(items.filter((i) => i.id !== p.id))} />)}
            {items.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Bu koleksiyonda ürün yok.</p>}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function Row({ p, draggable, onRemove }: { p: { id: string; title: string; base_price: number }; draggable: boolean; onRemove?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: p.id, disabled: !draggable });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex min-h-12 items-center gap-2 bg-card px-2 py-2">
      {draggable && <button type="button" {...attributes} {...listeners} aria-label="Sürükle" className="grid size-8 touch-none place-items-center text-muted-foreground"><GripVertical className="size-4" /></button>}
      <span className="flex-1 truncate text-sm">{p.title}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{formatMoney(Number(p.base_price))}</span>
      {onRemove && <button type="button" onClick={onRemove} aria-label="Çıkar" className="grid size-8 place-items-center text-muted-foreground"><X className="size-4" /></button>}
    </div>
  );
}
