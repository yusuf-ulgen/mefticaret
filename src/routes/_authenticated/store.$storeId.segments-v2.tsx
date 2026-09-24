import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { V2ErrorState } from "@/components/v2/feature-gate";
import {
  SEGMENT_FIELD_META,
  SEGMENT_FIELDS,
  SEGMENT_OP_LABELS,
  parseSegmentQuery,
  type SegmentField,
  type SegmentOp,
  type SegmentQuery,
} from "@/lib/commerce-v2";
import { v2DeleteSegment, v2ListSegments, v2PreviewSegment, v2SaveSegment } from "@/lib/commerce-v2.functions";
import { formatMoney } from "@/lib/mefti";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/segments-v2")({
  head: () => ({
    meta: [
      { title: "Segment Oluşturucu — Mefticaret" },
      { name: "description", content: "Harcama, sipariş sayısı, şehir, etiket, son sipariş ve pazarlama onayı kurallarıyla müşteri segmentleri oluştur." },
      { property: "og:title", content: "Segment Oluşturucu — Mefticaret" },
      { property: "og:description", content: "Canlı üye önizlemeli kural tabanlı müşteri segmentleri." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SegmentsV2,
});

const EMPTY: SegmentQuery = { match: "all", rules: [{ field: "total_spent", op: "gt", value: "1000" }] };

function SegmentsV2() {
  const { storeId } = Route.useParams();
  const qc = useQueryClient();
  const listFn = useServerFn(v2ListSegments);
  const previewFn = useServerFn(v2PreviewSegment);
  const saveFn = useServerFn(v2SaveSegment);
  const delFn = useServerFn(v2DeleteSegment);
  const [editId, setEditId] = useState<string | undefined>();
  const [name, setName] = useState("");
  const [query, setQuery] = useState<SegmentQuery>(EMPTY);
  const [debounced, setDebounced] = useState(query);
  useEffect(() => { const t = window.setTimeout(() => setDebounced(query), 400); return () => window.clearTimeout(t); }, [query]);

  const list = useQuery({ queryKey: ["v2-segments", storeId], queryFn: () => listFn({ data: { storeId } }) });
  const preview = useQuery({
    queryKey: ["v2-seg-preview", storeId, debounced],
    queryFn: () => previewFn({ data: { storeId, query: debounced } }),
    enabled: list.isSuccess,
  });

  const save = useMutation({
    mutationFn: () => saveFn({ data: { storeId, segmentId: editId, segment: { name, query } } }),
    onSuccess: (r) => { toast.success(`Segment kaydedildi · ${r.count} müşteri`); setEditId(r.id); qc.invalidateQueries({ queryKey: ["v2-segments", storeId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kaydedilemedi"),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { storeId, segmentId: id } }),
    onSuccess: () => { toast.success("Segment silindi"); reset(); qc.invalidateQueries({ queryKey: ["v2-segments", storeId] }); },
  });
  function reset() { setEditId(undefined); setName(""); setQuery(EMPTY); }

  const setRule = (i: number, patch: Partial<{ field: SegmentField; op: SegmentOp; value: string }>) =>
    setQuery({ ...query, rules: query.rules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  if (list.isError) return <AppShell storeId={storeId} title="Segment Oluşturucu"><V2ErrorState error={list.error} /></AppShell>;

  return (
    <AppShell storeId={storeId} title="Segment Oluşturucu" description="Kurallarla müşteri grupları oluştur.">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="space-y-1.5"><Label>Segment adı</Label><Input className="h-11" value={name} maxLength={60} placeholder="Örn. İstanbul VIP" onChange={(e) => setName(e.target.value)} /></div>
          <div className="flex items-center gap-2 text-sm">
            Müşteriler
            <Select value={query.match} onValueChange={(v) => setQuery({ ...query, match: v as "all" | "any" })}>
              <SelectTrigger className="h-9 w-auto"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">tüm kurallara</SelectItem><SelectItem value="any">herhangi bir kurala</SelectItem></SelectContent>
            </Select>
            uymalı
          </div>
          {query.rules.map((r, i) => {
            const meta = SEGMENT_FIELD_META[r.field];
            return (
              <div key={i} className="grid grid-cols-[1fr_5rem_auto] gap-2 sm:grid-cols-[1fr_6rem_1fr_auto]">
                <Select value={r.field} onValueChange={(v) => { const f = v as SegmentField; setRule(i, { field: f, op: SEGMENT_FIELD_META[f].ops[0]!, value: SEGMENT_FIELD_META[f].kind === "bool" ? "true" : "" }); }}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{SEGMENT_FIELDS.map((f) => <SelectItem key={f} value={f}>{SEGMENT_FIELD_META[f].label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={r.op} onValueChange={(v) => setRule(i, { op: v as SegmentOp })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{meta.ops.map((o) => <SelectItem key={o} value={o}>{SEGMENT_OP_LABELS[o]}</SelectItem>)}</SelectContent>
                </Select>
                {meta.kind === "bool" ? (
                  <Select value={r.value} onValueChange={(v) => setRule(i, { value: v })}>
                    <SelectTrigger className="col-span-2 h-10 sm:col-span-1"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="true">Evet</SelectItem><SelectItem value="false">Hayır</SelectItem></SelectContent>
                  </Select>
                ) : (
                  <Input className="col-span-2 h-10 sm:col-span-1" inputMode={meta.kind === "number" ? "decimal" : "text"} value={r.value} placeholder="Değer" onChange={(e) => setRule(i, { value: e.target.value })} />
                )}
                <Button variant="ghost" size="icon" className="row-start-1 size-10 sm:row-auto" aria-label="Kuralı kaldır" onClick={() => setQuery({ ...query, rules: query.rules.filter((_, j) => j !== i) })}><X className="size-4" /></Button>
              </div>
            );
          })}
          <Button variant="outline" size="sm" disabled={query.rules.length >= 20} onClick={() => setQuery({ ...query, rules: [...query.rules, { field: "orders_count", op: "gte", value: "3" }] })}><Plus className="size-4" /> Kural ekle</Button>
          <div className="flex gap-2 pt-2">
            <Button className="h-11 flex-1 rounded-full" disabled={name.trim().length < 2 || save.isPending} onClick={() => save.mutate()}>{editId ? "Güncelle" : "Segmenti kaydet"}</Button>
            {editId && <Button variant="outline" className="h-11" onClick={reset}>Yeni</Button>}
            {editId && <Button variant="outline" size="icon" className="size-11" aria-label="Sil" onClick={() => window.confirm("Segment silinsin mi?") && del.mutate(editId)}><Trash2 className="size-4" /></Button>}
          </div>
        </section>

        <aside className="space-y-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Eşleşen müşteri</p>
            <p className="text-3xl font-semibold tabular-nums text-success">{preview.isFetching && !preview.data ? "…" : (preview.data?.count ?? 0)}</p>
            <div className="mt-3 max-h-72 divide-y divide-border overflow-auto">
              {(preview.data?.sample ?? []).map((m) => (
                <Link key={m.id} to="/store/$storeId/customers-v2/$customerId" params={{ storeId, customerId: m.id }} className="flex items-center justify-between py-2 text-sm hover:text-brand">
                  <span className="truncate">{m.full_name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">{m.orders_count} · {formatMoney(m.total_spent)}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-2">
            <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Kayıtlı segmentler</p>
            {(list.data ?? []).length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Henüz yok.</p>}
            {(list.data ?? []).map((s) => (
              <button key={s.id} type="button" onClick={() => { setEditId(s.id); setName(s.name); setQuery(parseSegmentQuery(s.query)); }}
                className={cn("flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm hover:bg-muted", editId === s.id && "bg-muted")}>
                <UsersRound className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{s.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{s.customer_count}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
