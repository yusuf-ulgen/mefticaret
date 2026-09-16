import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Package,
  PartyPopper,
  Share2,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CampaignSheet, type CampaignBanner } from "@/components/homemaker/campaign-sheet";
import { CustomersTab } from "@/components/homemaker/customers-tab";
import { EarningsBar } from "@/components/homemaker/earnings-bar";
import { InsightsTab } from "@/components/homemaker/insights-tab";
import { ShareSheet } from "@/components/homemaker/kolay-parts";
import { OnboardingWizard } from "@/components/homemaker/onboarding-wizard";
import { OrdersTab } from "@/components/homemaker/orders-tab";
import { ProductsTab } from "@/components/homemaker/products-tab";
import { ShopPageCard } from "@/components/homemaker/shop-page-card";
import { StoreTab } from "@/components/homemaker/store-tab";
import { speakTurkish } from "@/hooks/use-voice";
import { simpleOrdersQuery, simpleProductsQuery } from "@/lib/homemaker-queries";
import { storeQuery, storeSettingsQuery } from "@/lib/store-queries";
import { updateStore } from "@/lib/stores.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/kolay")({
  head: () => ({
    meta: [
      { title: "Kolay Panel — Mefticaret" },
      {
        name: "description",
        content:
          "Ev üretimi mağazalar için sade panel: mağazanı tanıt, ürün ekle, siparişlerini takip et.",
      },
      { property: "og:title", content: "Kolay Panel — Mefticaret" },
      {
        property: "og:description",
        content: "Telefonundan mağaza, ürün ve sipariş yönetimi. Karmaşık ayar yok.",
      },
      { name: "theme-color", content: "#ffffff" },
    ],
  }),
  component: KolayPanel,
});

type Tab = "store" | "products" | "orders" | "customers" | "insights";

