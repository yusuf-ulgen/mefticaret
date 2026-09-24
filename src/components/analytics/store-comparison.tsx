import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { PeriodPicker } from "@/components/analytics/analytics-kit";
import { Skeleton } from "@/components/ui/skeleton";
import type { PeriodInput } from "@/lib/analytics-v2";
import { getStoreComparison } from "@/lib/analytics-v2.functions";
import { formatMoney, formatNumber } from "@/lib/mefti";

/** Süper yönetici: mağazaları ciro, sipariş, ziyaretçi ve dönüşüme göre karşılaştır. */
export function StoreComparison() {
  const [period, setPeriod] = useState<PeriodInput>({ period: "30d" });
  const fn = useServerFn(getStoreComparison);
  const { data, isLoading } = useQuery({ queryKey: ["store-comparison", period], queryFn: () => fn({ data: period }) });
  const rows = data?.rows ?? [];
  return (
    <section className="surface-card space-y-3 p-4 sm:p-5">
      <h2 className="text-sm font-semibold">Mağaza karşılaştırması</h2>
      <PeriodPicker value={period} onChange={setPeriod} />
      {isLoading ? <Skeleton className="h-40" /> : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Bu dönemde veri yok.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          <li className="hidden grid-cols-[1fr_repeat(4,110px)] gap-2 pb-2 text-xs text-muted-foreground md:grid">
            <span>Mağaza</span><span className="text-right">Ciro</span><span className="text-right">Sipariş</span><span className="text-right">Ziyaretçi</span><span className="text-right">Dönüşüm</span>
          </li>
          {rows.map((r) => (
            <li key={r.store_id} className="grid grid-cols-2 gap-1 py-2 md:grid-cols-[1fr_repeat(4,110px)] md:gap-2">
              <span className="col-span-2 truncate font-medium md:col-span-1">{r.name}</span>
              <span className="tabular-nums md:text-right">{formatMoney(Number(r.revenue))}</span>
              <span className="tabular-nums text-muted-foreground md:text-right md:text-foreground">{formatNumber(Number(r.orders))} sipariş</span>
              <span className="tabular-nums text-muted-foreground md:text-right md:text-foreground">{formatNumber(Number(r.visitors))} ziyaretçi</span>
              <span className="tabular-nums text-muted-foreground md:text-right md:text-foreground">%{(Number(r.conversion_rate) * 100).toFixed(1)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
