import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, PackagePlus, Trash2, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SHIPPING_CARRIERS, formatDateTime } from "@/lib/mefti";
import {
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
  orderShipmentsQuery,
} from "@/lib/shipments-queries";
import { createShipment, deleteShipment, updateShipment } from "@/lib/shipments.functions";

type OrderItem = {
  id: string;
  title: string;
  variant_title: string | null;
  quantity: number;
};

export function ShipmentsPanel({
  orderId,
  storeId,
  items,
}: {
  orderId: string;
  storeId: string;
  items: OrderItem[];
}) {
  const queryClient = useQueryClient();
  const { data: shipments = [], isLoading } = useQuery(orderShipmentsQuery(orderId));
  const create = useServerFn(createShipment);
  const update = useServerFn(updateShipment);
  const remove = useServerFn(deleteShipment);

  const [carrier, setCarrier] = useState<string>(SHIPPING_CARRIERS[0] ?? "");
  const [tracking, setTracking] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [status, setStatus] = useState<ShipmentStatus>("pending");
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["shipments", "order", orderId] });
    await queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    await queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          orderId,
          carrier,
          trackingNumber: tracking || undefined,
          trackingUrl: trackingUrl || undefined,
          status,
          note: note || undefined,
          items: items
            .map((item) => ({
              orderItemId: item.id,
              quantity: Math.min(quantities[item.id] ?? 0, item.quantity),
            }))
            .filter((line) => line.quantity > 0),
        },
      }),
    onSuccess: async () => {
      setTracking("");
      setTrackingUrl("");
      setNote("");
      setQuantities({});
      await invalidate();
      toast.success("Sevkiyat oluşturuldu");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { shipmentId: string; status: ShipmentStatus }) =>
      update({ data: input }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Sevkiyat güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (shipmentId: string) => remove({ data: { shipmentId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Sevkiyat silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="surface-card space-y-5 p-6">
      <div className="flex items-center gap-2">
        <Truck className="size-5 text-primary" />
        <h2 className="text-lg font-semibold">Sevkiyatlar</h2>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor…</p>
      ) : shipments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Bu sipariş için henüz sevkiyat oluşturulmadı.
        </p>
      ) : (
        <ul className="space-y-3">
          {shipments.map((shipment) => (
            <li
              key={shipment.id}
              className="rounded-lg border border-border p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{shipment.carrier}</p>
                  <p className="text-xs text-muted-foreground">
                    {shipment.tracking_number ?? "Takip numarası yok"} ·{" "}
                    {formatDateTime(shipment.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {SHIPMENT_STATUS_LABELS[shipment.status as ShipmentStatus]}
                  </Badge>
                  {shipment.tracking_url ? (
                    <Button asChild size="icon" variant="ghost">
                      <a href={shipment.tracking_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(shipment.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(Object.keys(SHIPMENT_STATUS_LABELS) as ShipmentStatus[]).map((value) => (
                  <Button
                    key={value}
                    size="sm"
                    variant={shipment.status === value ? "default" : "outline"}
                    disabled={statusMutation.isPending}
                    onClick={() =>
                      statusMutation.mutate({ shipmentId: shipment.id, status: value })
                    }
                  >
                    {SHIPMENT_STATUS_LABELS[value]}
                  </Button>
                ))}
              </div>
              {shipment.note ? (
                <p className="mt-3 text-xs text-muted-foreground">{shipment.note}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form
        className="space-y-4 border-t border-border pt-5"
        onSubmit={(event) => {
          event.preventDefault();
          createMutation.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Kargo firması</Label>
            <Select value={carrier} onValueChange={setCarrier}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIPPING_CARRIERS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Durum</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as ShipmentStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SHIPMENT_STATUS_LABELS) as ShipmentStatus[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {SHIPMENT_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shipment-tracking">Takip numarası</Label>
            <Input
              id="shipment-tracking"
              value={tracking}
              onChange={(event) => setTracking(event.target.value)}
              placeholder="TR000000000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shipment-url">Takip bağlantısı</Label>
            <Input
              id="shipment-url"
              type="url"
              value={trackingUrl}
              onChange={(event) => setTrackingUrl(event.target.value)}
              placeholder="https://kargo.com/takip/…"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Gönderilen kalemler</Label>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">
                  {item.title}
                  {item.variant_title ? ` · ${item.variant_title}` : ""}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={item.quantity}
                  className="w-24"
                  value={quantities[item.id] ?? ""}
                  placeholder={`0 / ${item.quantity}`}
                  onChange={(event) =>
                    setQuantities((prev) => ({
                      ...prev,
                      [item.id]: Number(event.target.value),
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="shipment-note">Not</Label>
          <Textarea
            id="shipment-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Kargo ile ilgili iç not"
          />
        </div>

        <Button type="submit" className="w-full gap-2" disabled={createMutation.isPending}>
          <PackagePlus className="size-4" /> Sevkiyat oluştur
        </Button>
      </form>
    </div>
  );
}
