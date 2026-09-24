import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Mail, Plus, Search, Tag, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { V2ErrorState } from "@/components/v2/feature-gate";
import { v2BulkTagCustomers, v2ListCustomers, v2SaveCustomer } from "@/lib/commerce-v2.functions";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/mefti";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/customers-v2/")({
  head: () => ({
    meta: [
      { title: "Müşteriler v2 — Mefticaret" },
      { name: "description", content: "Müşterileri isim, e-posta ve telefonla ara; şehir, etiket ve pazarlama onayına göre filtrele, toplu etiketle ve dışa aktar." },
      { property: "og:title", content: "Müşteriler v2 — Mefticaret" },
      { property: "og:description", content: "Shopify benzeri müşteri listesi ve toplu işlemler." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerListV2,
});

const ALL = "__all";

function CustomerListV2() {
  const { storeId } = Route.useParams();
  const qc = useQueryClient();
  const listFn = useServerFn(v2ListCustomers);
  const tagFn = useServerFn(v2BulkTagCustomers);
  const saveFn = useServerFn(v2SaveCustomer);
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [city, setCity] = useState(ALL);
  const [tag, setTag] = useState("");
  const [mkt, setMkt] = useState(ALL);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [creating, setCreating] = useState(false);
  const [nc, setNc] = useState({ first_name: "", last_name: "", email: "", phone: "", accepts_marketing: false });
  const limit = 50;

  useEffect(() => { const t = window.setTimeout(() => setDq(q), 300); return () => window.clearTimeout(t); }, [q]);
  useEffect(() => { setPage(0); setSelected(new Set()); }, [dq, city, tag, mkt]);

  const filters = useMemo(() => ({
    q: dq || undefined, city: city === ALL ? undefined : city, tag: tag.trim() || undefined,
    accepts_marketing: mkt === ALL ? undefined : mkt, limit, offset: page * limit,
  }), [dq, city, tag, mkt, page]);

  const list = useQuery({
    queryKey: ["v2-customers", storeId, filters],
    queryFn: () => listFn({ data: { storeId, filters } }),
    placeholderData: keepPreviousData,
  });
  const rows = list.data?.data ?? [];
  const total = list.data?.meta.total ?? 0;
  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const addTag = useMutation({
    mutationFn: (v: { tag: string; onlyMarketing?: boolean }) => tagFn({ data: { storeId, ids: [...selected], tag: v.tag, onlyMarketing: v.onlyMarketing ?? false } }),
    onSuccess: (r, v) => {
      qc.invalidateQueries({ queryKey: ["v2-customers", storeId] });
      if (v.onlyMarketing) {
        toast.success(`${r.count} pazarlama onaylı müşteri "${v.tag}" etiketiyle işaretlendi. E-posta Pazarlama'da hedef kitle etiketi olarak bunu seç.`, { duration: 8000 });
      } else toast.success(`${r.count} müşteriye etiket eklendi`);
      setBulkTag("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "İşlem başarısız"),
  });

  const create = useMutation({
    mutationFn: () => saveFn({ data: { storeId, customer: {
      first_name: nc.first_name || null, last_name: nc.last_name || null, email: nc.email || null, phone: nc.phone || null, accepts_marketing: nc.accepts_marketing,
    } } }),
    onSuccess: () => { toast.success("Müşteri eklendi"); setCreating(false); setNc({ first_name: "", last_name: "", email: "", phone: "", accepts_marketing: false }); qc.invalidateQueries({ queryKey: ["v2-customers", storeId] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Eklenemedi"),
  });

  function exportCsv() {
    const pick = selected.size ? rows.filter((r) => selected.has(r.id)) : rows;
    downloadCsv(`musteriler-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(
      ["Ad", "E-posta", "Telefon", "Şehir", "Sipariş", "Harcama", "Etiketler", "Pazarlama"],
      pick.map((r) => [r.full_name, r.email ?? "", r.phone ?? "", r.city ?? "", r.orders_count, Number(r.total_spent).toFixed(2), (r.tags ?? []).join("|"), r.accepts_marketing ? "evet" : "hayır"]),
    ));
  }

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <AppShell storeId={storeId} title="Müşteriler" description="Müşterilerini ara, filtrele ve toplu yönet."
      actions={<Button className="rounded-full" onClick={() => setCreating(true)}><Plus className="size-4" /> Müşteri</Button>}>
      {list.isError ? <V2ErrorState error={list.error} /> : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim, e-posta veya telefon ara" className="h-11 pl-9" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Şehir: Tümü</SelectItem>
                {(list.data?.cities ?? []).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={mkt} onValueChange={setMkt}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Pazarlama: Tümü</SelectItem>
                <SelectItem value="true">Onaylı</SelectItem>
                <SelectItem value="false">Onaysız</SelectItem>
              </SelectContent>
            </Select>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Etiket" className="col-span-2 h-11 sm:col-span-1" />
          </div>

          {selected.size > 0 && (
            <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
              <span className="px-2 text-sm font-medium">{selected.size} seçili</span>
              <Input value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} placeholder="Etiket" className="h-8 w-28" />
              <Button size="sm" variant="outline" disabled={!bulkTag.trim() || addTag.isPending} onClick={() => addTag.mutate({ tag: bulkTag.trim() })}><Tag className="size-3.5" /> Etiket ekle</Button>
              <Button size="sm" variant="outline" disabled={addTag.isPending} onClick={() => addTag.mutate({ tag: `eposta-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`, onlyMarketing: true })}>
                <Mail className="size-3.5" /> E-posta gönder
              </Button>
              <Button size="sm" variant="outline" onClick={exportCsv}><Download className="size-3.5" /> Dışa aktar</Button>
              <Link to="/store/$storeId/email-marketing" params={{ storeId }} className="text-xs text-brand underline">E-posta Pazarlama</Link>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center gap-3 border-b border-border px-3 py-2 text-xs text-muted-foreground">
              <Checkbox checked={allChecked} onCheckedChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Tümünü seç" />
              <span className="flex-1">Müşteri</span>
              <span className="hidden w-20 text-right sm:block">Sipariş</span>
              <span className="w-24 text-right">Harcama</span>
            </div>
            {list.isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Yükleniyor…</p>}
            {!list.isLoading && rows.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-2 size-6" />Müşteri bulunamadı.</div>}
            {rows.map((r) => (
              <div key={r.id} className={cn("flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0", selected.has(r.id) && "bg-muted/50")}>
                <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={`${r.full_name} seç`} />
                <Link to="/store/$storeId/customers-v2/$customerId" params={{ storeId, customerId: r.id }} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.email ?? r.phone ?? "—"}{r.city ? ` · ${r.city}` : ""}<span className="sm:hidden"> · {r.orders_count} sipariş</span>
                  </p>
                  {(r.tags ?? []).length > 0 && <div className="mt-1 flex flex-wrap gap-1">{(r.tags as string[]).slice(0, 3).map((t) => <Badge key={t} variant="secondary" className="px-1.5 py-0 text-[10px]">{t}</Badge>)}</div>}
                </Link>
                <span className="hidden w-20 text-right text-sm tabular-nums sm:block">{r.orders_count}</span>
                <span className="w-24 text-right text-sm tabular-nums">{formatMoney(Number(r.total_spent))}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} müşteri</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Önceki</Button>
              <Button size="sm" variant="outline" disabled={(page + 1) * limit >= total} onClick={() => setPage((p) => p + 1)}>Sonraki</Button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={creating} onOpenChange={setCreating}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto sm:mx-auto sm:max-w-lg sm:rounded-t-xl">
          <SheetHeader><SheetTitle>Yeni müşteri</SheetTitle></SheetHeader>
          <div className="grid gap-3 p-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Ad</Label><Input className="h-11" value={nc.first_name} onChange={(e) => setNc({ ...nc, first_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Soyad</Label><Input className="h-11" value={nc.last_name} onChange={(e) => setNc({ ...nc, last_name: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label>E-posta</Label><Input type="email" className="h-11" value={nc.email} onChange={(e) => setNc({ ...nc, email: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Telefon</Label><Input type="tel" className="h-11" value={nc.phone} onChange={(e) => setNc({ ...nc, phone: e.target.value })} /></div>
            <label className="flex items-center justify-between text-sm">Pazarlama onayı var <Switch checked={nc.accepts_marketing} onCheckedChange={(c) => setNc({ ...nc, accepts_marketing: c })} /></label>
            <Button className="h-11 rounded-full" disabled={create.isPending || (!nc.email && !nc.phone && !nc.first_name)} onClick={() => create.mutate()}>Kaydet</Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
