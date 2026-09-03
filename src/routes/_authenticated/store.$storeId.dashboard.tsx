import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BellRing,
  CreditCard,
  MessageSquare,
  PackageCheck,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
  Users,
  Check,
  Circle,
  Radio,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatNumber, formatPercent, STORE_STATUS_LABELS } from "@/lib/mefti";
import {
  storeActionItemsQuery,
  storeAuditQuery,
  storeQuery,
  storeSetupChecklistQuery,
  storeStatsQuery,
} from "@/lib/store-queries";
import { useStoreRealtime } from "@/hooks/use-store-realtime";
import { formatDateTime } from "@/lib/mefti";


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
  const { data: actionItems } = useQuery(storeActionItemsQuery(storeId));
  const { data: checklist } = useQuery(storeSetupChecklistQuery(storeId));
  const liveEvents = useStoreRealtime(storeId);

  const setupSteps = [
    { key: "product", label: "Aktif ürün ekle", done: checklist?.hasActiveProduct ?? false, to: "/store/$storeId/products" as const },
    { key: "payment", label: "Ödeme yöntemi aç", done: checklist?.hasPaymentMethod ?? false, to: "/store/$storeId/payments" as const },
    { key: "shipping", label: "Kargo tarifesi tanımla", done: checklist?.hasShippingRate ?? false, to: "/store/$storeId/shipping" as const },
    { key: "theme", label: "Temayı yayınla", done: checklist?.themePublished ?? false, to: "/store/$storeId/themes" as const },
    { key: "contact", label: "İletişim e-postası gir", done: checklist?.hasContactEmail ?? false, to: "/store/$storeId/settings" as const },
    { key: "domain", label: "Alan adı doğrula", done: checklist?.hasVerifiedDomain ?? false, to: "/store/$storeId/domains" as const },
  ];
  const setupDone = setupSteps.filter((step) => step.done).length;

  const todo = [
    {
      key: "pending-orders",
      label: "Bekleyen sipariş",
      count: actionItems?.pendingOrders ?? 0,
      icon: ShoppingBag,
      to: "/store/$storeId/orders" as const,
    },
    {
      key: "unfulfilled",
      label: "Sevk bekleyen",
      count: actionItems?.unfulfilled ?? 0,
      icon: PackageCheck,
      to: "/store/$storeId/shipments" as const,
    },
    {
      key: "low-stock",
      label: "Kritik stok",
      count: actionItems?.lowStock ?? 0,
      icon: AlertTriangle,
      to: "/store/$storeId/inventory" as const,
    },
    {
      key: "returns",
      label: "İade talebi",
      count: actionItems?.pendingReturns ?? 0,
      icon: RotateCcw,
      to: "/store/$storeId/returns" as const,
    },
    {
      key: "reviews",
      label: "Onay bekleyen yorum",
      count: actionItems?.pendingReviews ?? 0,
      icon: MessageSquare,
      to: "/store/$storeId/reviews" as const,
    },
    {
      key: "stock-alerts",
      label: "Stok bildirimi bekleyen",
      count: actionItems?.pendingStockAlerts ?? 0,
      icon: BellRing,
      to: "/store/$storeId/stock-alerts" as const,
    },
  ];


  const rows = stats ?? [];
  const currency = store?.currency ?? "TRY";
  const revenue = rows.reduce((total, row) => total + Number(row.revenue ?? 0), 0);
  const orders = rows.reduce((total, row) => total + Number(row.orders_count ?? 0), 0);
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
            <div className="mt-2 font-display text-2xl font-semibold">
              {isLoading ? <Skeleton className="h-7 w-24" /> : card.value}
            </div>
          </div>
        ))}
      </div>

      {liveEvents.length ? (
        <section className="surface-card p-6">
          <div className="flex items-center gap-2">
            <span className="relative grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Radio className="size-4" />
              <span className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-primary" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold">Canlı akış</h2>
              <p className="text-xs text-muted-foreground">
                Siparişler ve mağaza olayları anlık olarak buraya düşer.
              </p>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {liveEvents.map((event) => (
              <li key={`${event.kind}-${event.id}`} className="flex items-start justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">{event.title}</p>
                  {event.detail ? (
                    <p className="text-xs text-muted-foreground">{event.detail}</p>
                  ) : null}
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(event.at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {setupDone < setupSteps.length ? (
        <section className="surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Kurulum kontrol listesi</h2>
            <Badge variant="secondary">
              {setupDone}/{setupSteps.length} tamamlandı
            </Badge>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full brand-gradient transition-all"
              style={{ width: `${(setupDone / setupSteps.length) * 100}%` }}
            />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {setupSteps.map((step) => (
              <Link
                key={step.key}
                to={step.to}
                params={{ storeId }}
                className="flex items-center gap-3 rounded-lg border border-border p-4 text-sm transition hover:border-brand hover:bg-muted/40"
              >
                {step.done ? (
                  <Check className="size-4 text-brand-foreground" />
                ) : (
                  <Circle className="size-4 text-muted-foreground" />
                )}
                <span className={step.done ? "text-muted-foreground line-through" : "font-medium"}>
                  {step.label}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="surface-card p-6">
        <h2 className="font-display text-lg font-semibold">Dikkat gerektirenler</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {todo.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              params={{ storeId }}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-4 transition hover:border-brand hover:bg-muted/40"
            >
              <span className="flex items-center gap-2 text-sm">
                <item.icon
                  className={
                    item.count > 0 ? "size-4 text-brand-foreground" : "size-4 text-muted-foreground"
                  }
                />
                {item.label}
              </span>
              <Badge variant={item.count > 0 ? "default" : "secondary"}>
                {formatNumber(item.count)}
              </Badge>
            </Link>
          ))}
        </div>
      </section>


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
