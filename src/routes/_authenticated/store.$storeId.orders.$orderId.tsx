import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Save, StickyNote } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ShipmentsPanel } from "@/components/shipments-panel";
import { OrderPrintDialog } from "@/components/order-print";

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
import { orderQuery } from "@/lib/sales-queries";
import { addOrderNote, updateOrder } from "@/lib/sales.functions";
import {
  FULFILLMENT_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SHIPPING_CARRIERS,
  formatDateTime,
  formatMoney,
} from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Sipariş detayı — Mefticaret" },
      {
        name: "description",
        content: "Sipariş kalemleri, ödeme durumu, kargo takibi ve sipariş geçmişi.",
      },
      { property: "og:title", content: "Sipariş detayı — Mefticaret" },
      {
        property: "og:description",
        content: "Sipariş kalemleri, durum yönetimi ve kargo takip bilgileri.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrderDetailPage,
});

type AddressShape = {
  recipient?: string;
  line1?: string;
  line2?: string;
  district?: string;
  city?: string;
  postal_code?: string;
  country?: string;
};

function AddressBlock({ title, address }: { title: string; address: AddressShape }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm font-medium">{address.recipient ?? "—"}</p>
      <p className="text-sm text-muted-foreground">
        {[address.line1, address.line2, address.district, address.city, address.postal_code]
          .filter(Boolean)
          .join(", ") || "—"}
      </p>
    </div>
  );
}

function OrderDetailPage() {
  const { storeId, orderId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: order, isLoading } = useQuery(orderQuery(orderId));
  const update = useServerFn(updateOrder);
  const addNote = useServerFn(addOrderNote);

  const [status, setStatus] = useState("pending");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [fulfillment, setFulfillment] = useState("unfulfilled");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!order) return;
    setStatus(order.status);
    setPaymentStatus(order.payment_status);
    setFulfillment(order.fulfillment_status);
    setCarrier(order.shipping_carrier ?? "");
    setTracking(order.tracking_number ?? "");
  }, [order]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["order", orderId] });
    await queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      update({
        data: {
          orderId,
          patch: {
            status: status as never,
            payment_status: paymentStatus as never,
            fulfillment_status: fulfillment as never,
            shipping_carrier: carrier || null,
            tracking_number: tracking || null,
          },
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Sipariş güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const noteMutation = useMutation({
    mutationFn: () => addNote({ data: { orderId, message: note } }),
    onSuccess: async () => {
      setNote("");
      await invalidate();
      toast.success("Not eklendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) {
    return (
      <AppShell storeId={storeId} title="Sipariş">
        <p className="text-muted-foreground">Yükleniyor…</p>
      </AppShell>
    );
  }

  if (!order) {
    return (
      <AppShell storeId={storeId} title="Sipariş bulunamadı">
        <Button asChild variant="outline">
          <Link to="/store/$storeId/orders" params={{ storeId }}>
            <ArrowLeft className="mr-2 size-4" /> Siparişlere dön
          </Link>
        </Button>
      </AppShell>
    );
  }

  const items = (order.order_items ?? []) as Array<{
    id: string;
    title: string;
    variant_title: string | null;
    sku: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
  }>;
  const events = ((order.order_events ?? []) as Array<{
    id: string;
    kind: string;
    message: string | null;
    created_at: string;
  }>)
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return (
    <AppShell
      storeId={storeId}
      title={order.order_number}
      description={`${formatDateTime(order.placed_at)} · ${order.customer_name ?? "Misafir"}`}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/store/$storeId/orders" params={{ storeId }}>
            <ArrowLeft className="mr-2 size-4" /> Siparişler
          </Link>
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="surface-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Ürün</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Adet</th>
                  <th className="px-4 py-3 text-right">Birim</th>
                  <th className="px-4 py-3 text-right">Toplam</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3">
                      <span className="block font-medium">{item.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {item.variant_title ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.sku ?? "—"}</td>
                    <td className="px-4 py-3 text-right">{item.quantity}</td>
                    <td className="px-4 py-3 text-right">
                      {formatMoney(Number(item.unit_price), order.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatMoney(Number(item.line_total), order.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="surface-card space-y-2 p-6 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ara toplam</span>
              <span>{formatMoney(Number(order.subtotal), order.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">İndirim</span>
              <span>-{formatMoney(Number(order.discount_total), order.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kargo</span>
              <span>{formatMoney(Number(order.shipping_total), order.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vergi</span>
              <span>{formatMoney(Number(order.tax_total), order.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Genel toplam</span>
              <span>{formatMoney(Number(order.grand_total), order.currency)}</span>
            </div>
          </div>

          <div className="surface-card space-y-4 p-6">
            <h2 className="text-lg font-semibold">Sipariş geçmişi</h2>
            <form
              className="flex flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                noteMutation.mutate();
              }}
            >
              <Textarea
                rows={2}
                required
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Sipariş notu ekle (ekip içi)"
              />
              <Button type="submit" className="gap-2" disabled={noteMutation.isPending}>
                <StickyNote className="size-4" /> Ekle
              </Button>
            </form>
            <ul className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="border-l-2 border-border pl-3">
                  <p className="text-sm">{event.message ?? event.kind}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(event.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <ShipmentsPanel storeId={storeId} orderId={orderId} items={items} />

        </div>

        <div className="space-y-6">
          <div className="surface-card space-y-4 p-6">
            <h2 className="text-lg font-semibold">Durum yönetimi</h2>
            <div className="space-y-2">
              <Label>Sipariş durumu</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ödeme durumu</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kargo durumu</Label>
              <Select value={fulfillment} onValueChange={setFulfillment}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FULFILLMENT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kargo firması</Label>
              <Select value={carrier || "none"} onValueChange={(value) => setCarrier(value === "none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seçilmedi</SelectItem>
                  {SHIPPING_CARRIERS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tracking">Takip numarası</Label>
              <Input
                id="tracking"
                value={tracking}
                onChange={(event) => setTracking(event.target.value)}
                placeholder="TR000000000"
              />
            </div>
            <Button
              className="w-full gap-2"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="size-4" />
              {saveMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>

          <div className="surface-card space-y-4 p-6">
            <h2 className="text-lg font-semibold">Müşteri</h2>
            <div>
              <p className="font-medium">{order.customer_name ?? "Misafir"}</p>
              <p className="text-sm text-muted-foreground">{order.customer_email ?? "—"}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{ORDER_STATUS_LABELS[order.status]}</Badge>
              <Badge variant="outline">{PAYMENT_STATUS_LABELS[order.payment_status]}</Badge>
            </div>
            <AddressBlock
              title="Teslimat adresi"
              address={(order.shipping_address ?? {}) as AddressShape}
            />
            <AddressBlock
              title="Fatura adresi"
              address={(order.billing_address ?? {}) as AddressShape}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
