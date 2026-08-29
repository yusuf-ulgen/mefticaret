import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Activity, CreditCard, ShoppingBag, TrendingUp, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatNumber, formatPercent, STORE_STATUS_LABELS } from "@/lib/mefti";
import { storeAuditQuery, storeQuery, storeStatsQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/dashboard")({
  head: () => ({
    meta: [
      { title: "Mağaza Paneli — Mefticaret" },
      { name: "description", content: "Ciro, sipariş, ziyaretçi ve dönüşüm metriklerini tek ekranda izle." },
      { property: "og:title", content: "Mağaza Paneli — Mefticaret" },
      { property: "og:description", content: "Son 30 günün satış performansı ve denetim kayıtları." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { storeId } = Route.useParams();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: stats, isLoading } = useQuery(storeStatsQuery(storeId, 30));
  const { data: audit } = useQuery(storeAuditQuery(storeId));

  const rows = stats ?? [];
  const currency = store?.currency ?? "TRY";
  const revenue = rows.reduce((total, row) => total + Number(row.revenue ?? 0), 0);
  const orders = rows.reduce((total, row) => total + Number(row.orders ?? 0), 0);
  const visitors = rows.reduce((total, row) => total + Number(row.visitors ?? 0), 0);
  const conversion = visitors > 0 ? (orders / visitors) * 100 : 0;
  const aov = orders > 0 ? revenue / orders : 0;
  const max = Math.max(1, ...rows.map((row) => Number(row.revenue ?? 0)));

  const cards = [
    { label: "Ciro (30 gün)", value: formatMoney(revenue, currency), icon: TrendingUp },
    { label: "Sipariş", value: formatNumber(orders), icon: ShoppingBag },
    { label: "Ziyaretçi", value: formatNumber(visitors), icon: Users },
    { label: "Dönüşüm", value: formatPercent(conversion), icon: Activity },
    { label: "Sepet ortalaması", value: formatMoney(aov, currency), icon: CreditCard },
  ];

  return (
    <AppShell
      storeId={storeId}
      title={store?.name ?? "Mağaza paneli"}
      description="Son 30 günün performansı ve mağaza aktiviteleri."
      actions={
        store ? (
          <Badge variant={store.status === "active" ? "default" : "secondary"}>
            {STORE_STATUS_LABELS[store.status] ?? store.status}
          </Badge>
        ) : null
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="surface-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{card.label}</span>
              <card.icon className="size-4 text-brand-foreground" />
            </div>
            <p className="mt-2 font-display text-2xl font-semibold">
              {isLoading ? <Skeleton className="h-7 w-24" /> : card.value}
            </p>
          </div>
        ))}
      </div>

      <section className="surface-card p-6">
        <h2 className="font-display text-lg font-semibold">Günlük ciro</h2>
        {isLoading ? (
          <Skeleton className="mt-6 h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Henüz istatistik yok. Mağazan yayına alındığında veriler burada görünecek.
          </p>
        ) : (
          <div className="mt-6 flex h-40 items-end gap-1">
            {rows.map((row) => (
              <div
                key={row.stat_date}
                className="flex-1 rounded-t brand-gradient"
                style={{ height: `${Math.max(4, (Number(row.revenue ?? 0) / max) * 100)}%` }}
                title={`${row.stat_date}: ${formatMoney(Number(row.revenue ?? 0), currency)}`}
              />
            ))}
          </div>
        )}
      </section>

      <section className="surface-card p-6">
        <h2 className="font-display text-lg font-semibold">Son aktiviteler</h2>
        <ul className="mt-4 divide-y divide-border">
          {(audit ?? []).length === 0 ? (
            <li className="py-3 text-sm text-muted-foreground">Henüz kayıt yok.</li>
          ) : (
            (audit ?? []).map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="font-medium">{log.action}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString("tr-TR")}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </AppShell>
  );
}
