import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DROPSHIP_STATUS_LABEL } from "@/lib/dropshipping";
import { dropshipOrdersQuery } from "@/lib/dropshipping-queries";
import { dispatchDropshipOrder } from "@/lib/dropshipping.functions";
import { suppliersQuery } from "@/lib/purchasing-queries";

/**
 * Sipariş detayında dropshipping gönderimi: tedarikçi seçilip sipariş
 * tedarikçinin uç noktasına iletilir; uç nokta yoksa kuyruğa alınır.
 */
export function DropshipPanel({ storeId, orderId }: { storeId: string; orderId: string }) {
  const queryClient = useQueryClient();
  const { data: suppliers } = useQuery(suppliersQuery(storeId));
  const { data: dropshipOrders } = useQuery(dropshipOrdersQuery(storeId));
  const dispatchFn = useServerFn(dispatchDropshipOrder);
  const [supplierId, setSupplierId] = useState("");

  const existing = (dropshipOrders ?? []).filter((row) => row.order_id === orderId);
  const dropshipSuppliers = (suppliers ?? []).filter(
    (supplier) => supplier.is_active && (supplier as { is_dropship?: boolean }).is_dropship,
  );

  const dispatchMutation = useMutation({
    mutationFn: async () =>
      dispatchFn({ data: { storeId, orderId, supplierId: supplierId || null } }),
    onSuccess: (result) => {
      if (result.status === "failed") toast.error(result.error ?? "Gönderim başarısız");
      else if (result.status === "sent") toast.success("Sipariş tedarikçiye iletildi");
      else toast.success("Sipariş tedarikçi kuyruğuna alındı");
      void queryClient.invalidateQueries({ queryKey: ["dropship-orders", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="surface-card space-y-4 p-6">
      <div className="flex items-center gap-2">
        <Truck className="size-4 text-muted-foreground" />
        <h2 className="font-display text-lg font-semibold">Dropshipping</h2>
      </div>

      {existing.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {existing.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {row.suppliers?.name ?? "Tedarikçi seçilmedi"}
                {row.external_ref ? ` · ${row.external_ref}` : ""}
              </span>
              <Badge variant={row.status === "failed" ? "destructive" : "secondary"}>
                {DROPSHIP_STATUS_LABEL[row.status]}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2">
        <Label>Tedarikçi</Label>
        <select
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          value={supplierId}
          onChange={(event) => setSupplierId(event.target.value)}
        >
          <option value="">Tedarikçi seçin</option>
          {dropshipSuppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.name}
            </option>
          ))}
        </select>
        {dropshipSuppliers.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Dropshipping tedarikçisi tanımlı değil. Dropshipping &amp; XML ekranından tedarikçiyi
            dropshipping olarak işaretleyin.
          </p>
        ) : null}
      </div>

      <Button
        size="sm"
        disabled={!supplierId || dispatchMutation.isPending}
        onClick={() => dispatchMutation.mutate()}
      >
        Tedarikçiye gönder
      </Button>
    </section>
  );
}
