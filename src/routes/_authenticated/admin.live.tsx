import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Eye,
  Globe2,
  MapPin,
  MousePointer2,
  Package,
  Radio,
  RefreshCw,
  ShoppingCart,
  Smartphone,
  Store,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { platformLiveQuery } from "@/lib/platform-admin-queries";

export const Route = createFileRoute("/_authenticated/admin/live")({
  head: () => ({
    meta: [
      { title: "Canlı İzleme — Süper Admin" },
      {
        name: "description",
        content: "Tüm mağazalarda şu an kaç ziyaretçi var, hangi sepetler açık ve hangi siparişler geliyor.",
      },
      { property: "og:title", content: "Canlı İzleme — Süper Admin" },
      { property: "og:description", content: "Platform genelinde gerçek zamanlı ziyaretçi ve sipariş akışı." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminLivePage,
});

const KIND_LABELS: Record<string, string> = {
  page_view: "Sayfa görüntüleme",
  product_view: "Ürün görüntüleme",
  add_to_cart: "Sepete ekleme",
  checkout: "Ödeme adımı",
  purchase: "Satın alma",
};

const KIND_ICON: Record<string, typeof Activity> = {
  page_view: Eye,
  product_view: MousePointer2,
  add_to_cart: ShoppingCart,
  checkout: CreditCard,
  purchase: CheckCircle2,
};

const RANGES = [
  { minutes: 15, label: "15 dk" },
  { minutes: 60, label: "60 dk" },
  { minutes: 180, label: "3 sa" },
];

function timeAgo(iso: string) {
  const minutes = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  return `${Math.floor(minutes / 60)} sa önce`;
}

function AdminLivePage() {
  const { isPlatformAdmin } = useAuth();
  const [minutes, setMinutes] = useState(60);
  const { data, isLoading, isFetching, refetch } = useQuery(platformLiveQuery(minutes, isPlatformAdmin));

  const buckets = data?.buckets ?? [];
  const maxBucket = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const funnelMax = Math.max(1, ...(data?.funnel ?? []).map((step) => step.value));
  const trend = useMemo(() => {
    const half = Math.floor(buckets.length / 2) || 1;
    const last = buckets.slice(-half).reduce((sum, bucket) => sum + bucket.count, 0);
    const prev = buckets.slice(0, half).reduce((sum, bucket) => sum + bucket.count, 0);
    if (prev === 0) return last > 0 ? 100 : 0;
    return ((last - prev) / prev) * 100;
  }, [buckets]);

  return (
    <AdminShell
      title="Canlı İzleme"
      description="Platformdaki tüm mağazaların gerçek zamanlı nabzı."
      actions={
        <div className="flex items-center gap-2">
          <div className="hidden rounded-full border border-border p-0.5 sm:flex">
            {RANGES.map((range) => (
              <button
                key={range.minutes}
                type="button"
                onClick={() => setMinutes(range.minutes)}
                aria-pressed={minutes === range.minutes}
                className={
                  minutes === range.minutes
                    ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
                    : "rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                }
              >
                {range.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={() => void refetch()} aria-label="Canlı verileri yenile">
            <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />
            <span className="hidden sm:inline">Yenile</span>
          </Button>
          <Badge variant="outline" className="gap-2 border-success/30 bg-success/10 text-success">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-2 animate-ping rounded-full bg-success/60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            Canlı
          </Badge>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <section className="surface-card relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Activity className="size-4" />
                </span>
                Anlık ziyaretçi
              </p>
              <p className="mt-3 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
                {formatNumber(data?.visitors ?? 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatNumber(data?.sessions ?? 0)} oturum · {formatNumber(data?.activeStores ?? 0)} aktif mağaza
              </p>
            </div>
            <TrendPill value={trend} />
          </div>
          <div className="relative mt-5 flex h-20 items-end gap-[3px]" aria-hidden>
            {buckets.map((bucket) => (
              <div
                key={bucket.minute}
                className="min-w-0 flex-1 rounded-t-sm bg-primary/25 transition-colors hover:bg-primary/60"
                style={{ height: `${Math.max(6, (bucket.count / maxBucket) * 100)}%` }}
                title={`${bucket.count} ziyaretçi`}
              />
            ))}
          </div>
          <div className="relative mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{minutes} dk önce</span>
            <span>şimdi</span>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <MetricCard
            icon={<ShoppingCart />}
            label="Aktif sepet"
            value={formatNumber(data?.cartCount ?? 0)}
            hint={`${formatMoney(data?.cartValue ?? 0)} sepet değeri`}
          />
          <MetricCard
            icon={<Package />}
            label="Bugün sipariş"
            value={formatNumber(data?.orderCount ?? 0)}
            hint={`${formatMoney(data?.revenue ?? 0)} ödenmiş ciro`}
          />
          <MetricCard
            icon={<ArrowUpRight />}
            label="Dönüşüm"
            value={`${(data?.conversionRate ?? 0).toFixed(1)}%`}
            hint={`son ${minutes} dakika`}
          />
          <MetricCard
            icon={<Radio />}
            label="Olay"
            value={formatNumber(data?.eventCount ?? 0)}
            hint="vitrin etkileşimi"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="surface-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Store className="size-4 text-primary" />
                <h2 className="font-display text-lg font-semibold">Mağaza bazlı canlı tablo</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">En hareketli mağazalar ve anlık performansları.</p>
            </div>
            <Badge variant="secondary">{formatNumber(data?.stores?.length ?? 0)} mağaza</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-medium">Mağaza</th>
                  <th className="px-3 py-3 text-right font-medium">Ziyaretçi</th>
                  <th className="px-3 py-3 text-right font-medium">Sepet</th>
                  <th className="px-3 py-3 text-right font-medium">Sipariş</th>
                  <th className="px-5 py-3 text-right font-medium">Ciro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                      Yükleniyor…
                    </td>
                  </tr>
                ) : (data?.stores ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                      Şu anda hareket yok.
                    </td>
                  </tr>
                ) : (
                  (data?.stores ?? []).map((store) => (
                    <tr key={store.storeId} className="transition hover:bg-muted/30">
                      <td className="px-5 py-3">
                        <Link
                          to="/admin/store/$storeId"
                          params={{ storeId: store.storeId }}
                          className="font-medium text-primary hover:underline"
                        >
                          {store.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right">{formatNumber(store.visitors)}</td>
                      <td className="px-3 py-3 text-right">{formatNumber(store.carts)}</td>
                      <td className="px-3 py-3 text-right">{formatNumber(store.orders)}</td>
                      <td className="px-5 py-3 text-right font-medium">{formatMoney(store.revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="surface-card p-5">
          <h2 className="font-display text-lg font-semibold">Dönüşüm hunisi</h2>
          <p className="mt-1 text-sm text-muted-foreground">Platform genelinde son {minutes} dakika.</p>
          <div className="mt-5 space-y-4">
            {(data?.funnel ?? []).map((step) => (
              <div key={step.label}>
                <div className="flex justify-between text-sm">
                  <span>{step.label}</span>
                  <span className="font-medium">{formatNumber(step.value)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${(step.value / funnelMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="surface-card p-5">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Canlı aktivite akışı</h2>
          </div>
          <div className="mt-3 divide-y divide-border">
            {(data?.activity ?? []).length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Henüz hareket yok.</p>
            ) : (
              (data?.activity ?? []).map((event) => {
                const Icon = KIND_ICON[event.kind] ?? Activity;
                return (
                  <div key={event.id} className="flex items-center gap-3 py-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 text-sm">
                        <span className="font-medium">{KIND_LABELS[event.kind] ?? event.kind}</span>
                        <span className="truncate text-muted-foreground">{event.storeName}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {[event.path, event.city, event.country, event.device].filter(Boolean).join(" · ") ||
                          "Konum bilgisi bekleniyor"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-xs text-muted-foreground">
                      {event.value > 0 ? (
                        <p className="text-sm font-medium text-foreground">
                          {formatMoney(event.value, event.currency)}
                        </p>
                      ) : null}
                      {timeAgo(event.createdAt)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <div className="space-y-4">
          <section className="surface-card p-5">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">Son siparişler</h2>
            </div>
            <ul className="mt-3 divide-y divide-border">
              {(data?.recentOrders ?? []).length === 0 ? (
                <li className="py-8 text-center text-sm text-muted-foreground">Bugün sipariş yok.</li>
              ) : (
                (data?.recentOrders ?? []).map((order) => (
                  <li key={order.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">#{order.orderNumber}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {order.storeName} · {timeAgo(order.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-medium">{formatMoney(order.total, order.currency)}</p>
                      <p className="text-xs text-muted-foreground">{order.paymentStatus}</p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>
          <ListCard title="Şehirler" icon={<MapPin />} items={data?.cities ?? []} />
          <ListCard title="Cihazlar" icon={<Smartphone />} items={data?.devices ?? []} />
          <ListCard title="Ülkeler" icon={<Globe2 />} items={data?.countries ?? []} />
          <ListCard title="En çok görüntülenen sayfalar" icon={<Eye />} items={data?.paths ?? []} />
        </div>
      </div>
    </AdminShell>
  );
}

function TrendPill({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span
      className={
        up
          ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
          : "inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive"
      }
    >
      <ArrowUpRight className={up ? "size-3" : "size-3 rotate-90"} />
      {up ? "+" : ""}
      {value.toFixed(0)}%
    </span>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
        <span className="text-primary [&>svg]:size-4">{icon}</span>
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold sm:text-3xl">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ListCard({
  title,
  icon,
  items,
}: {
  title: string;
  icon: React.ReactNode;
  items: { label: string; count: number }[];
}) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center gap-2">
        <span className="text-primary [&>svg]:size-4">{icon}</span>
        <h2 className="font-medium">{title}</h2>
      </div>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Henüz veri yok.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-muted-foreground">{item.label}</span>
              <span className="font-medium">{formatNumber(item.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
