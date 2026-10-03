import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import { orderQuery } from "@/lib/sales-queries";

type PeekItem = { id: string; product_name?: string | null; name?: string | null; variant_title?: string | null; quantity: number; total?: number | string | null; line_total?: number | string | null };

/** Kokpit ayrıntı bölmesi: siparişten ayrılmadan özet; telefonda alttan, geniş ekranda sağdan açılır. */
export function OrderPeek({
  storeId,
  orderId,
  onOpenChange,
  statusLabel,
  paymentLabel,
  next,
  onAdvance,
  advancing,
}: {
  storeId: string;
  orderId: string | null;
  onOpenChange: (open: boolean) => void;
  statusLabel: (status: string) => string;
  paymentLabel: (status: string) => string;
  next?: (status: string) => { label: string } | undefined;
  onAdvance?: (orderId: string, status: string) => void;
  advancing?: boolean;
}) {
  const mobile = useIsMobile();
  const { data: order, isLoading } = useQuery({
    ...orderQuery(storeId, orderId ?? ""),
    enabled: Boolean(orderId),
  });
  const o = order as Record<string, any> | null | undefined;
  const items = (o?.order_items ?? []) as PeekItem[];
  const step = o ? next?.(o.status) : undefined;

  return (
    <Sheet open={Boolean(orderId)} onOpenChange={onOpenChange}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        className="seller-v2 flex max-h-[88svh] w-full flex-col gap-0 overflow-y-auto border-border bg-card p-0 sm:max-w-md md:max-h-none"
      >
        <div className="border-b border-border px-5 py-4 pr-12">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-primary">Sipariş · Hızlı bakış</p>
          <SheetTitle className="mt-1 truncate font-display text-xl">{o?.order_number ?? "Sipariş"}</SheetTitle>
          <SheetDescription className="text-xs">{o ? formatDateTime(o.placed_at) : "Yükleniyor"}</SheetDescription>
        </div>

        {isLoading || !o ? (
          <div className="space-y-3 p-5" aria-busy="true">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="space-y-5 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="rounded-xl border border-border bg-background/40 p-4">
              <p className="text-xs text-muted-foreground">Toplam</p>
              <p className="font-mono text-2xl font-semibold tabular-nums">{formatMoney(Number(o.grand_total), o.currency)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge>{statusLabel(o.status)}</Badge>
                <Badge variant="outline">{paymentLabel(o.payment_status)}</Badge>
              </div>
            </div>

            <section>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Müşteri</h3>
              <p className="font-medium">{o.customers?.full_name ?? o.customer_name ?? "Misafir"}</p>
              <p className="break-all text-sm text-muted-foreground">{o.customers?.email ?? o.customer_email ?? "—"}</p>
              {o.customers?.phone ? <p className="text-sm text-muted-foreground">{o.customers.phone}</p> : null}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ürünler ({items.length})</h3>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {items.map((item) => (
                  <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">{item.product_name ?? item.name ?? "Ürün"}</span>
                      {item.variant_title ? <span className="block truncate text-xs text-muted-foreground">{item.variant_title}</span> : null}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">×{item.quantity}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="grid gap-2">
              {step && onAdvance ? (
                <Button className="h-11" disabled={advancing} onClick={() => onAdvance(o.id, o.status)}>
                  {step.label}
                </Button>
              ) : null}
              <Button asChild variant="outline" className="h-11 gap-2">
                <Link to="/store/$storeId/orders/$orderId" params={{ storeId, orderId: o.id }}>
                  Tüm ayrıntıları aç <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
