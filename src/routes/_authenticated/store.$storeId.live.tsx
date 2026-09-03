import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Eye,
  Globe2,
  MapPin,
  MousePointer2,
  Package,
  RefreshCw,
  Radio,
  ShoppingCart,
  Smartphone,
  Tablet,
  Truck,
  Monitor,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      { title: "Canlı Takip — Mefticaret" },
      {
        name: "description",
        content:
          "Mağazanızda şu an neler olduğunu gerçek zamanlı görün: ziyaretçiler, şehirler, sepetler ve sayfa performansı.",
      },
      { property: "og:title", content: "Canlı Takip — Mefticaret" },
      {
        property: "og:description",
        content: "Gerçek zamanlı ziyaretçi, aktif sepet ve mağaza aktivitesi takibi.",
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

const KIND_ICON: Record<string, typeof Activity> = {
  page_view: Eye,
  product_view: MousePointer2,
  add_to_cart: ShoppingCart,
  checkout: CreditCard,
  purchase: CheckCircle2,
};

function timeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  return `${Math.floor(minutes / 60)} sa önce`;
}

function LiveViewPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: events, isLoading } = useQuery(liveEventsQuery(storeId, 60));
  const { data: orders } = useQuery(liveOrdersQuery(storeId));
  const { data: carts } = useQuery(liveCartsQuery(storeId));

  const currency = store?.currency ?? "TRY";
  const rows = events ?? [];

  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`live-view-${storeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "analytics_events", filter: `store_id=eq.${storeId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["live-events", storeId] });
          setLastUpdated(new Date());
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["live-orders", storeId] });
          setLastUpdated(new Date());
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "carts", filter: `store_id=eq.${storeId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["live-carts", storeId] });
          setLastUpdated(new Date());
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
  const activeCarts = useMemo(() => (carts ?? []).filter((cart) => !cart.completed_at), [carts]);
  const cartValue = activeCarts.reduce((sum, cart) => sum + Number(cart.grand_total ?? 0), 0);
  const paidOrders = (orders ?? []).filter((order) => order.payment_status === "paid");
  const todayRevenue = paidOrders.reduce((sum, order) => sum + Number(order.grand_total ?? 0), 0);
  const cities = useMemo(() => topBy(rows, "city", 7), [rows]);
  const topPages = useMemo(() => topBy(rows, "path", 6), [rows]);
  const devices = useMemo(() => topBy(rows, "device", 4), [rows]);
  const countries = useMemo(() => topBy(rows, "country", 6), [rows]);
  const funnel = [
    { label: "Görüntüleme", value: summary.pageViews + summary.productViews },
    { label: "Sepete ekleme", value: summary.addToCart },
    { label: "Ödeme adımı", value: summary.checkouts },
    { label: "Satın alma", value: summary.purchases },
  ];
  const funnelMax = Math.max(1, ...funnel.map((step) => step.value));

  function refresh() {
    setLastUpdated(new Date());
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["live-events", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["live-orders", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["live-carts", storeId] }),
    ]);
  }

  return (
    <AppShell
      storeId={storeId}
      title="Canlı Takip"
      description="Mağazanızda şu an neler oluyor?"
      actions={
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">Güncellendi {timeAgo(lastUpdated.toISOString())}</span>
          <Button size="sm" variant="outline" onClick={refresh} aria-label="Canlı verileri yenile">
            <RefreshCw className="size-4" />
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
      <section className="mb-5 max-w-3xl">
        <p className="eyebrow">GERÇEK ZAMANLI MAĞAZA GÖRÜNÜMÜ</p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Ziyaretçilerinizi anlık olarak izleyin.</h1>
        <p className="mt-3 text-muted-foreground">Hangi müşteri hangi sayfada, hangi şehirden bağlanıyor ve sepetinde ne var; hepsi tek ekranda.</p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<Activity />} label="Anlık ziyaretçi" value={formatNumber(summary.visitors)} hint={`${formatNumber(summary.sessions)} aktif oturum · son 5 dk`} />
        <MetricCard icon={<ShoppingCart />} label="Aktif sepet" value={formatNumber(activeCarts.length)} hint={`${formatMoney(cartValue, currency)} toplam sepet değeri`} />
        <MetricCard icon={<Package />} label="Bugün sipariş" value={formatNumber((orders ?? []).length)} hint={`${formatMoney(todayRevenue, currency)} ödenmiş ciro`} />
        <MetricCard icon={<ArrowUpRight />} label="Dönüşüm oranı" value={`${summary.conversionRate.toFixed(1)}%`} hint={`${formatNumber(summary.pageViews + summary.productViews)} görüntüleme · son 60 dk`} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="surface-card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
            <div>
              <div className="flex items-center gap-2"><Globe2 className="size-4 text-brand" /><h2 className="font-medium">Ziyaretçileriniz nerelerden geliyor?</h2></div>
              <p className="mt-1 text-sm text-muted-foreground">Şehir bazlı ziyaretçi dağılımı · son 60 dakika</p>
            </div>
            <Badge variant="secondary">{formatNumber(summary.visitors)} aktif ziyaretçi</Badge>
          </div>
          <div className="grid gap-6 p-5 lg:grid-cols-[1.2fr_0.8fr]">
            <LiveMap cities={cities} />
            <div>
              <div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground"><span>Şehir bazlı dağılım</span><span>Olay</span></div>
              <div className="space-y-4">
                {cities.length === 0 ? <EmptyLine label="Şehir verisi bekleniyor" /> : cities.map((city, index) => <DistributionRow key={city.label} item={city} rank={index} max={cities[0]?.count ?? 1} />)}
              </div>
            </div>
          </div>
        </section>

        <section className="surface-card p-5">
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-medium">Ziyaretçi akışı</h2><p className="mt-1 text-sm text-muted-foreground">Dakika bazlı tekil ziyaretçi sayısı</p></div><Radio className="size-4 text-brand" /></div>
          <div className="mt-7 flex h-36 items-end gap-1" aria-label="Son 60 dakika ziyaretçi grafiği">
            {buckets.map((bucket) => <div key={bucket.minute} className="min-w-0 flex-1 rounded-t-sm bg-brand/70 transition-all hover:bg-brand" style={{ height: `${Math.max(4, (bucket.count / maxBucket) * 100)}%` }} title={`${bucket.count} ziyaretçi`} />)}
          </div>
          <div className="mt-3 flex justify-between text-xs text-muted-foreground"><span>60 dk önce</span><span>şimdi</span></div>
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-5"><MiniStat label="Sayfa görüntüleme" value={summary.pageViews + summary.productViews} /><MiniStat label="Satın alma" value={summary.purchases} /></div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="surface-card p-5">
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-medium">Aktif sepetler</h2><p className="mt-1 text-sm text-muted-foreground">Ziyaretçilerin karar aşamasını kaçırmayın.</p></div><ShoppingCart className="size-4 text-brand" /></div>
          <div className="mt-5 space-y-2">
            {activeCarts.length === 0 ? <EmptyState icon={<ShoppingCart />} title="Şu anda aktif sepet yok" description="Vitrininize trafik geldiğinde sepetler burada canlı görünür." /> : activeCarts.slice(0, 5).map((cart, index) => <CartRow key={cart.id} cart={cart} index={index} currency={currency} />)}
          </div>
        </section>
        <section className="surface-card p-5">
          <h2 className="font-medium">Dönüşüm hunisi</h2><p className="mt-1 text-sm text-muted-foreground">Son 60 dakikanın müşteri yolculuğu</p>
          <div className="mt-6 space-y-4">{funnel.map((step) => <div key={step.label}><div className="flex justify-between text-sm"><span>{step.label}</span><span className="font-medium">{formatNumber(step.value)}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(step.value / funnelMax) * 100}%` }} /></div></div>)}</div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="surface-card p-5"><div className="flex items-start justify-between"><div><h2 className="font-medium">Canlı aktivite</h2><p className="mt-1 text-sm text-muted-foreground">Mağazada gerçekleşen son ziyaretçi hareketleri.</p></div><Activity className="size-4 text-brand" /></div><div className="mt-4 divide-y divide-border">{isLoading ? <p className="py-10 text-center text-sm text-muted-foreground">Yükleniyor…</p> : rows.length === 0 ? <EmptyState icon={<Activity />} title="Şu anda hareket yok" description="Vitrininize trafik geldiğinde ziyaretçiler burada canlı görünür." /> : rows.slice(0, 12).map((event) => <ActivityRow key={event.id} event={event} currency={currency} />)}</div></section>
        <section className="space-y-5"><ListCard title="En çok görüntülenen sayfalar" icon={<Eye />} items={topPages} /><ListCard title="Cihazlar" icon={<Smartphone />} items={devices} /><ListCard title="Ülkeler" icon={<MapPin />} items={countries} /></section>
      </div>
    </AppShell>
  );
}

function MetricCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return <div className="surface-card p-5"><div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="text-brand [&>svg]:size-4">{icon}</span>{label}</div><p className="mt-3 font-display text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div>;
}

function LiveMap({ cities }: { cities: { label: string; count: number }[] }) {
  const points = [{ x: 49, y: 47 }, { x: 55, y: 42 }, { x: 59, y: 54 }, { x: 45, y: 57 }, { x: 64, y: 48 }, { x: 37, y: 40 }, { x: 70, y: 60 }];
  return <div className="relative min-h-72 overflow-hidden rounded-lg border border-border bg-brand-soft/50 p-3"><div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:28px_28px]" /><svg viewBox="0 0 100 65" className="relative z-10 h-full min-h-64 w-full text-brand/25" aria-label="Dünya haritası üzerinde canlı ziyaretçi noktaları" role="img"><path fill="currentColor" d="M6 21 14 14l12 2 7-5 11 5 3 8-8 3-4 7-12-1-7 5-7-5-6-7zm41-9 8-5 12 2 6 7 11 2 6 9-6 6-12-2-6 7-10-3-4-10-8-5zM44 42l7 2 5 9-5 8-7-5-3-8zM68 45l8-3 10 5-4 7-10-1z" /><path fill="none" stroke="currentColor" strokeDasharray="1.5 2" d="M3 32h94M22 6c10 12 10 38 0 54M50 3c-7 17-7 40 0 59M78 6c-10 12-10 38 0 54" /></svg>{points.map((point, index) => <span key={`${point.x}-${point.y}`} className="absolute z-20 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-brand shadow-sm" style={{ left: `${point.x}%`, top: `${point.y}%`, opacity: cities.length === 0 ? 0.3 : 1 - index * 0.09 }} />)}<div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1.5 text-xs shadow-sm"><span className="size-2 rounded-full bg-success" />Canlı bağlantılar</div></div>;
}

