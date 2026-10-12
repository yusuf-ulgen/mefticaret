import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { getGrowthDashboard } from "@/lib/growth-export.functions";

type Props = { storeId: string };

/** Büyüme panosu: influencer ROI, iade oranı, depo stok dağılımı, gümrük vergisi özeti. */
export function GrowthWidgets({ storeId }: Props) {
  const fetchDashboard = useServerFn(getGrowthDashboard);
  const { data, isLoading } = useQuery(
    queryOptions({
      queryKey: ["growth-dashboard", storeId],
      queryFn: () => fetchDashboard({ data: { storeId, days: 90 } as never }),
    }),
  );

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Büyüme verileri yükleniyor…</p>;
  }
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Sipariş (90 gün)" value={String(data.totalOrders)} />
        <Card title="İade" value={String(data.totalReturns)} />
        <Card
          title="İade oranı"
          value={`${data.totalOrders > 0 ? Math.round((data.totalReturns / data.totalOrders) * 1000) / 10 : 0}%`}
        />
        <Card title="Bekleyen komisyon" value={data.pendingCommission.toFixed(2)} />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">Influencer / ortak getirisi</h3>
        {data.influencerRoi.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Henüz ortak verisi yok.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.influencerRoi.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
                <span>
                  {row.name} · {row.country} · {row.orders} sipariş
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {row.revenue.toFixed(2)} ciro · {row.commission.toFixed(2)} {row.payoutCurrency}
                  </Badge>
                  {row.roi ? <Badge variant="outline">ROI {row.roi}x</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Ülke bazlı iade oranı</h3>
          {data.returnAnalytics.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Veri yok.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {data.returnAnalytics.map((row) => (
                <li key={row.country} className="flex justify-between border-b py-1 last:border-0">
                  <span>{row.country}</span>
                  <span className="text-muted-foreground">
                    {row.orders} sipariş · {row.returns} iade · %{row.rate}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="text-sm font-semibold">Depo stok dağılımı</h3>
          {data.stockAllocation.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Depo stoğu tanımlı değil.</p>
          ) : (
            <ul className="mt-3 space-y-1 text-sm">
              {data.stockAllocation.map((row) => (
                <li key={`${row.name}-${row.country}`} className="flex justify-between border-b py-1 last:border-0">
                  <span>
                    {row.name} · {row.country}
                  </span>
                  <span className="text-muted-foreground">
                    {row.provider} · {row.available} adet
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-sm font-semibold">Gümrük vergisi özeti</h3>
        {data.dutySummary.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Henüz ihracat belgesi yok.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {data.dutySummary.map((row) => (
              <li key={row.country} className="flex justify-between border-b py-1 last:border-0">
                <span>{row.country}</span>
                <span className="text-muted-foreground">
                  Vergi {row.duty.toFixed(2)} · KDV {row.vat.toFixed(2)} {row.currency}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
