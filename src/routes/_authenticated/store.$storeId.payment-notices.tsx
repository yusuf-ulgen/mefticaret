import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/mefti";
import { resolvePaymentNoticeFn } from "@/lib/payment-notices.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/payment-notices")({
  head: () => ({
    meta: [
      { title: "Ödeme Bildirimleri — Mefticaret" },
      { name: "description", content: "Havale/EFT ile ödeme bekleyen siparişleri onaylayın veya reddedin." },
      { property: "og:title", content: "Ödeme Bildirimleri — Mefticaret" },
      { property: "og:description", content: "Ödeme bekleyen siparişleri tek ekrandan yönetin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PaymentNoticesPage,
});

const RECEIPT_LABEL: Record<string, string> = {
  matched: "Dekont tutarı eşleşti",
  mismatch: "Dekont tutarı farklı",
  unreadable: "Dekont okunamadı",
};

function PaymentNoticesPage() {
  const { storeId } = Route.useParams();
  const qc = useQueryClient();
  const resolveFn = useServerFn(resolvePaymentNoticeFn);

  const { data, isLoading, error } = useQuery({
    queryKey: ["payment-notices", storeId],
    queryFn: async () => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, order_number, created_at, customer_name, customer_phone, grand_total, currency, status")
        .eq("store_id", storeId)
        .eq("payment_status", "pending")
        .not("status", "in", "(cancelled,refunded,returned)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const ids = (orders ?? []).map((o) => o.id);
      const receipts = new Map<string, string>();
      if (ids.length) {
        const { data: checks } = await supabase
          .from("kolay_receipt_checks")
          .select("order_id, status, created_at")
          .in("order_id", ids)
          .order("created_at", { ascending: false });
        for (const c of checks ?? []) if (c.order_id && !receipts.has(c.order_id)) receipts.set(c.order_id, c.status);
      }
      return (orders ?? []).map((o) => ({ ...o, receipt: receipts.get(o.id) ?? null }));
    },
  });

  const act = useMutation({
    mutationFn: (v: { orderId: string; action: "confirm" | "reject" }) => resolveFn({ data: { storeId, ...v } }),
    onSuccess: (_r, v) => {
      toast.success(v.action === "confirm" ? "Ödeme onaylandı" : "Ödeme bildirimi reddedildi");
      void qc.invalidateQueries({ queryKey: ["payment-notices", storeId] });
      void qc.invalidateQueries({ queryKey: ["orders", storeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "İşlem yapılamadı"),
  });

  return (
    <AppShell storeId={storeId} title="Ödeme Bildirimleri" description="Havale/EFT ile ödeme bekleyen siparişler. Paranın hesabınıza geçtiğini gördükten sonra onaylayın.">
      <div className="p-4 sm:p-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        ) : error ? (
          <p className="text-sm text-destructive">Liste yüklenemedi: {(error as Error).message}</p>
        ) : !data?.length ? (
          <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Ödeme bekleyen sipariş yok.</p>
        ) : (
          <div className="space-y-2">
            {data.map((o) => (
              <div key={o.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <Link to="/store/$storeId/orders/$orderId" params={{ storeId, orderId: o.id }} className="font-semibold hover:underline">
                    {o.order_number}
                  </Link>
                  <div className="text-sm text-muted-foreground">
                    {o.customer_name ?? "—"} · {new Date(o.created_at).toLocaleString("tr-TR")}
                  </div>
                  {o.receipt && <div className="mt-1 text-xs font-medium">{RECEIPT_LABEL[o.receipt] ?? o.receipt}</div>}
                </div>
                <div className="text-lg font-semibold tabular-nums">{formatMoney(Number(o.grand_total), o.currency)}</div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ orderId: o.id, action: "confirm" })}>
                    <Check className="size-4" /> Ödeme alındı
                  </Button>
                  <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ orderId: o.id, action: "reject" })}>
                    <X className="size-4" /> Reddet
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
