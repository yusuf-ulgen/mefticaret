import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, ExternalLink, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { ShipmentLabels } from "@/components/shipment-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/mefti";
import {
  SHIPMENT_STATUS_LABELS,
  type ShipmentStatus,
  storeShipmentsQuery,
} from "@/lib/shipments-queries";
import { updateShipment } from "@/lib/shipments.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/shipments")({
  head: () => ({
    meta: [
      { title: "Sevkiyatlar — Mefticaret" },
      {
        name: "description",
        content:
          "Tüm siparişlerin kargo sevkiyatlarını tek ekranda izle, takip numarası ve teslim durumlarını güncelle.",
      },
      { property: "og:title", content: "Sevkiyatlar — Mefticaret" },
      {
        property: "og:description",
        content: "Kargo firmaları, takip numaraları ve teslim durumları tek merkezde.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShipmentsPage,
});

const FILTERS: { value: ShipmentStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  ...(Object.keys(SHIPMENT_STATUS_LABELS) as ShipmentStatus[]).map((value) => ({
    value,
    label: SHIPMENT_STATUS_LABELS[value],
  })),
];

function statusVariant(status: string) {
  if (status === "delivered") return "default" as const;
  if (status === "cancelled" || status === "returned") return "destructive" as const;
  return "secondary" as const;
}

function ShipmentsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ShipmentStatus | "all">("all");
  const [search, setSearch] = useState("");
  const { data: shipments, isLoading } = useQuery(storeShipmentsQuery(storeId, "all"));
  const update = useServerFn(updateShipment);

  const statusMutation = useMutation({
    mutationFn: (input: { shipmentId: string; status: ShipmentStatus }) =>
      update({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["shipments"] });
      await queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
      toast.success("Sevkiyat güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (shipments ?? []).filter((shipment) => {
      const order = shipment.orders as { order_number?: string; customer_name?: string } | null;
      const statusOk = filter === "all" || shipment.status === filter;
      const searchOk =
        term.length === 0 ||
        (shipment.tracking_number ?? "").toLowerCase().includes(term) ||
        shipment.carrier.toLowerCase().includes(term) ||
        (order?.order_number ?? "").toLowerCase().includes(term) ||
        (order?.customer_name ?? "").toLowerCase().includes(term);
      return statusOk && searchOk;
    });
  }, [shipments, filter, search]);

  const counts = useMemo(() => {
    const all = shipments ?? [];
    return {
      total: all.length,
      transit: all.filter((item) => item.status === "in_transit").length,
      delivered: all.filter((item) => item.status === "delivered").length,
    };
  }, [shipments]);

  const labelRows = useMemo(
    () =>
      rows.map((shipment) => {
        const order = shipment.orders as {
          order_number?: string;
          customer_name?: string;
        } | null;
        return {
          id: shipment.id,
          carrier: shipment.carrier,
          tracking_number: shipment.tracking_number ?? null,
          status: shipment.status,
          created_at: shipment.created_at,
          orderNumber: order?.order_number ?? "—",
          customerName: order?.customer_name ?? "Misafir",
          storeName: "Mefticaret",
          statusLabel:
            SHIPMENT_STATUS_LABELS[shipment.status as ShipmentStatus] ?? shipment.status,
        };
      }),
    [rows],
  );

  const exportCsv = () => {
    if (labelRows.length === 0) {
      toast.error("Dışa aktarılacak sevkiyat yok");
      return;
    }
    const csv = toCsv(
      ["siparis_no", "musteri", "kargo", "takip_no", "durum", "olusturma"],
      labelRows.map((row) => [
        row.orderNumber,
        row.customerName,
        row.carrier,
        row.tracking_number ?? "",
        row.statusLabel,
        row.created_at,
      ]),
    );
    downloadCsv(`sevkiyatlar-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success("CSV indirildi");
  };


  return (
    <AppShell
      storeId={storeId}
      title="Sevkiyatlar"
      description="Kargo sevkiyatlarını izle, durum ve takip bilgilerini güncelle."
    >
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="surface-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Toplam sevkiyat</p>
          <p className="mt-1 text-2xl font-semibold">{counts.total}</p>
        </div>
        <div className="surface-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Yolda</p>
          <p className="mt-1 text-2xl font-semibold">{counts.transit}</p>
        </div>
        <div className="surface-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Teslim edildi</p>
          <p className="mt-1 text-2xl font-semibold">{counts.delivered}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <Button
            key={item.value}
            size="sm"
            variant={filter === item.value ? "default" : "outline"}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </Button>
        ))}
        <Input
          className="ml-auto w-full sm:w-72"
          placeholder="Takip no, kargo firması veya sipariş ara"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <ShipmentLabels rows={labelRows} />
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="mr-2 size-4" />
          CSV indir
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <Truck className="mx-auto mb-3 size-6 text-muted-foreground" />
          <p className="font-medium">Sevkiyat bulunamadı</p>
          <p className="text-sm text-muted-foreground">
            Sipariş detay sayfasından yeni sevkiyat oluşturabilirsin.
          </p>
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Sipariş</th>
                <th className="px-4 py-3">Kargo</th>
                <th className="px-4 py-3">Takip</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Oluşturma</th>
                <th className="px-4 py-3 text-right">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((shipment) => {
                const order = shipment.orders as {
                  order_number?: string;
                  customer_name?: string;
                } | null;
                return (
                  <tr key={shipment.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        to="/store/$storeId/orders/$orderId"
                        params={{ storeId, orderId: shipment.order_id }}
                        className="hover:underline"
                      >
                        {order?.order_number ?? "—"}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {order?.customer_name ?? "Misafir"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{shipment.carrier}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        {shipment.tracking_number ?? "—"}
                        {shipment.tracking_url ? (
                          <a
                            href={shipment.tracking_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary"
                            aria-label="Takip bağlantısını aç"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(shipment.status)}>
                        {SHIPMENT_STATUS_LABELS[shipment.status as ShipmentStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(shipment.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {(["in_transit", "delivered", "cancelled"] as ShipmentStatus[]).map(
                          (value) => (
                            <Button
                              key={value}
                              size="sm"
                              variant={shipment.status === value ? "default" : "outline"}
                              disabled={
                                statusMutation.isPending || shipment.status === value
                              }
                              onClick={() =>
                                statusMutation.mutate({
                                  shipmentId: shipment.id,
                                  status: value,
                                })
                              }
                            >
                              {SHIPMENT_STATUS_LABELS[value]}
                            </Button>
                          ),
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
