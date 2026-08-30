import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PackageOpen, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import {
  RETURN_REASON_LABELS,
  RETURN_STATUS_LABELS,
  returnableOrdersQuery,
  storeReturnsQuery,
  type ReturnReason,
  type ReturnStatus,
} from "@/lib/returns-queries";
import { createReturn, updateReturn } from "@/lib/returns.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/returns")({
  head: () => ({
    meta: [
      { title: "İadeler & Geri Ödemeler — Mefticaret" },
      {
        name: "description",
        content:
          "İade taleplerini onayla, ürünleri stoğa geri al ve geri ödemeleri finans defterine işle.",
      },
      { property: "og:title", content: "İadeler & Geri Ödemeler — Mefticaret" },
      {
        property: "og:description",
        content: "Mefticaret iade yönetimi: talep, onay, stok geri alımı ve geri ödeme.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReturnsPage,
});

const FILTERS: { value: ReturnStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "requested", label: "Talep edildi" },
  { value: "approved", label: "Onaylandı" },
  { value: "received", label: "Teslim alındı" },
  { value: "refunded", label: "İade edildi" },
];

const STATUS_TONE: Record<ReturnStatus, string> = {
  requested: "bg-amber-500/15 text-amber-600",
  approved: "bg-sky-500/15 text-sky-600",
  received: "bg-violet-500/15 text-violet-600",
  refunded: "bg-emerald-500/15 text-emerald-600",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
};

const NEXT_STATUSES: ReturnStatus[] = [
  "requested",
  "approved",
  "received",
  "refunded",
  "rejected",
  "cancelled",
];

function NewReturnSheet({ storeId, onDone }: { storeId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState<string>("");
  const [reason, setReason] = useState<ReturnReason>("changed_mind");
  const [restock, setRestock] = useState(true);
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const ordersQuery = useQuery({ ...returnableOrdersQuery(storeId), enabled: open });
  const orders = ordersQuery.data ?? [];
  const order = orders.find((row) => row.id === orderId);

  const create = useServerFn(createReturn);
  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof create>[0]["data"]) => create({ data: input }),
    onSuccess: () => {
      toast.success("İade talebi oluşturuldu");
      setOpen(false);
      setOrderId("");
      setQuantities({});
      setNote("");
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const selected = Object.entries(quantities).filter(([, qty]) => qty > 0);
  const total = useMemo(
    () =>
      selected.reduce((sum, [itemId, qty]) => {
        const item = order?.order_items?.find((row) => row.id === itemId);
        return sum + Number(item?.unit_price ?? 0) * qty;
      }, 0),
    [selected, order],
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" /> İade talebi oluştur
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Yeni iade talebi</SheetTitle>
          <SheetDescription>
            Ödemesi alınmış bir siparişi seçin ve iade edilecek kalemleri belirtin.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label>Sipariş</Label>
            <Select
              value={orderId}
              onValueChange={(value) => {
                setOrderId(value);
                setQuantities({});
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sipariş seçin" />
              </SelectTrigger>
              <SelectContent>
                {orders.map((row) => (
                  <SelectItem key={row.id} value={row.id}>
                    {row.order_number} — {row.customer_name ?? "Misafir"} (
                    {formatMoney(Number(row.grand_total), row.currency)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!ordersQuery.isLoading && orders.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Ödemesi tamamlanmış sipariş bulunamadı.
              </p>
            )}
          </div>

          {order && (
            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              {(order.order_items ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.variant_title ?? "Tek varyant"} · {item.quantity} adet ·{" "}
                      {formatMoney(Number(item.unit_price), order.currency)}
                    </p>
                  </div>
                  <Input
                    className="w-20"
                    type="number"
                    min={0}
                    max={item.quantity}
                    value={quantities[item.id] ?? 0}
                    onChange={(event) =>
                      setQuantities((prev) => ({
                        ...prev,
                        [item.id]: Math.max(
                          0,
                          Math.min(item.quantity, Number(event.target.value) || 0),
                        ),
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label>İade sebebi</Label>
            <Select value={reason} onValueChange={(value) => setReason(value as ReturnReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RETURN_REASON_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="return-note">Not</Label>
            <Textarea
              id="return-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Müşteri açıklaması"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={restock} onCheckedChange={(value) => setRestock(Boolean(value))} />
            Ürünler teslim alındığında stoğa geri eklensin
          </label>

          <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Tahmini iade tutarı</span>
            <span className="font-semibold">
              {formatMoney(total, order?.currency ?? "TRY")}
            </span>
          </div>

          <Button
            className="w-full"
            disabled={!order || selected.length === 0 || mutation.isPending}
            onClick={() =>
              mutation.mutate({
                orderId: order!.id,
                reason,
                restock,
                customerNote: note || undefined,
                items: selected.map(([itemId, qty]) => ({ orderItemId: itemId, quantity: qty })),
              })
            }
          >
            İade talebini kaydet
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ReturnsPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ReturnStatus | "all">("all");

  const returnsQuery = useQuery(storeReturnsQuery(storeId, filter));
  const rows = returnsQuery.data ?? [];

  const update = useServerFn(updateReturn);
  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof update>[0]["data"]) => update({ data: input }),
    onSuccess: () => {
      toast.success("İade güncellendi");
      void queryClient.invalidateQueries({ queryKey: ["returns", storeId] });
      void queryClient.invalidateQueries({ queryKey: ["inventory", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pendingCount = rows.filter((row) => row.status === "requested").length;
  const refundTotal = rows
    .filter((row) => row.status === "refunded")
    .reduce((sum, row) => sum + Number(row.refund_amount ?? 0), 0);

  return (
    <AppShell
      storeId={storeId}
      title="İadeler & Geri Ödemeler"
      description="İade taleplerini yönetin, ürünleri stoğa geri alın ve geri ödemeleri finans defterine işleyin."
      actions={
        <NewReturnSheet
          storeId={storeId}
          onDone={() => queryClient.invalidateQueries({ queryKey: ["returns", storeId] })}
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Toplam talep</p>
          <p className="mt-1 text-2xl font-semibold">{rows.length}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Bekleyen</p>
          <p className="mt-1 text-2xl font-semibold">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Geri ödenen tutar
          </p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(refundTotal, "TRY")}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
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
      </div>

      <div className="mt-4 space-y-4">
        {returnsQuery.isLoading && (
          <p className="text-sm text-muted-foreground">İadeler yükleniyor…</p>
        )}
        {!returnsQuery.isLoading && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center">
            <PackageOpen className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Bu filtrede iade talebi bulunmuyor.
            </p>
          </div>
        )}

        {rows.map((row) => {
          const status = row.status as ReturnStatus;
          return (
            <article
              key={row.id}
              className="rounded-2xl border border-border/60 bg-card p-4 sm:p-5"
            >
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{row.return_number}</h3>
                    <Badge className={STATUS_TONE[status]} variant="secondary">
                      {RETURN_STATUS_LABELS[status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.orders?.order_number ?? "—"} ·{" "}
                    {row.orders?.customer_name ?? "Misafir"} ·{" "}
                    {RETURN_REASON_LABELS[row.reason as ReturnReason]} ·{" "}
                    {formatDateTime(row.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">
                    {formatMoney(Number(row.refund_amount ?? 0), row.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.restock ? "Stoğa geri eklenir" : "Stoğa eklenmez"}
                  </p>
                </div>
              </header>

              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {(row.return_items ?? []).map((item) => (
                  <li key={item.id}>
                    {item.quantity} × {item.title}
                    {item.variant_title ? ` — ${item.variant_title}` : ""} ·{" "}
                    {formatMoney(Number(item.line_total), row.currency)}
                  </li>
                ))}
              </ul>

              {row.customer_note && (
                <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">{row.customer_note}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Select
                  value={status}
                  onValueChange={(value) =>
                    mutation.mutate({ returnId: row.id, status: value as ReturnStatus })
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NEXT_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {RETURN_STATUS_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="w-32"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={Number(row.refund_amount ?? 0)}
                  onBlur={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value) && value !== Number(row.refund_amount ?? 0)) {
                      mutation.mutate({ returnId: row.id, refundAmount: value });
                    }
                  }}
                  aria-label="İade tutarı"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={status === "refunded" || mutation.isPending}
                  onClick={() => mutation.mutate({ returnId: row.id, status: "refunded" })}
                >
                  <RotateCcw className="mr-2 size-4" /> Geri ödemeyi tamamla
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}
