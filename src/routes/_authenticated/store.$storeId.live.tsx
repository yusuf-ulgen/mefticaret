import { LivePagesPanel } from "@/components/analytics/live-pages";
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
  function refresh() {
    setLastUpdated(new Date());
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["live-events", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["live-orders", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["live-carts", storeId] }),
    ]);
  }
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<"all" | Stage>("all");
  void orders;

  const sessions = useMemo(() => {
    const cutoff = Date.now() - 30 * 60_000;
    const map = new Map<string, LiveSession>();
    for (const e of rows) {
      if (new Date(e.created_at).getTime() < cutoff) continue;
      let s = map.get(e.session_id);
      if (!s) {
        s = { id: e.session_id, last: e.created_at, path: e.path, city: e.city, country: e.country, device: e.device, source: e.referrer_host ?? e.source, stage: "visit", events: 0 };
        map.set(e.session_id, s);
      }
      s.events++;
      const r = STAGE_RANK[kindStage(e.kind)];
      if (r > STAGE_RANK[s.stage]) s.stage = kindStage(e.kind);
    }
    return [...map.values()];
  }, [rows]);

  const counts = {
    visit: sessions.length,
    cart: sessions.filter((s) => STAGE_RANK[s.stage] >= 1).length,
    checkout: sessions.filter((s) => STAGE_RANK[s.stage] >= 2).length,
    purchase: sessions.filter((s) => s.stage === "purchase").length,
  };
  const q = search.trim().toLocaleLowerCase("tr");
  const shown = sessions.filter((s) => (stage === "all" || s.stage === stage) &&
    (!q || `${s.city ?? ""} ${s.country ?? ""} ${s.path ?? ""}`.toLocaleLowerCase("tr").includes(q)));
  const cityList = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions) { const k = s.city || s.country || "Bilinmiyor"; m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [sessions]);

  const STAT = [
    { k: "visit" as const, label: "Ziyaretçi", icon: Eye, v: counts.visit },
    { k: "cart" as const, label: "Sepet", icon: ShoppingCart, v: counts.cart },
    { k: "checkout" as const, label: "Ödeme", icon: CreditCard, v: counts.checkout },
    { k: "purchase" as const, label: "Satın alım", icon: CheckCircle2, v: counts.purchase },
  ];

  return (
    <AppShell storeId={storeId} title="Canlı Akış">
      <div className="grid min-h-[70vh] grid-cols-1 overflow-hidden rounded-2xl border bg-card lg:grid-cols-[1fr_320px]">
        {/* Sol: canlı alan */}
        <div className="relative flex min-h-[460px] flex-col bg-muted/40">
          <Globe2 aria-hidden strokeWidth={0.4} className="pointer-events-none absolute inset-0 m-auto size-[min(80%,520px)] text-foreground/5" />
          <div className="relative m-4 flex w-fit items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary"><Radio className="size-4" /></span>
            <div>
              <h2 className="font-semibold leading-tight">Canlı Akış</h2>
              <p className="text-xs text-muted-foreground">{lastUpdated.toLocaleTimeString("tr-TR")} güncellendi</p>
            </div>
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
              <span className="size-1.5 animate-pulse rounded-full bg-success" /> CANLI
            </span>
            <Button size="icon" variant="ghost" onClick={refresh} aria-label="Yenile"><RefreshCw className="size-4" /></Button>
          </div>

          <div className="relative flex-1 px-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Son 30 dakika · konumlar</p>
            {cityList.length === 0 ? (
              <p className="text-sm text-muted-foreground">{isLoading ? "Yükleniyor…" : "Şu an mağazanızda ziyaretçi yok."}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {cityList.map(([c, n]) => (
                  <li key={c} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-sm">
                    <MapPin className="size-3.5 text-primary" /> {c} <span className="font-semibold tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="relative grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
            {STAT.map((s) => (
              <button key={s.k} onClick={() => setStage(stage === s.k ? "all" : s.k)} aria-pressed={stage === s.k}
                className={`flex items-center gap-3 rounded-2xl border bg-card px-3 py-2.5 text-left ${stage === s.k ? "border-primary" : ""}`}>
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><s.icon className="size-4" /></span>
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{s.label}</span>
                  <span className="block text-xl font-semibold tabular-nums">{formatNumber(s.v)}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="relative px-4 pb-3 text-xs text-muted-foreground">
            Aktif sepet değeri: {formatMoney(cartValue, currency)} · Bugün ödenen: {formatMoney(todayRevenue, currency)}
          </p>
        </div>

        {/* Sağ: anlık oturumlar */}
        <aside className="flex flex-col border-t lg:border-l lg:border-t-0">
          <div className="space-y-2 border-b p-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em]">Anlık oturumlar</h3>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Şehir, sayfa ara…" aria-label="Oturum ara"
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary" />
            <select value={stage} onChange={(e) => setStage(e.target.value as "all" | Stage)} aria-label="Aşama filtresi"
              className="h-9 w-full rounded-lg border bg-background px-2 text-sm">
              <option value="all">Tümü</option>
              <option value="visit">Ziyaret</option>
              <option value="cart">Sepet</option>
              <option value="checkout">Ödeme</option>
              <option value="purchase">Satın alım</option>
            </select>
          </div>
          <ul className="max-h-[60vh] flex-1 divide-y overflow-y-auto">
            {shown.length === 0 ? (
              <li className="p-6 text-center text-sm text-muted-foreground">Oturum bulunamadı.</li>
            ) : shown.map((s) => {
              const D = s.device === "mobile" ? Smartphone : s.device === "tablet" ? Tablet : Monitor;
              return (
                <li key={s.id} className="flex gap-3 p-3 text-sm">
                  <D className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{s.city || s.country || "Konum bilinmiyor"}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(s.last)}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{s.path ?? "/"}</p>
                    <p className="mt-1 text-xs"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{STAGE_LABEL[s.stage]}</span>
                      {s.source ? <span className="ml-2 text-muted-foreground">{s.source}</span> : null}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
      <LivePagesPanel storeId={storeId} />
    </AppShell>
  );
}

type Stage = "visit" | "cart" | "checkout" | "purchase";
type LiveSession = { id: string; last: string; path: string | null; city: string | null; country: string | null; device: string | null; source: string | null; stage: Stage; events: number };
const STAGE_RANK: Record<Stage, number> = { visit: 0, cart: 1, checkout: 2, purchase: 3 };
const STAGE_LABEL: Record<Stage, string> = { visit: "Geziniyor", cart: "Sepette", checkout: "Ödemede", purchase: "Satın aldı" };
function kindStage(k: string): Stage {
  return k === "add_to_cart" ? "cart" : k === "checkout" ? "checkout" : k === "purchase" ? "purchase" : "visit";
}