function KolayPanel() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("store");
  const [shareOpen, setShareOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [origin, setOrigin] = useState("https://mefticaret.com");

  const { data: store } = useQuery(storeQuery(storeId));
  const {
    data: settings,
    isPending: settingsPending,
    isError: settingsError,
    refetch: refetchSettings,
  } = useQuery(storeSettingsQuery(storeId));
  const { data: products } = useQuery(simpleProductsQuery(storeId));
  const { data: orders } = useQuery(simpleOrdersQuery(storeId));
  const saveStore = useServerFn(updateStore);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Sesli sipariş bildirimi: yalnızca ayar açıkken ve gerçekten yeni sipariş geldiğinde okur.
  const seenOrders = useRef<Set<string> | null>(null);
  const voiceAlerts = Boolean((settings as { voice_alerts?: boolean | null } | null)?.voice_alerts);
  useEffect(() => {
    const list = orders ?? [];
    if (seenOrders.current === null) {
      seenOrders.current = new Set(list.map((order) => order.id));
      return;
    }
    const fresh = list.filter((order) => !seenOrders.current?.has(order.id));
    fresh.forEach((order) => seenOrders.current?.add(order.id));
    if (!voiceAlerts || fresh.length === 0) return;
    const order = fresh[0]!;
    const first = order.items[0];
    const detail = first ? `${first.quantity} adet ${first.title}` : "yeni bir";
    speakTurkish(`Yeni sipariş: ${order.customer_name ?? "Bir müşteri"} ${detail} siparişi verdi.`);
  }, [orders, voiceAlerts]);

  const dailyLimit = Number(
    (settings as { daily_order_limit?: number | null } | null)?.daily_order_limit ?? 0,
  );
  const todayCount = (orders ?? []).filter((order) => {
    if (!order.placed_at) return false;
    const placed = new Date(order.placed_at);
    const now = new Date();
    return placed.toDateString() === now.toDateString();
  }).length;
  const capacityFull = dailyLimit > 0 && todayCount >= dailyLimit;
  const campaign = ((settings as { campaign_banner?: CampaignBanner } | null)?.campaign_banner ??
    null) as CampaignBanner;

  if (!store) {
    return (
      <div className="grid min-h-screen place-items-center bg-hm-sand text-hm-ink-soft">
        Yükleniyor…
      </div>
    );
  }

  const storeUrl = `${origin}/s/${store.slug}`;
  const live = store.status === "active";

  const toggleLive = async () => {
    try {
      await saveStore({
        data: { storeId, patch: { status: live ? "draft" : "active" } },
      });
      await queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      toast.success(live ? "Mağazanız bakıma alındı" : "Mağazanız canlıda");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Değiştirilemedi");
    }
  };

  return (
    <div className="min-h-screen bg-hm-sand pb-28 font-sans text-hm-ink">
      <header className="sticky top-0 z-40 border-b border-hm-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link
            to="/store/$storeId"
            params={{ storeId }}
            aria-label="Tam panele dön"
            className="grid size-10 shrink-0 place-items-center rounded-2xl bg-hm-sand text-hm-ink-soft"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="size-10 shrink-0 overflow-hidden rounded-2xl bg-hm-sand">
            {store.logo_url ? (
              <img src={store.logo_url} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{store.name}</p>
            <button
              type="button"
              onClick={toggleLive}
              className={`mt-0.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                live ? "bg-hm-emerald-soft text-hm-emerald" : "bg-hm-rose-soft text-hm-rose"
              }`}
            >
              <span className={`size-2 rounded-full ${live ? "bg-hm-emerald" : "bg-hm-rose"}`} />
              {live ? "Canlı" : "Bakımda"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            aria-label="Mağazamı paylaş"
            className="grid size-11 place-items-center rounded-2xl bg-hm-rose text-white"
          >
            <Share2 className="size-5" />
          </button>
        </div>
        <EarningsBar storeId={storeId} />
        <div className="mx-auto flex w-full max-w-lg gap-2 px-4 pb-2">
          <button
            type="button"
            onClick={() => setCampaignOpen(true)}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-hm-rose-soft px-3 text-sm font-semibold text-hm-rose"
          >
            <PartyPopper className="size-4" />
            {campaign?.code ? "Kampanyam açık" : "Özel gün kampanyası başlat"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4">
        {campaign?.message ? (
          <div className="mb-4 rounded-3xl bg-hm-emerald-soft px-4 py-3 text-sm font-semibold text-hm-emerald">
            {campaign.message}
          </div>
        ) : null}
        {capacityFull ? (
          <div className="mb-4 flex items-center gap-2 rounded-3xl bg-hm-rose-soft px-4 py-3 text-sm font-semibold text-hm-rose">
            <AlertTriangle className="size-5 shrink-0" />
            Günlük kapasite doldu — bugün {dailyLimit} sipariş aldınız, mağazanız yeni sipariş
            almıyor.
          </div>
        ) : null}
        {tab === "store" && settingsPending ? (
          <div className="grid min-h-48 place-items-center rounded-3xl border border-hm-line bg-white text-sm text-hm-ink-soft">
            Mağaza bilgileriniz yükleniyor…
          </div>
        ) : null}
        {tab === "store" && settingsError ? (
          <div className="grid min-h-48 place-items-center gap-3 rounded-3xl border border-hm-line bg-white p-6 text-center">
            <p className="text-sm text-hm-ink-soft">
              Mağaza bilgileriniz yüklenemedi. Bilgileriniz korunuyor.
            </p>
            <button
              type="button"
              onClick={() => void refetchSettings()}
              className="min-h-11 rounded-2xl bg-hm-rose px-5 text-sm font-semibold text-white"
            >
              Tekrar dene
            </button>
          </div>
        ) : null}
        {tab === "store" && !settingsPending && !settingsError ? (
          <>
            <StoreTab store={store} settings={settings ?? null} storeUrl={storeUrl} />
            <div className="mt-4">
              <ShopPageCard
                storeUrl={storeUrl}
                storeName={store.name}
                products={products ?? []}
                currency={store.currency ?? "TRY"}
                live={live}
              />
            </div>
          </>
        ) : null}
        {tab === "products" ? (
          <ProductsTab
            storeId={storeId}
            storeName={store.name}
            storeUrl={storeUrl}
            storeLogo={store.logo_url}
            products={products ?? []}
            currency={store.currency ?? "TRY"}
          />
        ) : null}
        {tab === "orders" ? (
          <OrdersTab
            storeId={storeId}
            storeSlug={store.slug}
            orders={orders ?? []}
            products={products ?? []}
            currency={store.currency ?? "TRY"}
          />
        ) : null}
        {tab === "customers" ? <CustomersTab storeId={storeId} /> : null}
        {tab === "insights" ? <InsightsTab storeId={storeId} /> : null}
      </main>

      <nav
        aria-label="Panel bölümleri"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hm-line bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {(
            [
              ["store", "Mağazam", Store],
              ["products", "Ürünlerim", Package],
              ["orders", "Siparişler", ShoppingBag],
              ["customers", "Müşteriler", Users],
              ["insights", "Raporlar", BarChart3],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`grid min-h-16 place-items-center gap-1 px-0.5 py-2 text-[11px] font-semibold leading-tight transition-colors ${
                tab === key ? "text-hm-rose" : "text-hm-ink-soft"
              }`}
            >
              <Icon className="size-5" />
              <span className="w-full truncate text-center">{label}</span>
            </button>
          ))}
        </div>
      </nav>

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={storeUrl}
        storeName={store.name}
      />
      <CampaignSheet
        open={campaignOpen}
        onClose={() => setCampaignOpen(false)}
        storeId={storeId}
        banner={campaign}
      />
      <OnboardingWizard storeId={storeId} />
    </div>
  );
}
