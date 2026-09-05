import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Package, ShoppingCart, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IG_SEGMENT_LABELS, type IgCustomerSegment } from "@/lib/instagram";
import { getSocialCrmProfile } from "@/lib/instagram.functions";
import { formatDateTime, formatMoney } from "@/lib/mefti";

/** Gelen kutusunun sağ sütunundaki 360° müşteri profili: LTV, segment, sipariş ve sepet. */
export function SocialCrmPanel({
  storeId,
  conversationId,
}: {
  storeId: string;
  conversationId: string;
}) {
  const profileFn = useServerFn(getSocialCrmProfile);
  const profile = useQuery({
    queryKey: ["social-crm", storeId, conversationId],
    queryFn: () => profileFn({ data: { storeId, conversationId } }),
    staleTime: 15_000,
  });

  if (profile.isLoading) return <Skeleton className="h-40 w-full" />;
  if (profile.isError || !profile.data) return null;

  const data = profile.data;
  const currency = data.orders[0]?.currency ?? "TRY";

  return (
    <div className="surface-card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Müşteri 360°</p>
        <Badge variant="outline">
          <Sparkles className="mr-1 h-3 w-3" />
          {IG_SEGMENT_LABELS[data.segment as IgCustomerSegment] ?? data.segment}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Metric label="Yaşam boyu değer" value={formatMoney(data.lifetimeValue, currency)} />
        <Metric label="Ortalama sepet" value={formatMoney(data.averageOrderValue, currency)} />
        <Metric label="Sipariş sayısı" value={String(data.customer?.orders_count ?? 0)} />
        <Metric
          label="Son hareket"
          value={data.customer?.last_activity_at ? formatDateTime(data.customer.last_activity_at) : "—"}
        />
      </div>

      <div className="space-y-1">
        <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Package className="h-3 w-3" /> Son siparişler
        </p>
        {data.orders.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sipariş bulunmuyor.</p>
        ) : (
          data.orders.map((order) => (
            <div key={order.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate">{order.order_number}</span>
              <span className="text-muted-foreground">
                {order.status} · {formatMoney(Number(order.grand_total), order.currency)}
              </span>
            </div>
          ))
        )}
      </div>

      {data.openCarts.length > 0 ? (
        <div className="space-y-1">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <ShoppingCart className="h-3 w-3" /> Terk edilmiş sepet
          </p>
          {data.openCarts.map((cart) => (
            <div key={cart.id} className="flex items-center justify-between gap-2 text-xs">
              <span>{cart.item_count} ürün</span>
              <span className="text-muted-foreground">
                {formatMoney(Number(cart.total), cart.currency)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
