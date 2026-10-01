import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatMoney } from "@/lib/mefti";
import { PO_PAYMENT_LABEL, PO_SUPPLIER_STATUS_LABEL } from "@/lib/supplier-workflow";
import {
  storePayPurchaseOrder,
  storeSendSupplierMessage,
  storeSupplierThread,
  storeSupplierWorkflow,
} from "@/lib/supplier-workflow.functions";

/** Mağaza tarafı: tedarikçi siparişlerinin takibi, kartla ödeme ve mesajlaşma. */
export function StoreSupplierWorkflow({ storeId }: { storeId: string }) {
  const load = useServerFn(storeSupplierWorkflow);
  const pay = useServerFn(storePayPurchaseOrder);
  const { data } = useQuery({ queryKey: ["store-supplier-workflow", storeId], queryFn: () => load({ data: { storeId } }), refetchInterval: 30_000 });
  const [thread, setThread] = useState<string | null>(null);
  const payMutation = useMutation({
    mutationFn: (purchaseOrderId: string) => pay({ data: { storeId, purchaseOrderId } }),
    onSuccess: (r) => {
      window.location.href = r.url;
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!data || !data.orders.length) return null;
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="font-medium">Tedarikçi takibi, ödeme ve mesajlar</h2>
      <ul className="divide-y">
        {data.orders.map((o) => (
          <li key={o.id} className="space-y-2 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{o.code} · {formatMoney(o.total, o.currency)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(o.createdAt)}
                  {o.trackingNumber ? ` · ${o.carrier ?? "Kargo"} ${o.trackingNumber}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{PO_SUPPLIER_STATUS_LABEL[o.supplierStatus]}</Badge>
                <Badge variant={o.paymentStatus === "paid" ? "default" : "outline"}>{PO_PAYMENT_LABEL[o.paymentStatus]}</Badge>
                {o.paymentStatus !== "paid" && o.status !== "cancelled" && o.payProvider ? (
                  <Button size="sm" disabled={payMutation.isPending} onClick={() => payMutation.mutate(o.id)}>
                    Kartla öde ({o.payProvider === "iyzico" ? "iyzico" : "PayTR"})
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => setThread(thread === o.supplierId ? null : o.supplierId)}>
                  Mesajlar{data.unread[o.supplierId] ? ` (${data.unread[o.supplierId]})` : ""}
                </Button>
              </div>
            </div>
            {thread === o.supplierId ? <Thread storeId={storeId} supplierId={o.supplierId} purchaseOrderId={o.id} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Thread({ storeId, supplierId, purchaseOrderId }: { storeId: string; supplierId: string; purchaseOrderId: string }) {
  const client = useQueryClient();
  const load = useServerFn(storeSupplierThread);
  const send = useServerFn(storeSendSupplierMessage);
  const key = ["store-supplier-thread", storeId, supplierId];
  const { data } = useQuery({ queryKey: key, queryFn: () => load({ data: { storeId, supplierId } }), refetchInterval: 20_000 });
  const [body, setBody] = useState("");
  const mutation = useMutation({
    mutationFn: () => send({ data: { storeId, supplierId, body, purchaseOrderId } }),
    onSuccess: () => {
      setBody("");
      void client.invalidateQueries({ queryKey: key });
      void client.invalidateQueries({ queryKey: ["store-supplier-workflow", storeId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <div className="max-h-72 space-y-2 overflow-y-auto">
        {(data ?? []).map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-lg p-2 ${m.senderRole === "store" ? "ml-auto bg-primary text-primary-foreground" : "bg-card"}`}>
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            <p className="text-[10px] opacity-70">{formatDate(m.createdAt)}</p>
          </div>
        ))}
        {data && !data.length ? <p className="text-muted-foreground">Henüz mesaj yok.</p> : null}
      </div>
      <div className="flex gap-2">
        <Textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tedarikçiye mesaj" />
        <Button disabled={!body.trim() || mutation.isPending} onClick={() => mutation.mutate()}>Gönder</Button>
      </div>
    </div>
  );
}
