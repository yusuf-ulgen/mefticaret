import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PackageCheck, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DROPSHIP_STATUS_LABEL } from "@/lib/dropshipping";
import { formatDate, formatMoney } from "@/lib/mefti";
import {
  supplierPortalOverview,
  supplierPortalUpdateOrder,
} from "@/lib/supplier-portal.functions";

export const Route = createFileRoute("/_authenticated/supplier")({
  head: () => ({
    meta: [
      { title: "Tedarikçi Paneli — Mefticaret" },
      {
        name: "description",
        content:
          "Tedarikçi paneli: gelen siparişleri ürün adı, açıklama, ürün kodu, stok kodu ve kargo firması ile görüntüleyin.",
      },
      { property: "og:title", content: "Tedarikçi Paneli — Mefticaret" },
      {
        property: "og:description",
        content: "Gelen dropshipping siparişlerini görüntüle, kargo firması ve takip numarası bildir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupplierPortalPage,
});

const CARRIERS = [
  "Aras Kargo",
  "MNG Kargo",
  "Yurtiçi Kargo",
  "PTT Kargo",
  "Sürat Kargo",
  "UPS Kargo",
  "DHL",
  "Trendyol Express",
];

function SupplierPortalPage() {
  const client = useQueryClient();
  const load = useServerFn(supplierPortalOverview);
  const update = useServerFn(supplierPortalUpdateOrder);

  const { data, isLoading, error } = useQuery({
    queryKey: ["supplier-portal"],
    queryFn: () => load({}),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (input: {
      dropshipOrderId: string;
      status?: "accepted" | "shipped" | "cancelled";
      carrier?: string;
      trackingNumber?: string;
    }) => update({ data: input }),
    onSuccess: () => {
      toast.success("Sipariş güncellendi");
      void client.invalidateQueries({ queryKey: ["supplier-portal"] });
    },
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  return (
    <AppShell title="Tedarikçi paneli">
      <div className="space-y-6">
        <header className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-3">
            <PackageCheck className="size-5 text-primary" aria-hidden />
            <div>
              <h1 className="text-lg font-medium">Gelen siparişler</h1>
              <p className="text-sm text-muted-foreground">
                Ürün adı, açıklama, ürün kodu, stok kodu ve kargo firması bilgileriyle sipariş
                hazırlığı yapın.
              </p>
            </div>
          </div>
          {data?.suppliers?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {data.suppliers.map((supplier) => (
                <Badge key={supplier.id} variant="secondary">
                  {supplier.name} · {supplier.leadTimeDays} gün tedarik
                </Badge>
              ))}
            </div>
          ) : null}
        </header>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-24 animate-pulse rounded-xl border bg-muted/40" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            {(error as Error).message}
          </div>
        ) : !data?.orders.length ? (
          <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
            Henüz size iletilmiş sipariş bulunmuyor.
          </div>
        ) : (
          <div className="space-y-4">
            {data.orders.map((order) => (
              <SupplierOrderCard
                key={order.dropshipOrderId}
                order={order}
                pending={mutation.isPending}
                onSubmit={(input) => mutation.mutate({ dropshipOrderId: order.dropshipOrderId, ...input })}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

type PortalOrder = Awaited<ReturnType<typeof supplierPortalOverview>>["orders"][number];

function SupplierOrderCard({
  order,
  pending,
  onSubmit,
}: {
  order: PortalOrder;
  pending: boolean;
  onSubmit: (input: {
    status?: "accepted" | "shipped" | "cancelled";
    carrier?: string;
    trackingNumber?: string;
  }) => void;
}) {
  const [carrier, setCarrier] = useState(order.carrier ?? "");
  const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber ?? "");

  return (
    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{order.orderNumber}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(order.orderCreatedAt)} · {order.supplierName}
          </p>
        </div>
        <Badge variant="outline">
          {DROPSHIP_STATUS_LABEL[order.dropshipStatus as keyof typeof DROPSHIP_STATUS_LABEL] ??
            order.dropshipStatus}
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Ürün</th>
              <th className="py-2">Açıklama</th>
              <th className="py-2">Ürün kodu</th>
              <th className="py-2">Stok kodu</th>
              <th className="py-2">Adet</th>
              <th className="py-2">Birim</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-t align-top">
                <td className="py-2">
                  {item.title}
                  {item.variantTitle ? (
                    <span className="text-muted-foreground"> · {item.variantTitle}</span>
                  ) : null}
                </td>
                <td className="max-w-[320px] py-2 text-muted-foreground">
                  {item.description ? item.description.slice(0, 220) : "—"}
                </td>
                <td className="py-2">{item.productCode ?? "—"}</td>
                <td className="py-2">{item.stockCode ?? "—"}</td>
                <td className="py-2">{item.quantity}</td>
                <td className="py-2">{formatMoney(item.unitPrice, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="space-y-1">
          <Label className="text-xs" htmlFor={`carrier-${order.dropshipOrderId}`}>
            Kargo firması
          </Label>
          <Input
            id={`carrier-${order.dropshipOrderId}`}
            list="mefti-carriers"
            value={carrier}
            onChange={(event) => setCarrier(event.target.value)}
            placeholder="Aras Kargo"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor={`tracking-${order.dropshipOrderId}`}>
            Takip numarası
          </Label>
          <Input
            id={`tracking-${order.dropshipOrderId}`}
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => onSubmit({ status: "accepted", carrier, trackingNumber })}
          >
            Kabul et
          </Button>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => onSubmit({ status: "shipped", carrier, trackingNumber })}
          >
            <Truck className="mr-1 size-4" aria-hidden />
            Kargoya verdim
          </Button>
        </div>
      </div>
      <datalist id="mefti-carriers">
        {CARRIERS.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </section>
  );
}
