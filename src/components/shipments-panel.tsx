import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Copy, ExternalLink, PackagePlus, RefreshCw, Trash2, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  API_CARRIERS,
  CARRIERS,
  type CarrierKey,
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
  carrierName,
} from "@/lib/carriers";
import { formatDateTime } from "@/lib/mefti";
import {
  createShipment,
  deleteShipment,
  getOrderShipments,
  syncShipmentNow,
  updateShipment,
} from "@/lib/shipments.functions";

type OrderItem = { id: string; title: string; variant_title: string | null; quantity: number };

function relative(iso: string) {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const time = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (days <= 0 && new Date().toDateString() === d.toDateString()) return time;
  if (days <= 1) return `Dün ${time}`;
  if (days < 7) return `${days} gün önce`;
  return d.toLocaleDateString("tr-TR");
}

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "delivered") return "default";
  if (s === "failed" || s === "returned" || s === "cancelled") return "destructive";
  if (s === "pending") return "outline";
  return "secondary";
}

export function ShipmentsPanel({ orderId, storeId, items }: { orderId: string; storeId: string; items: OrderItem[] }) {
  const qc = useQueryClient();
  const load = useServerFn(getOrderShipments);
  const create = useServerFn(createShipment);
  const update = useServerFn(updateShipment);
  const remove = useServerFn(deleteShipment);
  const sync = useServerFn(syncShipmentNow);
  const queryKey = ["shipments", "order", orderId, "detail"] as const;
  const { data: shipments = [], isLoading } = useQuery({ queryKey, queryFn: () => load({ data: { orderId } }) });

  const [carrierKey, setCarrierKey] = useState<CarrierKey>("yurtici");
  const [tracking, setTracking] = useState("");
  const [eta, setEta] = useState("");
  const [status, setStatus] = useState<ShipmentStatus>("picked_up");
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [eventFor, setEventFor] = useState<string | null>(null);
  const [evStatus, setEvStatus] = useState<ShipmentStatus>("in_transit");
  const [evLocation, setEvLocation] = useState("");
  const [evDesc, setEvDesc] = useState("");

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey });
    await qc.invalidateQueries({ queryKey: ["order", orderId] });
    await qc.invalidateQueries({ queryKey: ["orders", storeId] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          orderId,
          carrierKey,
          carrier: carrierName(carrierKey),
          trackingNumber: tracking || undefined,
          estimatedDeliveryDate: eta || undefined,
          status,
          note: note || undefined,
          items: items
            .map((i) => ({ orderItemId: i.id, quantity: Math.min(quantities[i.id] ?? 0, i.quantity) }))
            .filter((l) => l.quantity > 0),
        },
      }),
    onSuccess: async () => {
      setTracking(""); setEta(""); setNote(""); setQuantities({});
      await invalidate();
      toast.success("Kargo oluşturuldu");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eventMutation = useMutation({
    mutationFn: (shipmentId: string) =>
      update({ data: { shipmentId, status: evStatus, location: evLocation || undefined, description: evDesc || undefined } }),
    onSuccess: async () => {
      setEventFor(null); setEvLocation(""); setEvDesc("");
      await invalidate();
      toast.success("Kargo hareketi eklendi");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncMutation = useMutation({
    mutationFn: (shipmentId: string) => sync({ data: { shipmentId } }),
    onSuccess: async (res) => {
      await invalidate();
      if (res.ok) toast.success(res.message);
      else toast.info(res.message);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (shipmentId: string) => remove({ data: { shipmentId } }),
    onSuccess: async () => { await invalidate(); toast.success("Kargo silindi"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="surface-card space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Truck className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">Kargo Bilgileri</h2>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : shipments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Bu sipariş için henüz kargo oluşturulmadı.</p>
      ) : (
        <ul className="space-y-4">
          {shipments.map((s) => {
            const publicUrl = s.tracking_number ? `${typeof window !== "undefined" ? window.location.origin : ""}/kargo-takip/${encodeURIComponent(s.tracking_number)}` : null;
            const hasApi = API_CARRIERS.includes((s.carrier_key ?? "") as CarrierKey) || /aras/i.test(s.carrier);
            return (
              <li key={s.id} className="rounded-lg border border-border">
                <dl className="grid gap-2 p-4 text-sm">
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Kargo Firması</dt><dd className="font-medium">{carrierName(s.carrier_key, s.carrier)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Takip No</dt><dd className="font-mono">{s.tracking_number ?? "—"}</dd></div>
                  <div className="flex items-center justify-between gap-2"><dt className="text-muted-foreground">Durum</dt><dd><Badge variant={statusVariant(s.status)}>{SHIPMENT_STATUS_LABELS[s.status] ?? s.status}</Badge></dd></div>
                </dl>

                <div className="border-t border-border p-4">
                  <p className="mb-3 text-sm font-semibold">Kargo Geçmişi</p>
                  {s.shipment_events.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Henüz hareket yok.</p>
                  ) : (
                    <ol className="space-y-3">
                      {s.shipment_events.map((e, idx) => (
                        <li key={e.id} className="flex items-start gap-3 text-sm">
                          <CheckCircle2 className={`mt-0.5 size-4 shrink-0 ${idx === 0 ? "text-primary" : "text-muted-foreground"}`} />
                          <div className="min-w-0 flex-1">
                            <p className={idx === 0 ? "font-medium" : ""}>{e.description ?? SHIPMENT_STATUS_LABELS[e.status] ?? e.status}</p>
                            {e.location ? <p className="text-xs text-muted-foreground">{e.location}</p> : null}
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">{relative(e.event_at)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-border p-4 text-sm">
                  <span className="text-muted-foreground">Tahmini Teslimat</span>
                  <span className="font-medium">
                    {s.estimated_delivery_date ? new Date(`${s.estimated_delivery_date}T12:00:00`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                  </span>
                </div>

                {s.last_sync_error ? <p className="border-t border-border px-4 py-2 text-xs text-destructive">Son güncelleme hatası: {s.last_sync_error}</p> : null}

                <div className="flex flex-wrap gap-2 border-t border-border p-3">
                  {hasApi ? (
                    <Button size="sm" variant="outline" className="h-11" disabled={syncMutation.isPending} onClick={() => syncMutation.mutate(s.id)}>
                      <RefreshCw className="mr-1 size-4" /> Şimdi güncelle
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" className="h-11" onClick={() => setEventFor(eventFor === s.id ? null : s.id)}>
                    Hareket ekle
                  </Button>
                  {publicUrl ? (
                    <Button size="sm" variant="ghost" className="h-11" onClick={() => { void navigator.clipboard.writeText(publicUrl); toast.success("Takip bağlantısı kopyalandı"); }}>
                      <Copy className="mr-1 size-4" /> Takip linki
                    </Button>
                  ) : null}
                  {s.tracking_url ? (
                    <Button asChild size="icon" variant="ghost" className="size-11" aria-label="Kargo firmasında aç">
                      <a href={s.tracking_url} target="_blank" rel="noreferrer"><ExternalLink className="size-4" /></a>
                    </Button>
                  ) : null}
                  <Button size="icon" variant="ghost" className="ml-auto size-11" aria-label="Kargoyu sil" onClick={() => { if (confirm("Kargo kaydı silinsin mi?")) deleteMutation.mutate(s.id); }}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                {eventFor === s.id ? (
                  <form
                    className="grid gap-3 border-t border-border p-4"
                    onSubmit={(ev) => { ev.preventDefault(); eventMutation.mutate(s.id); }}
                  >
                    <Select value={evStatus} onValueChange={(v) => setEvStatus(v as ShipmentStatus)}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SHIPMENT_STATUSES.map((v) => <SelectItem key={v} value={v}>{SHIPMENT_STATUS_LABELS[v]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="h-11" placeholder="Konum (ör. İstanbul / Kadıköy)" maxLength={120} value={evLocation} onChange={(e) => setEvLocation(e.target.value)} />
                    <Input className="h-11" placeholder="Açıklama (isteğe bağlı)" maxLength={300} value={evDesc} onChange={(e) => setEvDesc(e.target.value)} />
                    <Button type="submit" className="h-11" disabled={eventMutation.isPending}>Kaydet ve müşteriyi bilgilendir</Button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <form className="space-y-4 border-t border-border pt-5" onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }}>
        <p className="text-sm font-semibold">Yeni kargo</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Kargo firması</Label>
            <Select value={carrierKey} onValueChange={(v) => setCarrierKey(v as CarrierKey)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{CARRIERS.map((c) => <SelectItem key={c.key} value={c.key}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Durum</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ShipmentStatus)}>
              <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
              <SelectContent>{SHIPMENT_STATUSES.map((v) => <SelectItem key={v} value={v}>{SHIPMENT_STATUS_LABELS[v]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shipment-tracking">Takip numarası</Label>
            <Input id="shipment-tracking" className="h-11" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="YK123456789" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shipment-eta">Tahmini teslim</Label>
            <Input id="shipment-eta" type="date" className="h-11" value={eta} onChange={(e) => setEta(e.target.value)} />
          </div>
        </div>
        {!API_CARRIERS.includes(carrierKey) ? (
          <p className="text-xs text-muted-foreground">{carrierName(carrierKey)} için otomatik takip bağlantısı yok; hareketleri elle ekleyebilirsiniz. Müşteri firmanın takip sayfasına da yönlendirilir.</p>
        ) : null}

        {items.length ? (
          <div className="space-y-2">
            <Label>Gönderilen kalemler</Label>
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{item.title}{item.variant_title ? ` · ${item.variant_title}` : ""}</span>
                <Input type="number" min={0} max={item.quantity} className="h-11 w-24" value={quantities[item.id] ?? ""} placeholder={`0 / ${item.quantity}`}
                  onChange={(e) => setQuantities((p) => ({ ...p, [item.id]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="shipment-note">Not</Label>
          <Textarea id="shipment-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kargo ile ilgili iç not" />
        </div>

        <Button type="submit" className="h-11 w-full gap-2" disabled={createMutation.isPending}>
          <PackagePlus className="size-4" /> Kargo oluştur
        </Button>
      </form>
    </div>
  );
}
