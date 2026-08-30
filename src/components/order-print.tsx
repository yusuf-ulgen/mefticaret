import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { storeQuery, storeSettingsQuery } from "@/lib/store-queries";
import { formatDateTime, formatMoney } from "@/lib/mefti";

type Item = {
  id: string;
  title: string;
  variant_title: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

type AddressShape = Record<string, unknown> | null;

export type PrintableOrder = {
  order_number: string;
  placed_at: string;
  currency: string;
  subtotal: number | string;
  discount_total: number | string;
  shipping_total: number | string;
  tax_total: number | string;
  grand_total: number | string;
  customer_name: string | null;
  customer_email: string | null;
  shipping_address: AddressShape;
  billing_address: AddressShape;
  note: string | null;
};

function addressLines(address: AddressShape) {
  if (!address) return [] as string[];
  const get = (key: string) => {
    const value = address[key];
    return typeof value === "string" && value.trim() ? value.trim() : "";
  };
  return [
    get("recipient"),
    get("phone"),
    [get("line1"), get("line2")].filter(Boolean).join(" "),
    [get("district"), get("city"), get("postal_code"), get("country")].filter(Boolean).join(" / "),
  ].filter(Boolean);
}

/** Sipariş fişi / fatura önizlemesi — yazdırmaya hazır sade düzen. */
export function OrderPrintDialog({
  storeId,
  order,
  items,
}: {
  storeId: string;
  order: PrintableOrder;
  items: Item[];
}) {
  const [open, setOpen] = useState(false);
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: settings } = useQuery(storeSettingsQuery(storeId));

  const seller = settings?.legal_name || store?.name || "Mağaza";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Printer className="size-4" /> Fiş yazdır
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader className="print:hidden">
          <DialogTitle>Sipariş fişi</DialogTitle>
          <DialogDescription>
            Kargo paketine koymak veya arşivlemek için yazdırabilirsin.
          </DialogDescription>
        </DialogHeader>

        <div id="order-print-area" className="space-y-5 rounded-lg bg-background p-2 text-sm">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-lg font-semibold">{seller}</p>
              {settings?.tax_number ? (
                <p className="text-xs text-muted-foreground">
                  Vergi no: {settings.tax_number}
                </p>
              ) : null}
              {settings?.contact_email ? (
                <p className="text-xs text-muted-foreground">{settings.contact_email}</p>
              ) : null}
              {settings?.contact_phone ? (
                <p className="text-xs text-muted-foreground">{settings.contact_phone}</p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="font-semibold">Sipariş {order.order_number}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(order.placed_at)}</p>
            </div>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <PrintAddress title="Teslimat adresi" lines={addressLines(order.shipping_address)} />
            <PrintAddress title="Fatura adresi" lines={addressLines(order.billing_address)} />
          </div>

          <div className="text-xs text-muted-foreground">
            Müşteri: {order.customer_name ?? "Misafir"}
            {order.customer_email ? ` · ${order.customer_email}` : ""}
          </div>

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2">Ürün</th>
                <th className="py-2">SKU</th>
                <th className="py-2 text-right">Adet</th>
                <th className="py-2 text-right">Birim</th>
                <th className="py-2 text-right">Toplam</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-border/60">
                  <td className="py-2">
                    {item.title}
                    {item.variant_title ? (
                      <span className="block text-xs text-muted-foreground">
                        {item.variant_title}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">{item.sku ?? "—"}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right">
                    {formatMoney(Number(item.unit_price), order.currency)}
                  </td>
                  <td className="py-2 text-right font-medium">
                    {formatMoney(Number(item.line_total), order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto w-full max-w-xs space-y-1">
            <Row label="Ara toplam" value={formatMoney(Number(order.subtotal), order.currency)} />
            <Row
              label="İndirim"
              value={`-${formatMoney(Number(order.discount_total), order.currency)}`}
            />
            <Row label="Kargo" value={formatMoney(Number(order.shipping_total), order.currency)} />
            <Row label="Vergi" value={formatMoney(Number(order.tax_total), order.currency)} />
            <div className="flex justify-between border-t border-border pt-1 text-base font-semibold">
              <span>Genel toplam</span>
              <span>{formatMoney(Number(order.grand_total), order.currency)}</span>
            </div>
          </div>

          {order.note ? (
            <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
              Not: {order.note}
            </p>
          ) : null}

          <p className="pt-2 text-center text-xs text-muted-foreground">
            Bizi tercih ettiğiniz için teşekkür ederiz.
          </p>
        </div>

        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Kapat
          </Button>
          <Button className="gap-2" onClick={() => window.print()}>
            <Printer className="size-4" /> Yazdır
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PrintAddress({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
      {lines.length === 0 ? (
        <p className="pt-1 text-xs text-muted-foreground">—</p>
      ) : (
        lines.map((line) => (
          <p key={line} className="pt-0.5 text-sm">
            {line}
          </p>
        ))
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
