import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { inventoryQuery } from "@/lib/inventory-queries";
import { formatDateTime } from "@/lib/mefti";
import {
  TRANSFER_STATUS_LABELS,
  stockTransfersQuery,
  warehousesQuery,
} from "@/lib/warehouses-queries";
import {
  cancelStockTransfer,
  createStockTransfer,
  receiveStockTransfer,
  shipStockTransfer,
} from "@/lib/warehouses.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/transfers")({
  head: () => ({
    meta: [
      { title: "Depo Transferleri — Mefticaret" },
      {
        name: "description",
        content:
          "Depolar ve şubeler arası stok transferi oluştur, sevk et, teslim al veya iptal et; her adım denetim izine yazılır.",
      },
      { property: "og:title", content: "Depo Transferleri — Mefticaret" },
      {
        property: "og:description",
        content: "Depolar arası stok transfer akışı: taslak, yolda, teslim alındı.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransfersPage,
});

type DraftItem = { variantId: string; quantity: string };

function TransfersPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: transfers, isLoading } = useQuery(stockTransfersQuery(storeId));
  const { data: warehouses } = useQuery(warehousesQuery(storeId));
  const { data: variants } = useQuery(inventoryQuery(storeId));

  const create = useServerFn(createStockTransfer);
  const ship = useServerFn(shipStockTransfer);
  const receive = useServerFn(receiveStockTransfer);
  const cancel = useServerFn(cancelStockTransfer);

  const [open, setOpen] = useState(false);
  const [fromWarehouse, setFromWarehouse] = useState("");
  const [toWarehouse, setToWarehouse] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ variantId: "", quantity: "1" }]);

  const warehouseName = useMemo(() => {
    const map = new Map((warehouses ?? []).map((item) => [item.id, item.name]));
    return (id: string) => map.get(id) ?? "Depo";
  }, [warehouses]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["stock-transfers", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["inventory-levels", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["inventory", storeId] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      create({
        data: {
          storeId,
          fromWarehouseId: fromWarehouse,
          toWarehouseId: toWarehouse,
          note: note || undefined,
          items: items
            .filter((item) => item.variantId && Number(item.quantity) > 0)
            .map((item) => ({ variantId: item.variantId, quantity: Number(item.quantity) })),
        },
      }),
    onSuccess: async (result) => {
      await invalidate();
      setOpen(false);
      setItems([{ variantId: "", quantity: "1" }]);
      setNote("");
      toast.success(`Transfer oluşturuldu: ${result.code}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const actionMutation = useMutation({
    mutationFn: (input: { transferId: string; action: "ship" | "receive" | "cancel" }) => {
      const payload = { data: { storeId, transferId: input.transferId } };
      if (input.action === "ship") return ship(payload);
      if (input.action === "receive") return receive(payload);
      return cancel(payload);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Transfer güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canSubmit =
    fromWarehouse &&
    toWarehouse &&
    fromWarehouse !== toWarehouse &&
    items.some((item) => item.variantId && Number(item.quantity) > 0);

  return (
    <AppShell
      storeId={storeId}
      title="Depo Transferleri"
      description="Depolar ve şubeler arası stok hareketlerini yönet."
      actions={
        <Button
          type="button"
          onClick={() => {
            setFromWarehouse(warehouses?.[0]?.id ?? "");
            setToWarehouse(warehouses?.[1]?.id ?? "");
            setOpen(true);
          }}
        >
          <Plus className="mr-2 size-4" />
          Yeni transfer
        </Button>
      }
    >
      <div className="surface-card divide-y divide-border/50">
        {isLoading ? (
          <p className="p-6 text-muted-foreground">Yükleniyor…</p>
        ) : (transfers ?? []).length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            Henüz transfer yok. Depolar arası ilk sevkiyatı oluşturun.
          </p>
        ) : (
          (transfers ?? []).map((transfer) => (
            <div key={transfer.id} className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-mono text-sm font-semibold">{transfer.code}</p>
                <Badge
                  variant={
                    transfer.status === "received"
                      ? "default"
                      : transfer.status === "cancelled"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {TRANSFER_STATUS_LABELS[transfer.status]}
                </Badge>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {warehouseName(transfer.from_warehouse_id)}
                  <ArrowRight className="size-3.5" />
                  {warehouseName(transfer.to_warehouse_id)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(transfer.created_at)}
                </span>
                <div className="ml-auto flex gap-2">
                  {transfer.status === "draft" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          actionMutation.mutate({ transferId: transfer.id, action: "ship" })
                        }
                      >
                        Sevk et
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          actionMutation.mutate({ transferId: transfer.id, action: "cancel" })
                        }
                      >
                        İptal
                      </Button>
                    </>
                  ) : null}
                  {transfer.status === "in_transit" ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        actionMutation.mutate({ transferId: transfer.id, action: "receive" })
                      }
                    >
                      Teslim al
                    </Button>
                  ) : null}
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                {transfer.stock_transfer_items.map((item) => (
                  <li key={item.id}>
                    {item.title} · {item.quantity} adet
                    {item.sku ? ` · ${item.sku}` : ""}
                    {transfer.status === "received"
                      ? ` · teslim: ${item.received_quantity}`
                      : ""}
                  </li>
                ))}
              </ul>
              {transfer.note ? (
                <p className="mt-2 text-xs text-muted-foreground">{transfer.note}</p>
              ) : null}
            </div>
          ))
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full max-w-lg space-y-4 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Yeni depo transferi</SheetTitle>
            <SheetDescription>
              Kaynak depodan çıkış, hedef depoya “yolda” olarak işlenir.
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kaynak depo</Label>
              <Select value={fromWarehouse} onValueChange={setFromWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Seç" />
                </SelectTrigger>
                <SelectContent>
                  {(warehouses ?? []).map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hedef depo</Label>
              <Select value={toWarehouse} onValueChange={setToWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Seç" />
                </SelectTrigger>
                <SelectContent>
                  {(warehouses ?? []).map((warehouse) => (
                    <SelectItem key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Kalemler</Label>
            {items.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={item.variantId}
                  onValueChange={(next) =>
                    setItems((prev) =>
                      prev.map((row, i) => (i === index ? { ...row, variantId: next } : row)),
                    )
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Varyant seç" />
                  </SelectTrigger>
                  <SelectContent>
                    {(variants ?? []).map((variant) => (
                      <SelectItem key={variant.id} value={variant.id}>
                        {(variant.products?.title ?? "Ürün") + " · " + variant.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="w-20"
                  type="number"
                  min={1}
                  value={item.quantity}
                  aria-label="Miktar"
                  onChange={(event) =>
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === index ? { ...row, quantity: event.target.value } : row,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Kalemi kaldır"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setItems((prev) => [...prev, { variantId: "", quantity: "1" }])}
            >
              <Plus className="mr-2 size-4" />
              Kalem ekle
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transfer-note">Not</Label>
            <Textarea
              id="transfer-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Sevkiyat notu"
            />
          </div>

          <Button
            className="w-full"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Oluşturuluyor…" : "Transfer oluştur"}
          </Button>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
