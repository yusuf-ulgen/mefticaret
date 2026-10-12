import { useSection } from "@/components/analytics/analytics-sections";
import { Empty } from "@/components/analytics/analytics-kit";
import type { LiveData } from "@/lib/analytics-v2";
import { formatMoney, formatNumber, ORDER_STATUS_LABELS } from "@/lib/mefti";

/** Son 5 dakikada hangi sayfalarda kaç kişi var + son 5 sipariş (30 sn yenileme). */
export function LivePagesPanel({ storeId }: { storeId: string }) {
  const q = useSection<LiveData>(storeId, "live", { period: "today" }, undefined, 30_000);
  const d = q.data?.value;
  return (
    <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section className="surface-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Şu an hangi sayfalardalar <span className="font-normal text-muted-foreground">· son 5 dk · {formatNumber(d?.active_visitors ?? 0)} kişi</span></h2>
        {!d || d.pages.length === 0 ? <Empty text="Şu an sitede kimse yok." /> : (
          <ul className="divide-y divide-border text-sm">
            {d.pages.map((p) => (
              <li key={p.path} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0"><span className="block truncate">{p.title || p.path}</span>{p.title ? <span className="block truncate text-xs text-muted-foreground">{p.path}</span> : null}</span>
                <span className="shrink-0 tabular-nums font-medium">{p.visitors}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="surface-card p-5">
        <h2 className="mb-3 text-sm font-semibold">Son 5 sipariş</h2>
        {!d || d.recent_orders.length === 0 ? <Empty text="Henüz sipariş yok." /> : (
          <ul className="divide-y divide-border text-sm">
            {d.recent_orders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate">#{o.order_number} <span className="text-muted-foreground">· {o.city ?? "—"} · {ORDER_STATUS_LABELS[o.status] ?? o.status}</span></span>
                <span className="shrink-0 tabular-nums">{formatMoney(Number(o.grand_total), o.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
