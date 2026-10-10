import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CreditCard,
  FileText,
  Mail,
  Percent,
  Phone,
  Save,
  Truck,
  User,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ShipmentsPanel } from "@/components/shipments-panel";
import { DropshipPanel } from "@/components/dropship-panel";
import { OrderPrintDialog } from "@/components/order-print";
import { OrderRefundHistory, RefundDrawer } from "@/components/refunds/order-refund-panel";
import { OrderActionsSheet } from "@/components/orders/order-actions-sheet";
import { OrderTimeline } from "@/components/orders/order-timeline";

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
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  SHIPPING_CARRIERS,
  formatDate,
  formatDateTime,
  formatMoney,
} from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/orders/$orderId")({
  head: () => ({
    meta: [
      { title: "Sipariş detayı — Mefticaret" },
      {
        name: "description",
        content:
          "Müşteri, ürünler, adresler, ödeme, kargo, fatura, indirim, notlar ve sipariş geçmişi tek ekranda.",
      },
      { property: "og:title", content: "Sipariş detayı — Mefticaret" },
      {
        property: "og:description",
        content: "Sipariş kalemleri, durum yönetimi, fatura bilgileri ve kargo takibi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrderDetailPage,
});

type AddressShape = {
  recipient?: string;
  phone?: string;
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
        {[
          address.line1,
          address.line2,
          address.district,
          address.city,
          address.postal_code,
          address.country,
        ]
          .filter(Boolean)
          .join(", ") || "—"}
      </p>
      {address.phone ? <p className="text-sm text-muted-foreground">{address.phone}</p> : null}
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card space-y-4 p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Icon className="size-4 text-muted-foreground" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function OrderDetailPage() {
  const { storeId, orderId } = Route.useParams();
  const navigate = useNavigate();
  const commentRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data: order, isLoading } = useQuery(orderQuery(orderId));
  const update = useServerFn(updateOrder);
  const addNote = useServerFn(addOrderNote);

  const [refundOpen, setRefundOpen] = useState(false);
  const [status, setStatus] = useState("pending");
  const [paymentStatus, setPaymentStatus] = useState("pending");
  const [fulfillment, setFulfillment] = useState("unfulfilled");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [phone, setPhone] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoicedAt, setInvoicedAt] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!order) return;
    setStatus(order.status);
    setPaymentStatus(order.payment_status);
    setFulfillment(order.fulfillment_status);
    setCarrier(order.shipping_carrier ?? "");
    setTracking(order.tracking_number ?? "");
    setPhone(order.customer_phone ?? order.customers?.phone ?? "");
    setInvoiceNumber(order.invoice_number ?? "");
    setInvoicedAt(order.invoiced_at ? order.invoiced_at.slice(0, 10) : "");
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
            customer_phone: phone || null,
          },
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Sipariş güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const invoiceMutation = useMutation({
    mutationFn: () =>
      update({
        data: {
          orderId,
          patch: {
            invoice_number: invoiceNumber || null,
            invoiced_at: invoicedAt ? new Date(invoicedAt).toISOString() : null,
          },
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Fatura bilgileri kaydedildi");
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

  const items = useMemo(
    () =>
      ((order?.order_items ?? []) as Array<{
        id: string;
        title: string;
        variant_title: string | null;
        sku: string | null;
        quantity: number;
        unit_price: number;
        line_total: number;
        tax_rate?: number | null;
        tax_total?: number | null;
      }>).slice(),
    [order],
  );

  const events = useMemo(
    () =>
      ((order?.order_events ?? []) as Array<{
        id: string;
        kind: string;
        message: string | null;
        created_at: string;
      }>)
        .slice()
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [order],
  );

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

  const flowIndex = ORDER_STATUS_FLOW.indexOf(order.status as (typeof ORDER_STATUS_FLOW)[number]);
  const customerId = order.customers?.id ?? null;

  const shareOrder = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `Sipariş ${order.order_number}`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Sipariş bağlantısı kopyalandı");
      }
    } catch {
      /* kullanıcı paylaşımı iptal etti */
    }
  };

  const emailReceipt = order.customer_email
    ? () => {
        const lines = items.map((i) => `${i.quantity} x ${i.title} — ${formatMoney(Number(i.line_total), order.currency)}`);
        const body = [
          `Merhaba ${order.customer_name ?? ""},`,
          "",
          `${order.order_number} numaralı siparişinizin özeti:`,
          ...lines,
          "",
          `Toplam: ${formatMoney(Number(order.grand_total), order.currency)}`,
        ].join("\n");
        window.location.href = `mailto:${order.customer_email}?subject=${encodeURIComponent(`Sipariş makbuzu ${order.order_number}`)}&body=${encodeURIComponent(body)}`;
      }
    : null;

  return (
    <AppShell
      storeId={storeId}
      title={order.order_number}
      description={`${formatDateTime(order.placed_at)} · ${order.customer_name ?? "Misafir"}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <OrderPrintDialog storeId={storeId} order={order} items={items} />
          <Button asChild variant="outline" size="sm">
            <Link to="/store/$storeId/orders" params={{ storeId }}>
              <ArrowLeft className="mr-2 size-4" /> Siparişler
            </Link>
          </Button>
          <OrderActionsSheet
            canRefund={["paid", "partially_refunded"].includes(order.payment_status)}
            onRefund={() => setRefundOpen(true)}
            onAddNote={() => {
              document.getElementById("order-timeline")?.scrollIntoView({ behavior: "smooth", block: "start" });
              setTimeout(() => commentRef.current?.focus(), 350);
            }}
            onPrint={() => window.print()}
            onShare={shareOrder}
            onEmailReceipt={emailReceipt}
            onOpenCustomer={
              customerId
                ? () => navigate({ to: "/store/$storeId/customers-v2/$customerId", params: { storeId, customerId } })
                : null
            }
          />
        </div>
      }
    >
      <RefundDrawer storeId={storeId} orderId={order.id} open={refundOpen} onOpenChange={setRefundOpen} />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {ORDER_STATUS_FLOW.map((step, index) => (
          <Badge
            key={step}
            variant={
              flowIndex >= 0 && index <= flowIndex
                ? index === flowIndex
                  ? "default"
                  : "secondary"
                : "outline"
            }
          >
            {ORDER_STATUS_LABELS[step]}
          </Badge>
        ))}
        {["cancelled", "returned", "refunded"].includes(order.status) ? (
          <Badge variant="destructive">{ORDER_STATUS_LABELS[order.status]}</Badge>
        ) : null}
      </div>

      <div className="mb-6">
        <OrderRefundHistory storeId={storeId} orderId={order.id} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="surface-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Ürün</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3 text-right">Adet</th>
                  <th className="px-4 py-3 text-right">Birim</th>
                  <th className="px-4 py-3 text-right">KDV</th>
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
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {Number(item.tax_rate ?? 0) > 0
                        ? `%${Number(item.tax_rate)} · ${formatMoney(Number(item.tax_total ?? 0), order.currency)}`
                        : "—"}
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

          <SectionCard title="İndirim" icon={Percent}>
            {order.discount_code || Number(order.discount_total) > 0 ? (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {order.discount_code ? (
                  <Badge variant="secondary" className="font-mono">
                    {order.discount_code}
                  </Badge>
                ) : null}
                <span className="text-muted-foreground">
                  Uygulanan indirim: {formatMoney(Number(order.discount_total), order.currency)}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Bu siparişte indirim uygulanmadı.</p>
            )}
          </SectionCard>

          {order.note ? (
            <p className="surface-card px-5 py-4 text-sm">
              <span className="text-muted-foreground">Müşteri notu: </span>
              {order.note}
            </p>
          ) : null}

          <OrderTimeline
            ref={commentRef}
            events={events}
            comment={note}
            onCommentChange={setNote}
            onSubmit={() => noteMutation.mutate()}
            pending={noteMutation.isPending}
          />

          <ShipmentsPanel storeId={storeId} orderId={orderId} items={items} />

          <DropshipPanel storeId={storeId} orderId={orderId} />
        </div>

        <div className="space-y-6">
          <SectionCard title="Durum yönetimi" icon={FileText}>
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
            <Button
              className="w-full gap-2"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save className="size-4" />
              {saveMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </SectionCard>

          <SectionCard title="Müşteri" icon={User}>
            <div>
              <p className="font-medium">{order.customer_name ?? "Misafir"}</p>
              <p className="text-sm text-muted-foreground">{order.customer_email ?? "—"}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button asChild={Boolean(order.customer_email)} variant="outline" size="sm" className="h-11 gap-2 rounded-full" disabled={!order.customer_email}>
                {order.customer_email ? (
                  <a href={`mailto:${order.customer_email}`}><Mail className="size-4" /> E-posta</a>
                ) : (
                  <span><Mail className="size-4" /> E-posta</span>
                )}
              </Button>
              <Button asChild={Boolean(phone)} variant="outline" size="sm" className="h-11 gap-2 rounded-full" disabled={!phone}>
                {phone ? (
                  <a href={`tel:${phone.replace(/\s/g, "")}`}><Phone className="size-4" /> Telefon</a>
                ) : (
                  <span><Phone className="size-4" /> Telefon</span>
                )}
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="order-phone">Telefon</Label>
              <Input
                id="order-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+90 5xx xxx xx xx"
              />
            </div>
            {order.customers?.id ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  to="/store/$storeId/customers-v2/$customerId"
                  params={{ storeId, customerId: order.customers.id }}
                >
                  Müşteri kartını aç
                </Link>
              </Button>
            ) : null}
          </SectionCard>

          <SectionCard title="Adres" icon={User}>
            <AddressBlock
              title="Teslimat adresi"
              address={(order.shipping_address ?? {}) as AddressShape}
            />
            <AddressBlock
              title="Fatura adresi"
              address={(order.billing_address ?? {}) as AddressShape}
            />
          </SectionCard>

          <SectionCard title="Ödeme" icon={CreditCard}>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{PAYMENT_STATUS_LABELS[order.payment_status]}</Badge>
              <Badge variant="secondary">{order.currency}</Badge>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tahsil edilecek</span>
                <span className="font-semibold">
                  {formatMoney(Number(order.grand_total), order.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sipariş tarihi</span>
                <span>{formatDateTime(order.placed_at)}</span>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Kargo" icon={Truck}>
            <div className="space-y-2">
              <Label>Kargo firması</Label>
              <Select
                value={carrier || "none"}
                onValueChange={(value) => setCarrier(value === "none" ? "" : value)}
              >
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
            <p className="text-xs text-muted-foreground">
              Kargo bilgileri “Kaydet” ile birlikte güncellenir.
            </p>
          </SectionCard>

          <SectionCard title="Fatura" icon={FileText}>
            <div className="space-y-2">
              <Label htmlFor="invoice-number">Fatura numarası</Label>
              <Input
                id="invoice-number"
                value={invoiceNumber}
                onChange={(event) => setInvoiceNumber(event.target.value)}
                placeholder="MFT-2026-000123"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-date">Fatura tarihi</Label>
              <Input
                id="invoice-date"
                type="date"
                value={invoicedAt}
                onChange={(event) => setInvoicedAt(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Kayıtlı fatura: {order.invoice_number ?? "—"}
              {order.invoiced_at ? ` · ${formatDate(order.invoiced_at)}` : ""}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => invoiceMutation.mutate()}
              disabled={invoiceMutation.isPending}
            >
              {invoiceMutation.isPending ? "Kaydediliyor…" : "Fatura bilgilerini kaydet"}
            </Button>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
