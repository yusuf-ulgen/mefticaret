import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { downloadCsv, toCsv } from "@/lib/csv";
import { ordersQuery, type OrderStatus } from "@/lib/sales-queries";
import { updateOrder } from "@/lib/sales.functions";
import {
  formatDateTime,
  formatMoney,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
} from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/orders")({
  head: () => ({
    meta: [
      { title: "Siparişler — Mefticaret" },
      {
        name: "description",
        content:
          "Mağazanın siparişlerini durum, ödeme ve kargo bilgisine göre takip et ve yönet.",
      },
      { property: "og:title", content: "Siparişler — Mefticaret" },
      {
        property: "og:description",
        content: "Sipariş akışı, ödeme durumu ve kargo takibi tek ekranda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrdersPage,
});

const FILTERS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "pending", label: "Bekliyor" },
  { value: "processing", label: "Hazırlanıyor" },
  { value: "shipped", label: "Kargoda" },
  { value: "delivered", label: "Teslim" },
  { value: "cancelled", label: "İptal" },
  { value: "refunded", label: "İade" },
];

function statusVariant(status: string) {
  if (status === "delivered") return "default" as const;
  if (status === "cancelled" || status === "refunded") return "destructive" as const;
  return "secondary" as const;
}

function OrdersPage() {
  const { storeId } = Route.useParams();
  const { data: orders, isLoading } = useQuery(ordersQuery(storeId));
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (orders ?? []).filter((order) => {
      const statusOk = filter === "all" || order.status === filter;
      const searchOk =
        term.length === 0 ||
        order.order_number.toLowerCase().includes(term) ||
        (order.customer_name ?? "").toLowerCase().includes(term) ||
        (order.customer_email ?? "").toLowerCase().includes(term);
      return statusOk && searchOk;
    });
  }, [orders, filter, search]);

  const revenue = (orders ?? [])
    .filter((order) => order.payment_status === "paid")
    .reduce((sum, order) => sum + Number(order.grand_total), 0);

  const queryClient = useQueryClient();
  const update = useServerFn(updateOrder);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>("processing");

  const visibleIds = rows.map((order) => order.id);
  const selectedVisible = selected.filter((id) => visibleIds.includes(id));
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;

  const toggleOne = (id: string, checked: boolean) =>
    setSelected((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));

  const bulkMutation = useMutation({
    mutationFn: async () => {
      for (const orderId of selectedVisible) {
        await update({ data: { orderId, patch: { status: bulkStatus as never } } });
      }
    },
    onSuccess: async () => {
      const count = selectedVisible.length;
      setSelected([]);
      await queryClient.invalidateQueries({ queryKey: ["orders", storeId] });
      toast.success(`${count} sipariş güncellendi`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const exportCsv = () => {
    const source = selectedVisible.length > 0 ? rows.filter((o) => selectedVisible.includes(o.id)) : rows;
    const csv = toCsv(
      ["siparis_no", "musteri", "eposta", "durum", "odeme", "adet", "toplam", "para_birimi", "tarih"],
      source.map((order) => [
        order.order_number,
        order.customer_name ?? "",
        order.customer_email ?? "",
        ORDER_STATUS_LABELS[order.status],
        PAYMENT_STATUS_LABELS[order.payment_status],
        (order.order_items ?? []).reduce(
          (sum: number, item: { quantity: number }) => sum + item.quantity,
          0,
        ),
        Number(order.grand_total),
        order.currency,
        order.placed_at,
      ]),
    );
    downloadCsv(`siparisler-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };


  return (
    <AppShell
      storeId={storeId}
      title="Siparişler"
      description="Sipariş akışını, ödeme ve kargo durumlarını buradan yönet."
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="surface-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Toplam sipariş</p>
          <p className="mt-1 text-2xl font-semibold">{(orders ?? []).length}</p>
        </div>
        <div className="surface-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Ödenmiş ciro</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(revenue)}</p>
        </div>
        <div className="surface-card p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Bekleyen</p>
          <p className="mt-1 text-2xl font-semibold">
            {(orders ?? []).filter((order) => order.status === "pending").length}
          </p>
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
          className="ml-auto w-full sm:w-64"
          placeholder="Sipariş no veya müşteri ara"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button size="sm" variant="outline" className="gap-2" onClick={exportCsv}>
          <Download className="size-4" /> CSV
        </Button>
      </div>

      {selectedVisible.length > 0 ? (
        <div className="surface-card mb-4 flex flex-wrap items-center gap-3 p-4">
          <p className="text-sm font-medium">{selectedVisible.length} sipariş seçildi</p>
          <Select value={bulkStatus} onValueChange={(value) => setBulkStatus(value as OrderStatus)}>
            <SelectTrigger className="w-44">
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
          <Button
            size="sm"
            disabled={bulkMutation.isPending}
            onClick={() => bulkMutation.mutate()}
          >
            {bulkMutation.isPending ? "Uygulanıyor…" : "Durumu uygula"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Seçimi temizle
          </Button>
        </div>
      ) : null}


      {isLoading ? (
        <p className="text-muted-foreground">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <ShoppingBag className="mx-auto mb-3 size-6 text-muted-foreground" />
          <p className="font-medium">Sipariş bulunamadı</p>
          <p className="text-sm text-muted-foreground">Filtreyi değiştirip tekrar dene.</p>
        </div>
      ) : (
        <div className="surface-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) =>
                      setSelected(checked === true ? visibleIds : [])
                    }
                    aria-label="Tümünü seç"
                  />
                </th>
                <th className="px-4 py-3">Sipariş</th>
                <th className="px-4 py-3">Müşteri</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Ödeme</th>
                <th className="px-4 py-3">Ürün</th>
                <th className="px-4 py-3 text-right">Toplam</th>
                <th className="px-4 py-3">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr key={order.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selected.includes(order.id)}
                      onCheckedChange={(checked) => toggleOne(order.id, checked === true)}
                      aria-label={`${order.order_number} seç`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      to="/store/$storeId/orders/$orderId"
                      params={{ storeId, orderId: order.id }}
                      className="hover:underline"
                    >
                      {order.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block">{order.customer_name ?? "Misafir"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {order.customer_email ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(order.status)}>
                      {ORDER_STATUS_LABELS[order.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {PAYMENT_STATUS_LABELS[order.payment_status]}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(order.order_items ?? []).reduce(
                      (sum: number, item: { quantity: number }) => sum + item.quantity,
                      0,
                    )}{" "}
                    adet
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {formatMoney(Number(order.grand_total), order.currency)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDateTime(order.placed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
