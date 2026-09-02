import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Eye, ShoppingCart, CreditCard, Radio } from "lucide-react";
import { useEffect, useMemo } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  liveCartsQuery,
  liveEventsQuery,
  liveOrdersQuery,
  minuteBuckets,
  summarizeLive,
  topBy,
} from "@/lib/live-queries";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/live")({
  head: () => ({
    meta: [
      { title: "Canlı İzleme — Mefticaret" },
      {
        name: "description",
        content:
          "Mağazanı gerçek zamanlı izle: aktif ziyaretçiler, sepetler, checkout ve siparişler tek ekranda.",
      },
      { property: "og:title", content: "Canlı İzleme — Mefticaret" },
      {
        property: "og:description",
        content: "Gerçek zamanlı ziyaretçi, sepet ve sipariş akışı.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LiveViewPage,
});

const KIND_LABELS: Record<string, string> = {
  page_view: "Sayfa görüntüleme",
  product_view: "Ürün görüntüleme",
  add_to_cart: "Sepete ekleme",
  checkout: "Ödeme adımı",
  purchase: "Satın alma",
};

const KIND_TONE: Record<string, string> = {
  page_view: "bg-muted text-foreground",
  product_view: "bg-muted text-foreground",
  add_to_cart: "bg-primary/10 text-primary",
  checkout: "bg-primary/15 text-primary",
  purchase: "bg-emerald-500/15 text-emerald-600",
};

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  return `${hours} sa önce`;
}

function LiveViewPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: events, isLoading } = useQuery(liveEventsQuery(storeId, 60));
  const { data: orders } = useQuery(liveOrdersQuery(storeId));
  const { data: carts } = useQuery(liveCartsQuery(storeId));

  const currency = store?.currency ?? "TRY";
  const rows = events ?? [];

  // Vitrin olayları ve siparişler için gerçek zamanlı akış; yalnızca bu mağazanın satırları.
  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`live-view-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "analytics_events",
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["live-events", storeId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["live-orders", storeId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [storeId, queryClient]);

  const summary = useMemo(() => summarizeLive(rows), [rows]);
  const buckets = useMemo(() => minuteBuckets(rows, 60), [rows]);
  const maxBucket = Math.max(1, ...buckets.map((bucket) => bucket.count));

  const paidOrders = (orders ?? []).filter((order) => order.payment_status === "paid");
  const todayRevenue = paidOrders.reduce((sum, order) => sum + Number(order.grand_total ?? 0), 0);
  const activeCarts = (carts ?? []).filter((cart) => !cart.completed_at);
  const cartValue = activeCarts.reduce((sum, cart) => sum + Number(cart.grand_total ?? 0), 0);

  const topPages = useMemo(() => topBy(rows, "path", 6), [rows]);
  const topSources = useMemo(() => topBy(rows, "referrer_host", 6), [rows]);
  const devices = useMemo(() => topBy(rows, "device", 4), [rows]);
  const countries = useMemo(() => topBy(rows, "country", 6), [rows]);

  const funnel = [
    { label: "Görüntüleme", value: summary.pageViews + summary.productViews },
    { label: "Sepete ekleme", value: summary.addToCart },
    { label: "Ödeme adımı", value: summary.checkouts },
    { label: "Satın alma", value: summary.purchases },
  ];
  const funnelMax = Math.max(1, ...funnel.map((step) => step.value));

  return (
    <AppShell
      storeId={storeId}
      title="Canlı İzleme"
      description="Son 60 dakikanın gerçek zamanlı mağaza aktivitesi."
      actions={
        <Badge variant="outline" className="gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-2 animate-ping rounded-full bg-emerald-500/70" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Canlı
        </Badge>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<Activity className="size-4" />}
          label="Şu anda mağazada"
          value={formatNumber(summary.visitors)}
          hint={`${formatNumber(summary.sessions)} aktif oturum (son 5 dk)`}
        />
        <MetricCard
          icon={<ShoppingCart className="size-4" />}
          label="Aktif sepet"
          value={formatNumber(activeCarts.length)}
          hint={`${formatMoney(cartValue, currency)} sepet değeri`}
        />
        <MetricCard
          icon={<CreditCard className="size-4" />}
          label="Bugünkü sipariş"
          value={formatNumber((orders ?? []).length)}
          hint={`${formatMoney(todayRevenue, currency)} ödenmiş ciro`}
        />
        <MetricCard
          icon={<Eye className="size-4" />}
          label="Dönüşüm oranı"
          value={`${summary.conversionRate.toFixed(1)}%`}
          hint={`${formatNumber(summary.pageViews + summary.productViews)} görüntüleme / 60 dk`}
        />
      </div>

      <div className="surface-card mt-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium">Ziyaretçi akışı</h2>
            <p className="text-sm text-muted-foreground">Dakika bazlı tekil ziyaretçi sayısı.</p>
          </div>
          <Radio className="size-4 text-muted-foreground" />
        </div>
        <div className="mt-5 flex h-28 items-end gap-[3px]">
          {buckets.map((bucket) => (
            <div
              key={bucket.minute}
              className="flex-1 rounded-t bg-primary/70"
              style={{ height: `${Math.max(3, (bucket.count / maxBucket) * 100)}%` }}
              title={`${bucket.count} ziyaretçi`}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>60 dk önce</span>
          <span>şimdi</span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="surface-card p-5 lg:col-span-2">
          <h2 className="font-medium">Canlı aktivite</h2>
          <p className="text-sm text-muted-foreground">
            Vitrinde gerçekleşen son ziyaretçi hareketleri.
          </p>
          <div className="mt-4 divide-y divide-border">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor…</p>
            ) : rows.length === 0 ? (
              <div className="py-10 text-center">
                <Activity className="mx-auto mb-3 size-6 text-muted-foreground" />
                <p className="font-medium">Şu anda hareket yok</p>
                <p className="text-sm text-muted-foreground">
                  Vitrinine trafik geldiğinde ziyaretçiler burada canlı görünür.
                </p>
              </div>
            ) : (
              rows.slice(0, 40).map((event) => (
                <div key={event.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${KIND_TONE[event.kind] ?? "bg-muted"}`}
                      >
                        {KIND_LABELS[event.kind] ?? event.kind}
                      </span>
                      <span className="truncate text-sm">{event.path ?? "—"}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[
                        event.country ?? "Bilinmeyen konum",
                        event.device ?? "cihaz yok",
                        event.referrer_host ?? "doğrudan",
                      ].join(" · ")}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {Number(event.value) > 0 ? (
                      <p className="text-sm font-medium text-foreground">
                        {formatMoney(Number(event.value), event.currency || currency)}
                      </p>
                    ) : null}
                    {timeAgo(event.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="surface-card p-5">
            <h2 className="font-medium">Dönüşüm hunisi (60 dk)</h2>
            <div className="mt-4 space-y-3">
              {funnel.map((step) => (
                <div key={step.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{step.label}</span>
                    <span className="font-medium">{formatNumber(step.value)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${(step.value / funnelMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ListCard title="En çok görüntülenen sayfalar" items={topPages} />
          <ListCard title="Trafik kaynakları" items={topSources} />
          <ListCard title="Cihazlar" items={devices} />
          <ListCard title="Ülkeler" items={countries} />
        </div>
      </div>
    </AppShell>
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
    <div className="surface-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ListCard({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  return (
    <div className="surface-card p-5">
      <h2 className="font-medium">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Henüz veri yok.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {items.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-3">
              <span className="truncate text-muted-foreground">{item.label}</span>
              <span className="font-medium">{formatNumber(item.count)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