function DistributionRow({ item, rank, max }: { item: { label: string; count: number }; rank: number; max: number }) {
  return <div><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold">{rank + 1}</span><span className="truncate">{item.label}</span></span><span className="font-medium">{formatNumber(item.count)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }} /></div></div>;
}

function CartRow({ cart, index, currency }: { cart: { id: string; grand_total: number; currency: string; updated_at: string }; index: number; currency: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-md border border-border p-3"><div className="flex min-w-0 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><ShoppingCart className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-medium">Ziyaretçi #{index + 1}</p><p className="text-xs text-muted-foreground">{timeAgo(cart.updated_at)} · devam ediyor</p></div></div><div className="text-right"><p className="text-sm font-semibold">{formatMoney(Number(cart.grand_total), cart.currency || currency)}</p><p className="text-xs text-muted-foreground">Sepet</p></div></div>;
}

function ActivityRow({ event, currency }: { event: { kind: string; path: string | null; city: string | null; country: string | null; device: string | null; value: number | string; currency: string; created_at: string }; currency: string }) {
  const Icon = KIND_ICON[event.kind] ?? Activity;
  return <div className="flex items-center gap-3 py-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand"><Icon className="size-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm"><span className="font-medium">{KIND_LABELS[event.kind] ?? event.kind}</span><span className="truncate text-muted-foreground">{event.path ?? "Mağaza ana sayfası"}</span></div><p className="mt-0.5 truncate text-xs text-muted-foreground">{[event.city, event.country, event.device].filter(Boolean).join(" · ") || "Konum bilgisi bekleniyor"}</p></div><div className="shrink-0 text-right text-xs text-muted-foreground">{Number(event.value) > 0 ? <p className="text-sm font-medium text-foreground">{formatMoney(Number(event.value), event.currency || currency)}</p> : null}{timeAgo(event.created_at)}</div></div>;
}

function ListCard({ title, icon, items }: { title: string; icon: React.ReactNode; items: { label: string; count: number }[] }) {
  return <div className="surface-card p-5"><div className="flex items-center gap-2"><span className="text-brand [&>svg]:size-4">{icon}</span><h2 className="font-medium">{title}</h2></div>{items.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Henüz veri yok.</p> : <ul className="mt-4 space-y-3">{items.map((item) => <li key={item.label} className="flex items-center justify-between gap-3 text-sm"><span className="truncate text-muted-foreground">{item.label}</span><span className="font-medium">{formatNumber(item.count)}</span></li>)}</ul>}<div className="mt-4 flex items-center gap-1 text-xs font-medium text-brand">Detayları gör<ChevronRight className="size-3" /></div></div>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{formatNumber(value)}</p></div>;
}

function EmptyLine({ label }: { label: string }) { return <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">{label}</p>; }
function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) { return <div className="grid place-items-center rounded-md border border-dashed border-border px-5 py-10 text-center"><span className="text-muted-foreground [&>svg]:size-6">{icon}</span><p className="mt-3 font-medium">{title}</p><p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p></div>; }
