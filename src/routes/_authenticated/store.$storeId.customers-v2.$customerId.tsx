import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { V2ErrorState } from "@/components/v2/feature-gate";
import { TagInput } from "@/components/v2/tag-input";
import { v2AddNote, v2CustomerDetail, v2DeleteAddress, v2SaveAddress, v2SaveCustomer } from "@/lib/commerce-v2.functions";
import { ORDER_STATUS_LABELS, formatMoney } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/customers-v2/$customerId")({
  head: () => ({
    meta: [
      { title: "Müşteri Detayı — Mefticaret" },
      { name: "description", content: "Müşterinin siparişleri, adresleri, etiketleri ve yönetici notları tek ekranda." },
      { property: "og:title", content: "Müşteri Detayı — Mefticaret" },
      { property: "og:description", content: "Sipariş geçmişi, adres yönetimi ve yönetici notları." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustomerDetailV2,
});

type Addr = { id?: string; first_name: string; last_name: string; company: string; address1: string; address2: string; city: string; province: string; zip: string; phone: string; is_default: boolean };
const EMPTY_ADDR: Addr = { first_name: "", last_name: "", company: "", address1: "", address2: "", city: "", province: "", zip: "", phone: "", is_default: false };

function CustomerDetailV2() {
  const { storeId, customerId } = Route.useParams();
  const qc = useQueryClient();
  const detailFn = useServerFn(v2CustomerDetail);
  const saveFn = useServerFn(v2SaveCustomer);
  const addrFn = useServerFn(v2SaveAddress);
  const delAddrFn = useServerFn(v2DeleteAddress);
  const noteFn = useServerFn(v2AddNote);
  const key = ["v2-customer", customerId];
  const detail = useQuery({ queryKey: key, queryFn: () => detailFn({ data: { storeId, customerId } }) });
  const [tab, setTab] = useState<"orders" | "addresses" | "notes">("orders");
  const [addr, setAddr] = useState<Addr | null>(null);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({ first_name: "", last_name: "", email: "", phone: "", accepts_marketing: false, tax_exempt: false });
  const refresh = () => qc.invalidateQueries({ queryKey: key });

  const saveTags = useMutation({
    mutationFn: (tags: string[]) => saveFn({ data: { storeId, customerId, customer: { tags } } }),
    onSuccess: refresh,
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kaydedilemedi"),
  });
  const saveProfile = useMutation({
    mutationFn: () => saveFn({ data: { storeId, customerId, customer: {
      first_name: edit.first_name || null, last_name: edit.last_name || null, email: edit.email || null, phone: edit.phone || null,
      accepts_marketing: edit.accepts_marketing, tax_exempt: edit.tax_exempt,
    } } }),
    onSuccess: () => { toast.success("Müşteri güncellendi"); setEditing(false); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kaydedilemedi"),
  });
  const saveAddr = useMutation({
    mutationFn: (a: Addr) => addrFn({ data: { storeId, customerId, addressId: a.id, address: {
      first_name: a.first_name || null, last_name: a.last_name || null, company: a.company || null, address1: a.address1,
      address2: a.address2 || null, city: a.city || null, province: a.province || null, zip: a.zip || null, phone: a.phone || null, is_default: a.is_default, country: "TR",
    } } }),
    onSuccess: () => { toast.success("Adres kaydedildi"); setAddr(null); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kaydedilemedi"),
  });
  const delAddr = useMutation({
    mutationFn: (id: string) => delAddrFn({ data: { storeId, customerId, addressId: id } }),
    onSuccess: () => { toast.success("Adres silindi"); refresh(); },
  });
  const addNote = useMutation({
    mutationFn: () => noteFn({ data: { storeId, customerId, note } }),
    onSuccess: () => { setNote(""); toast.success("Not eklendi"); refresh(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Eklenemedi"),
  });

  if (detail.isError) return <AppShell storeId={storeId} title="Müşteri"><V2ErrorState error={detail.error} /></AppShell>;
  const d = detail.data;
  if (detail.isSuccess && !d) return <AppShell storeId={storeId} title="Müşteri"><p className="text-sm text-muted-foreground">Müşteri bulunamadı.</p></AppShell>;
  const c = d?.customer;

  return (
    <AppShell storeId={storeId} title={c?.full_name ?? "Müşteri"}>
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to="/store/$storeId/customers-v2" params={{ storeId }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Müşteriler</Link>
        {!c ? <p className="text-sm text-muted-foreground">Yükleniyor…</p> : (
          <>
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-full bg-muted text-lg font-semibold">{(c.full_name ?? "?").slice(0, 1).toLocaleUpperCase("tr")}</div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-lg font-semibold">{c.full_name}</h2>
                  {c.email && <a href={`mailto:${c.email}`} className="block truncate text-sm text-muted-foreground">{c.email}</a>}
                  {c.phone && <a href={`tel:${c.phone}`} className="block text-sm text-muted-foreground">{c.phone}</a>}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.accepts_marketing && <Badge variant="secondary">Pazarlama onaylı</Badge>}
                    {c.tax_exempt && <Badge variant="secondary">Vergiden muaf</Badge>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" aria-label="Düzenle" onClick={() => { setEdit({ first_name: c.first_name ?? "", last_name: c.last_name ?? "", email: c.email ?? "", phone: c.phone ?? "", accepts_marketing: !!c.accepts_marketing, tax_exempt: !!c.tax_exempt }); setEditing(true); }}><Pencil className="size-4" /></Button>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Stat label="Sipariş" value={String(c.orders_count)} />
                <Stat label="Harcama" value={formatMoney(Number(c.total_spent))} />
              </div>
            </section>

            <div className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1 text-sm">
              {([["orders", "Sipariş"], ["addresses", "Adres"], ["notes", "Not"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={`min-h-10 rounded-full ${tab === k ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}>{l}</button>
              ))}
            </div>

            {tab === "orders" && (
              <section className="divide-y divide-border rounded-xl border border-border bg-card">
                {d!.orders.length === 0 && <p className="p-4 text-sm text-muted-foreground">Henüz sipariş yok.</p>}
                {d!.orders.map((o) => (
                  <Link key={o.id} to="/store/$storeId/orders/$orderId" params={{ storeId, orderId: o.id }} className="flex min-h-12 items-center justify-between px-4 py-2.5 hover:bg-muted/50">
                    <span className="text-sm font-medium">#{o.order_number}</span>
                    <span className="text-sm tabular-nums">{formatMoney(Number(o.grand_total), o.currency ?? "TRY")}</span>
                    <Badge variant="secondary">{ORDER_STATUS_LABELS[o.status] ?? o.status}</Badge>
                  </Link>
                ))}
              </section>
            )}

            {tab === "addresses" && (
              <section className="space-y-2">
                {d!.addresses.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
                    <MapPin className="mt-0.5 size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium">{[a.first_name, a.last_name].filter(Boolean).join(" ") || a.company || "Adres"} {a.is_default && <Badge variant="secondary" className="ml-1">varsayılan</Badge>}</p>
                      <p className="text-muted-foreground">{[a.address1, a.address2].filter(Boolean).join(", ")}</p>
                      <p className="text-muted-foreground">{[a.province, a.city, a.zip].filter(Boolean).join(" / ")}</p>
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Düzenle" onClick={() => setAddr({ id: a.id, first_name: a.first_name ?? "", last_name: a.last_name ?? "", company: a.company ?? "", address1: a.address1 ?? "", address2: a.address2 ?? "", city: a.city ?? "", province: a.province ?? "", zip: a.zip ?? "", phone: a.phone ?? "", is_default: !!a.is_default })}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => window.confirm("Adres silinsin mi?") && delAddr.mutate(a.id)}><Trash2 className="size-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" className="h-11 w-full" onClick={() => setAddr({ ...EMPTY_ADDR, is_default: d!.addresses.length === 0 })}><Plus className="size-4" /> Adres ekle</Button>
              </section>
            )}

            {tab === "notes" && (
              <section className="space-y-2">
                <div className="rounded-xl border border-border bg-card p-3">
                  <Textarea rows={3} value={note} maxLength={4000} placeholder="Yalnız ekibin görebileceği not…" onChange={(e) => setNote(e.target.value)} />
                  <Button className="mt-2 h-10 rounded-full" disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate()}><Plus className="size-4" /> Not ekle</Button>
                </div>
                {d!.notes.map((n) => (
                  <div key={n.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                    <p className="whitespace-pre-wrap">{n.note}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("tr-TR")}</p>
                  </div>
                ))}
              </section>
            )}

            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold">Etiketler</h3>
              <TagInput value={c.tags ?? []} onChange={(t) => saveTags.mutate(t)} />
            </section>
          </>
        )}
      </div>

      <Sheet open={!!addr} onOpenChange={(o) => !o && setAddr(null)}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto sm:mx-auto sm:max-w-lg sm:rounded-t-xl">
          <SheetHeader><SheetTitle>{addr?.id ? "Adresi düzenle" : "Yeni adres"}</SheetTitle></SheetHeader>
          {addr && (
            <div className="grid gap-3 p-4">
              <div className="grid grid-cols-2 gap-2">
                <F l="Ad" v={addr.first_name} on={(v) => setAddr({ ...addr, first_name: v })} />
                <F l="Soyad" v={addr.last_name} on={(v) => setAddr({ ...addr, last_name: v })} />
              </div>
              <F l="Şirket" v={addr.company} on={(v) => setAddr({ ...addr, company: v })} />
              <F l="Adres" v={addr.address1} on={(v) => setAddr({ ...addr, address1: v })} />
              <F l="Adres 2" v={addr.address2} on={(v) => setAddr({ ...addr, address2: v })} />
              <div className="grid grid-cols-2 gap-2">
                <F l="İl" v={addr.city} on={(v) => setAddr({ ...addr, city: v })} />
                <F l="İlçe" v={addr.province} on={(v) => setAddr({ ...addr, province: v })} />
                <F l="Posta kodu" v={addr.zip} on={(v) => setAddr({ ...addr, zip: v })} />
                <F l="Telefon" v={addr.phone} on={(v) => setAddr({ ...addr, phone: v })} />
              </div>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={addr.is_default} onCheckedChange={(c) => setAddr({ ...addr, is_default: !!c })} /> Varsayılan adres</label>
              <Button className="h-11 rounded-full" disabled={!addr.address1.trim() || saveAddr.isPending} onClick={() => saveAddr.mutate(addr)}>Kaydet</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto sm:mx-auto sm:max-w-lg sm:rounded-t-xl">
          <SheetHeader><SheetTitle>Müşteriyi düzenle</SheetTitle></SheetHeader>
          <div className="grid gap-3 p-4">
            <div className="grid grid-cols-2 gap-2">
              <F l="Ad" v={edit.first_name} on={(v) => setEdit({ ...edit, first_name: v })} />
              <F l="Soyad" v={edit.last_name} on={(v) => setEdit({ ...edit, last_name: v })} />
            </div>
            <F l="E-posta" v={edit.email} on={(v) => setEdit({ ...edit, email: v })} />
            <F l="Telefon" v={edit.phone} on={(v) => setEdit({ ...edit, phone: v })} />
            <label className="flex items-center justify-between text-sm">Pazarlama onayı <Switch checked={edit.accepts_marketing} onCheckedChange={(v) => setEdit({ ...edit, accepts_marketing: v })} /></label>
            <label className="flex items-center justify-between text-sm">Vergiden muaf <Switch checked={edit.tax_exempt} onCheckedChange={(v) => setEdit({ ...edit, tax_exempt: v })} /></label>
            <Button className="h-11 rounded-full" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate()}>Kaydet</Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold tabular-nums">{value}</p></div>;
}

function F({ l, v, on }: { l: string; v: string; on: (v: string) => void }) {
  return <div className="space-y-1.5"><Label className="text-xs">{l}</Label><Input className="h-11" value={v} onChange={(e) => on(e.target.value)} /></div>;
}
