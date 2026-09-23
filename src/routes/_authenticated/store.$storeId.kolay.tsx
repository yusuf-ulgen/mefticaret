import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutTemplate } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Bell,
  BarChart3,
  GraduationCap,
  Package,
  PartyPopper,
  Share2,
  ShoppingBag,
  ShoppingBasket,
  Store,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { KitchenModeButton, MentorCard } from "@/components/homemaker/kitchen-mentor";
import { AcademyDrawer } from "@/components/homemaker/academy-drawer";
import { CampaignSheet, type CampaignBanner } from "@/components/homemaker/campaign-sheet";
import { CustomersTab } from "@/components/homemaker/customers-tab";
import { EarningsBar } from "@/components/homemaker/earnings-bar";
import { InsightsTab } from "@/components/homemaker/insights-tab";
import { ShareSheet, Sheet } from "@/components/homemaker/kolay-parts";
import { OnboardingWizard } from "@/components/homemaker/onboarding-wizard";
import { OrdersTab } from "@/components/homemaker/orders-tab";
import { PackagingTab } from "@/components/homemaker/packaging-tab";
import { ProductsTab } from "@/components/homemaker/products-tab";
import { PromoCard } from "@/components/homemaker/promo-card";
import { ReceiptVerifier } from "@/components/homemaker/receipt-verifier";
import { RemindersCard } from "@/components/homemaker/reminders-card";
import { ShopPageCard } from "@/components/homemaker/shop-page-card";
import { SetupGuide } from "@/components/homemaker/setup-guide";
import { StoreTab } from "@/components/homemaker/store-tab";
import { useStoreRealtime } from "@/hooks/use-store-realtime";
import { speakTurkish } from "@/hooks/use-voice";
import { isStoreToday, QUOTA_EXCLUDED_STATUSES } from "@/lib/day-window";
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

type Tab = "store" | "products" | "orders" | "packaging" | "customers" | "insights";

function KolayPanel() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("store");
  const [shareOpen, setShareOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [academyOpen, setAcademyOpen] = useState(false);
  const [origin, setOrigin] = useState("https://mefticaret.com");
  const [bellOpen, setBellOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const liveEvents = useStoreRealtime(storeId, { notify: true });
  const unread = Math.max(0, liveEvents.length - seenCount);

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

  // Canlı sipariş geldiğinde Kolay Panel listelerini de tazele.
  useEffect(() => {
    if (liveEvents.length === 0) return;
    void queryClient.invalidateQueries({ queryKey: ["kolay-orders", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["kolay-finance", storeId] });
  }, [liveEvents.length, queryClient, storeId]);

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
  // Kota sayısı ödeme adımıyla aynı kuralı kullanır: mağazanın yerel günü,
  // iptal/iade siparişler hariç.
  const todayCount = (orders ?? []).filter(
    (order) =>
      isStoreToday(order.placed_at) &&
      !(QUOTA_EXCLUDED_STATUSES as readonly string[]).includes(order.status),
  ).length;
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
    <div className="hm-app min-h-screen bg-hm-sand pb-28 font-sans text-hm-ink">
      <header className="sticky top-0 z-40 border-b border-hm-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
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
            onClick={() => {
              setBellOpen(true);
              setSeenCount(liveEvents.length);
            }}
            aria-label="Yeni sipariş bildirimleri"
            className="relative grid size-11 place-items-center rounded-2xl bg-hm-sand text-hm-ink"
          >
            <Bell className="size-5" />
            {unread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-hm-rose px-1 text-[11px] font-bold text-white">
                {unread}
              </span>
            ) : null}
          </button>
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
          <button
            type="button"
            onClick={() => setAcademyOpen(true)}
            aria-label="1 Dakika Akademi"
            className="grid min-h-12 w-12 place-items-center rounded-2xl bg-hm-sand text-hm-ink"
          >
            <GraduationCap className="size-5" />
          </button>
          <KitchenModeButton storeId={storeId} />
          <Link to="/ev-hanimlari/sablonlar" aria-label="Hazır şablonlar" className="grid size-11 place-items-center rounded-2xl bg-hm-amber-soft text-hm-amber">
            <LayoutTemplate className="size-5" />
          </Link>
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
            <div className="mb-4">
              <SetupGuide
                storeName={store.name}
                logoUrl={store.logo_url ?? null}
                settings={settings ?? null}
                productCount={(products ?? []).length}
                storeUrl={storeUrl}
                onGoToProducts={() => setTab("products")}
              />
            </div>
            <StoreTab store={store} settings={settings ?? null} storeUrl={storeUrl} />
            <div className="mt-4">
              <MentorCard storeId={storeId} storeSlug={store.slug} />
            </div>
            <div className="mt-4">
              <ShopPageCard
                storeUrl={storeUrl}
                storeName={store.name}
                products={products ?? []}
                currency={store.currency ?? "TRY"}
                live={live}
              />
            </div>
            <div className="mt-4 grid gap-4">
              <PromoCard storeId={storeId} currency={store.currency ?? "TRY"} />
              <RemindersCard storeId={storeId} />
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
          <div className="grid gap-4">
            <ReceiptVerifier
              storeId={storeId}
              orders={orders ?? []}
              currency={store.currency ?? "TRY"}
            />
            <OrdersTab
              storeId={storeId}
              storeSlug={store.slug}
              storeName={store.name}
              orders={orders ?? []}
              products={products ?? []}
              currency={store.currency ?? "TRY"}
            />
          </div>
        ) : null}
        {tab === "packaging" ? <PackagingTab storeId={storeId} /> : null}
        {tab === "customers" ? <CustomersTab storeId={storeId} /> : null}
        {tab === "insights" ? <InsightsTab storeId={storeId} /> : null}
      </main>

      <nav
        aria-label="Panel bölümleri"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-hm-line bg-white pb-[env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {(
            [
              ["store", "Mağazam", Store],
              ["products", "Ürünlerim", Package],
              ["orders", "Siparişler", ShoppingBag],
              ["packaging", "Ambalaj", ShoppingBasket],
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

      <Sheet open={bellOpen} title="Bildirimler" onClose={() => setBellOpen(false)}>
        {liveEvents.length === 0 ? (
          <p className="rounded-2xl bg-hm-sand p-4 text-sm text-hm-ink-soft">
            Şu an yeni bildirim yok. Sipariş geldiğinde burada ışık yanar ve ekranda uyarı çıkar.
          </p>
        ) : (
          <div className="grid gap-2">
            {liveEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => {
                  setTab("orders");
                  setBellOpen(false);
                }}
                className="rounded-2xl border border-hm-line bg-white p-3 text-left"
              >
                <p className="text-sm font-semibold text-hm-ink">{event.title}</p>
                <p className="text-xs text-hm-ink-soft">{event.detail}</p>
                <p className="mt-1 text-[11px] text-hm-ink-soft">
                  {new Date(event.at).toLocaleString("tr-TR")}
                </p>
              </button>
            ))}
          </div>
        )}
      </Sheet>

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
      <AcademyDrawer open={academyOpen} onClose={() => setAcademyOpen(false)} />
      <OnboardingWizard storeId={storeId} />
    </div>
  );
}
