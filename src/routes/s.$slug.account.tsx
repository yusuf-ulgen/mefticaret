import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Award,
  CreditCard,
  Gauge,
  Heart,
  LogOut,
  MapPin,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  RotateCcw,
  Settings,
  ShoppingBag,
  Trash2,
  Truck,
  Undo2,
  Wallet,
} from "lucide-react";

import { StorefrontChrome } from "@/components/storefront-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/lib/cart";
import { useFavorites } from "@/lib/favorites";
import {
  cancelMyStoreReturn,
  claimMyStoreAccount,
  createMyStoreReturn,
  deleteMyStoreAddress,
  reorderMyStoreOrder,
  saveMyStoreAddress,
  updateMyStoreProfile,
} from "@/lib/account.functions";
import { myAddressesQuery, myLoyaltyQuery, myOrdersQuery, myReturnsQuery } from "@/lib/account-queries";
import { TIER_LABELS } from "@/lib/account-loyalty.server-types";
import type { MyAddress, MyCustomer, MyOrder } from "@/lib/account.server";
import type { MyReturn } from "@/lib/account-returns.server";
import { RETURN_REASON_LABELS, RETURN_STATUS_LABELS, type ReturnReason, type ReturnStatus } from "@/lib/returns-queries";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatMoney, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/mefti";
import { storefrontQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/account")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(storefrontQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.store.name };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Mağaza bulunamadı" }, { name: "robots", content: "noindex" }] };
    }
    const title = `Hesabım — ${loaderData.name}`;
    const description = `${loaderData.name} müşteri hesabı: sipariş geçmişi, kargo takibi, adres defteri, favoriler ve puanlarınız.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  errorComponent: () => <Fallback text="Hesap sayfası şu anda yüklenemedi." />,
  notFoundComponent: () => <Fallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: AccountPage,
});

function Fallback({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">{text}</h1>
      <Link to="/" className="text-sm underline">
        Mefticaret ana sayfası
      </Link>
    </div>
  );
}

function AccountPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const { user, loading } = useAuth();

  if (!data) return <Fallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme } = data;

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug}>
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        {loading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor…</p>
        ) : user ? (
          <AccountDashboard storeId={store.id} slug={slug} storeName={store.name} />
        ) : (
          <AccountAuth />
        )}
      </div>
    </StorefrontChrome>
  );
}

/* ---------------------------------- Giriş ---------------------------------- */

function AccountAuth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        toast.success("Hesabınız oluşturuldu. Giriş yapılıyor…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Giriş yapıldı.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İşlem başarısız oldu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">{mode === "signin" ? "Hesabıma giriş" : "Üye ol"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          Siparişlerinizi takip etmek, adreslerinizi ve puanlarınızı görmek için giriş yapın.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4">
          {mode === "signup" ? (
            <div className="grid gap-2">
              <Label htmlFor="acc-name">Ad soyad</Label>
              <Input id="acc-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="acc-email">E-posta</Label>
            <Input id="acc-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="acc-pass">Şifre</Label>
            <Input
              id="acc-pass"
              type="password"
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "İşleniyor…" : mode === "signin" ? "Giriş yap" : "Üye ol"}
          </Button>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-left text-sm text-muted-foreground underline"
          >
            {mode === "signin" ? "Hesabınız yok mu? Üye olun" : "Zaten üye misiniz? Giriş yapın"}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

/* --------------------------------- Yardımcılar ------------------------------ */

type Tab = "dashboard" | "orders" | "tracking" | "returns" | "addresses" | "wishlist" | "rewards" | "settings";

const NAV: { key: Tab; label: string; icon: typeof Gauge }[] = [
  { key: "dashboard", label: "Genel Bakış", icon: Gauge },
  { key: "orders", label: "Siparişlerim", icon: ShoppingBag },
  { key: "tracking", label: "Kargo Takip", icon: Truck },
  { key: "returns", label: "İadelerim", icon: Undo2 },
  { key: "addresses", label: "Adres Defterim", icon: MapPin },
  { key: "wishlist", label: "Favorilerim", icon: Heart },
  { key: "rewards", label: "Puanlarım & Kampanyalar", icon: Award },
  { key: "settings", label: "Hesap Ayarları", icon: Settings },
];

const TRACK_STEPS = ["Sipariş alındı", "Hazırlanıyor", "Kargoda", "Teslim edildi"];

function trackIndex(order: MyOrder): number {
  switch (order.status) {
    case "delivered":
      return 3;
    case "shipped":
      return 2;
    case "processing":
    case "packed":
      return 1;
    case "cancelled":
    case "returned":
    case "refunded":
      return -1;
    default:
      return 0;
  }
}

function statusTone(order: MyOrder): "default" | "secondary" | "destructive" | "outline" {
  if (order.status === "delivered") return "default";
  if (["cancelled", "returned", "refunded"].includes(order.status)) return "destructive";
  if (order.status === "shipped") return "secondary";
  return "outline";
}

function itemImage(item: MyOrder["order_items"][number]): string | null {
  const images = item.products?.product_images ?? [];
  const sorted = [...images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return sorted[0]?.url ?? null;
}

function carrierUrl(order: MyOrder): string | null {
  if (!order.tracking_number) return null;
  const carrier = (order.shipping_carrier ?? "").toLowerCase();
  if (carrier.includes("aras")) {
    return `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${encodeURIComponent(order.tracking_number)}`;
  }
  if (carrier.includes("yurtiçi") || carrier.includes("yurtici")) {
    return `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${encodeURIComponent(order.tracking_number)}`;
  }
  if (carrier.includes("mng")) {
    return `https://kargotakip.mngkargo.com.tr/?takipNo=${encodeURIComponent(order.tracking_number)}`;
  }
  return null;
}

/* --------------------------------- Panel ---------------------------------- */

function AccountDashboard({ storeId, slug, storeName }: { storeId: string; slug: string; storeName: string }) {
  const queryClient = useQueryClient();
  const { user, signOut } = useAuth();
  const favorites = useFavorites();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [detailOrder, setDetailOrder] = useState<MyOrder | null>(null);
  const [returnForOrder, setReturnForOrder] = useState<string | null>(null);

  const claimFn = useServerFn(claimMyStoreAccount);
  const claim = useMutation({
    mutationFn: () => claimFn({ data: { storeId } }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["storefront", storeId] });
      if (result.linked) toast.success("Önceki siparişleriniz hesabınıza bağlandı.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Hesap bağlanamadı"),
  });

  useEffect(() => {
    if (user && claim.isIdle) claim.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const claimed = claim.isSuccess;
  const { data: ordersData } = useQuery(myOrdersQuery(storeId, claimed));
  const { data: addressesData } = useQuery(myAddressesQuery(storeId, claimed));
  const { data: returnsData } = useQuery(myReturnsQuery(storeId, claimed));
  const { data: loyaltyData } = useQuery(myLoyaltyQuery(storeId, claimed));

  const customer = ordersData?.customer ?? addressesData?.customer ?? null;
  const orders = useMemo(() => ordersData?.orders ?? [], [ordersData]);
  const addresses = useMemo(() => addressesData?.addresses ?? [], [addressesData]);
  const returns = useMemo(() => returnsData ?? [], [returnsData]);
  const wishlist = favorites.itemsFor(slug);

  const activeShipments = orders.filter((order) => ["shipped", "packed", "processing"].includes(order.status)).length;
  const totalSpent = orders
    .filter((order) => order.payment_status === "paid")
    .reduce((sum, order) => sum + Number(order.grand_total), 0);
  const currency = orders[0]?.currency ?? "TRY";
  const tier = loyaltyData?.account.tier ?? "classic";
  const defaultAddress = addresses.find((address) => address.is_default) ?? addresses[0] ?? null;

  const openReturn = (orderId: string) => {
    setDetailOrder(null);
    setReturnForOrder(orderId);
    setTab("returns");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      {/* Kenar menü */}
      <aside className="grid gap-4">
        <Card>
          <CardContent className="grid gap-3 p-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
              {(customer?.full_name ?? user?.email ?? "?").trim().charAt(0).toUpperCase()}
            </div>
            <div className="grid gap-1">
              <p className="font-semibold leading-tight">{customer?.full_name ?? "Müşteri"}</p>
              <p className="truncate text-xs text-muted-foreground">{customer?.email ?? user?.email}</p>
            </div>
            <Badge className="mx-auto" variant={tier === "classic" ? "outline" : "default"}>
              {TIER_LABELS[tier] ?? "Üye"}
            </Badge>
          </CardContent>
        </Card>

        <nav className="flex gap-2 overflow-x-auto pb-1 lg:grid lg:gap-1 lg:overflow-visible">
          {NAV.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                tab === key
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "bg-card text-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            <span className="whitespace-nowrap">Çıkış Yap</span>
          </button>
        </nav>
      </aside>

      {/* İçerik */}
      <section className="grid gap-6">
        {claim.isPending ? <p className="text-sm text-muted-foreground">Hesabınız hazırlanıyor…</p> : null}

        {tab === "dashboard" ? (
          <>
            <header>
              <h1 className="text-2xl font-semibold">Merhaba {customer?.full_name?.split(" ")[0] ?? ""}</h1>
              <p className="text-sm text-muted-foreground">{storeName} hesabınızın özeti</p>
            </header>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard icon={ShoppingBag} label="Toplam sipariş" value={String(orders.length)} />
              <MetricCard icon={Truck} label="Aktif kargo" value={String(activeShipments)} />
              <MetricCard icon={Wallet} label="Toplam harcama" value={formatMoney(totalSpent, currency)} />
              <MetricCard
                icon={Award}
                label="Puanım"
                value={String(loyaltyData?.account.points_balance ?? 0)}
              />
            </div>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Son siparişler</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setTab("orders")}>
                  Tümü
                </Button>
              </CardHeader>
              <CardContent className="grid gap-2">
                {orders.slice(0, 3).map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setDetailOrder(order)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-medium">{order.order_number}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(order.placed_at)}</span>
                    <Badge variant={statusTone(order)}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
                    <span className="font-semibold">{formatMoney(Number(order.grand_total), order.currency)}</span>
                  </button>
                ))}
                {!orders.length ? <p className="text-sm text-muted-foreground">Henüz siparişiniz yok.</p> : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Varsayılan teslimat adresi</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setTab("addresses")}>
                  <Pencil className="mr-1 h-3.5 w-3.5" /> Düzenle
                </Button>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {defaultAddress ? (
                  <p className="leading-relaxed">
                    <span className="font-medium text-foreground">{defaultAddress.recipient}</span>
                    {defaultAddress.phone ? ` — ${defaultAddress.phone}` : ""}
                    <br />
                    {defaultAddress.line1}
                    <br />
                    {defaultAddress.district ? `${defaultAddress.district} / ` : ""}
                    {defaultAddress.city} {defaultAddress.postal_code ?? ""} · {defaultAddress.country}
                  </p>
                ) : (
                  <p>Kayıtlı adresiniz yok. Adres defterinizden yeni adres ekleyebilirsiniz.</p>
                )}
              </CardContent>
            </Card>
          </>
        ) : null}

        {tab === "orders" ? (
          <OrdersTab orders={orders} onOpen={setDetailOrder} />
        ) : null}

        {tab === "tracking" ? <TrackingTab orders={orders} onOpen={setDetailOrder} /> : null}

        {tab === "returns" ? (
          <ReturnsPanel
            storeId={storeId}
            orders={orders}
            returns={returns}
            preselectOrderId={returnForOrder}
            onPreselectHandled={() => setReturnForOrder(null)}
          />
        ) : null}

        {tab === "addresses" ? (
          customer ? (
            <AddressBook storeId={storeId} addresses={addresses} />
          ) : (
            <p className="text-sm text-muted-foreground">Hesabınız hazırlanıyor…</p>
          )
        ) : null}

        {tab === "wishlist" ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Favorilerim ({wishlist.length})</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {wishlist.map((item) => (
                <div key={item.productSlug} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  {item.image ? (
                    <img src={item.image} alt={item.title} className="h-14 w-14 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/s/$slug/p/$productSlug"
                      params={{ slug, productSlug: item.productSlug }}
                      className="line-clamp-2 text-sm font-medium hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">{formatMoney(item.price, item.currency)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Favoriden çıkar"
                    onClick={() => favorites.remove(slug, item.productSlug)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {!wishlist.length ? (
                <p className="text-sm text-muted-foreground">Favori listeniz boş.</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {tab === "rewards" ? <RewardsTab data={loyaltyData ?? null} currency={currency} /> : null}

        {tab === "settings" ? (
          customer ? (
            <SettingsTab storeId={storeId} customer={customer} />
          ) : (
            <p className="text-sm text-muted-foreground">Hesabınız hazırlanıyor…</p>
          )
        ) : null}
      </section>

      <OrderDetailDialog
        order={detailOrder}
        slug={slug}
        storeId={storeId}
        storeName={storeName}
        onClose={() => setDetailOrder(null)}
        onRequestReturn={openReturn}
      />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="grid gap-1 p-4">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold leading-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

/* -------------------------------- Siparişler -------------------------------- */

type OrderFilter = "all" | "pending" | "delivered" | "returns";

function OrdersTab({ orders, onOpen }: { orders: MyOrder[]; onOpen: (order: MyOrder) => void }) {
  const [filter, setFilter] = useState<OrderFilter>("all");

  const filtered = orders.filter((order) => {
    if (filter === "all") return true;
    if (filter === "delivered") return order.status === "delivered";
    if (filter === "returns") return ["returned", "refunded"].includes(order.status);
    return !["delivered", "cancelled", "returned", "refunded"].includes(order.status);
  });

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle className="text-base">Siparişlerim</CardTitle>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Tümü"],
              ["pending", "Devam eden"],
              ["delivered", "Teslim edilen"],
              ["returns", "İade/İptal"],
            ] as [OrderFilter, string][]
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {filtered.map((order) => (
          <button
            key={order.id}
            type="button"
            onClick={() => onOpen(order)}
            className="grid gap-2 rounded-xl border border-border p-4 text-left hover:bg-muted"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{order.order_number}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(order.placed_at)}</span>
              <span className="font-semibold">{formatMoney(Number(order.grand_total), order.currency)}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={statusTone(order)}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
              <Badge variant="outline">{PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}</Badge>
              <Badge variant="outline">{order.order_items.length} ürün</Badge>
            </div>
          </button>
        ))}
        {!filtered.length ? <p className="text-sm text-muted-foreground">Bu filtrede sipariş yok.</p> : null}
      </CardContent>
    </Card>
  );
}

function TrackSteps({ order }: { order: MyOrder }) {
  const current = trackIndex(order);
  if (current < 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Bu sipariş {ORDER_STATUS_LABELS[order.status] ?? order.status} durumunda, kargo takibi yapılmıyor.
      </p>
    );
  }
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1">
        {TRACK_STEPS.map((step, index) => (
          <div key={step} className="flex flex-1 items-center gap-1">
            <div
              className={`h-2 flex-1 rounded-full ${index <= current ? "bg-primary" : "bg-muted"}`}
              aria-hidden
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] leading-tight text-muted-foreground">
        {TRACK_STEPS.map((step, index) => (
          <span key={step} className={index <= current ? "font-semibold text-foreground" : ""}>
            {step}
          </span>
        ))}
      </div>
    </div>
  );
}

function TrackingTab({ orders, onOpen }: { orders: MyOrder[]; onOpen: (order: MyOrder) => void }) {
  const active = orders.filter((order) => !["cancelled", "refunded"].includes(order.status));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kargo takip</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {active.map((order) => {
          const url = carrierUrl(order);
          return (
            <div key={order.id} className="grid gap-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className="font-semibold hover:underline" onClick={() => onOpen(order)}>
                  {order.order_number}
                </button>
                <Badge variant={statusTone(order)}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
              </div>
              <TrackSteps order={order} />
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {order.tracking_number ? (
                  <>
                    <PackageCheck className="h-4 w-4" />
                    <span>
                      {order.shipping_carrier ?? "Kargo"} · {order.tracking_number}
                    </span>
                    {url ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={url} target="_blank" rel="noreferrer">
                          Kargoyu takip et
                        </a>
                      </Button>
                    ) : null}
                  </>
                ) : (
                  <span>Kargo takip numarası henüz oluşturulmadı.</span>
                )}
              </div>
            </div>
          );
        })}
        {!active.length ? <p className="text-sm text-muted-foreground">Takip edilecek kargo yok.</p> : null}
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Sipariş detayı ------------------------------ */

function OrderDetailDialog({
  order,
  slug,
  storeId,
  storeName,
  onClose,
  onRequestReturn,
}: {
  order: MyOrder | null;
  slug: string;
  storeId: string;
  storeName: string;
  onClose: () => void;
  onRequestReturn: (orderId: string) => void;
}) {
  const cart = useCart();
  const reorderFn = useServerFn(reorderMyStoreOrder);
  const [busy, setBusy] = useState(false);

  if (!order) return null;
  const url = carrierUrl(order);

  const handleReorder = async () => {
    setBusy(true);
    try {
      const result = await reorderFn({ data: { storeId, orderId: order.id } });
      for (const line of result.lines) {
        cart.add(
          {
            storeSlug: slug,
            variantId: line.variantId,
            productSlug: line.productSlug,
            title: line.title,
            variantTitle: line.variantTitle,
            price: line.price,
            currency: line.currency,
            maxStock: line.maxStock,
          },
          line.quantity,
        );
      }
      if (!result.lines.length) toast.error("Bu siparişteki ürünler şu anda satın alınamıyor.");
      else if (result.skipped.length) toast.success(`${result.lines.length} ürün sepete eklendi. Stokta olmayanlar atlandı.`);
      else toast.success("Sipariş sepete eklendi.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sepete eklenemedi.");
    } finally {
      setBusy(false);
    }
  };

  const printInvoice = () => {
    const rows = order.order_items
      .map(
        (item) =>
          `<tr><td>${item.title}${item.variant_title ? ` — ${item.variant_title}` : ""}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right">${formatMoney(Number(item.line_total), order.currency)}</td></tr>`,
      )
      .join("");
    const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${order.order_number}</title>
      <style>body{font-family:system-ui,sans-serif;padding:32px;color:#111}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border-bottom:1px solid #ddd;padding:8px;font-size:13px}</style>
      </head><body><h1>${storeName}</h1>
      <p>Sipariş: <strong>${order.order_number}</strong><br>Tarih: ${formatDateTime(order.placed_at)}</p>
      <table><thead><tr><th style="text-align:left">Ürün</th><th>Adet</th><th style="text-align:right">Tutar</th></tr></thead><tbody>${rows}</tbody></table>
      <p style="margin-top:16px;text-align:right;font-size:16px"><strong>Genel toplam: ${formatMoney(Number(order.grand_total), order.currency)}</strong></p>
      <script>window.onload=()=>window.print()</script></body></html>`;
    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) {
      toast.error("Yazdırma penceresi açılamadı. Tarayıcı izinlerini kontrol edin.");
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3">
            {order.order_number}
            <Badge variant={statusTone(order)}>{ORDER_STATUS_LABELS[order.status] ?? order.status}</Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(order.placed_at)} · {formatMoney(Number(order.grand_total), order.currency)}
          </p>
        </DialogHeader>

        <div className="grid gap-5">
          <TrackSteps order={order} />
          <Separator />
          <div className="grid gap-3">
            {order.order_items.map((item) => {
              const image = itemImage(item);
              return (
                <div key={item.id} className="flex items-center gap-3">
                  {image ? (
                    <img src={image} alt={item.title} className="h-14 w-14 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{item.title}</p>
                    <p className="text-muted-foreground">
                      {item.variant_title ? `${item.variant_title} · ` : ""}
                      {item.quantity} adet × {formatMoney(Number(item.unit_price), order.currency)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{formatMoney(Number(item.line_total), order.currency)}</span>
                </div>
              );
            })}
          </div>
          {order.tracking_number ? (
            <p className="text-sm text-muted-foreground">
              Kargo: {order.shipping_carrier ?? ""} · {order.tracking_number}
            </p>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-start">
          {url ? (
            <Button asChild variant="outline" size="sm">
              <a href={url} target="_blank" rel="noreferrer">
                <Truck className="mr-1 h-4 w-4" /> Kargo takip
              </a>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={printInvoice}>
            <CreditCard className="mr-1 h-4 w-4" /> Fatura / belge (PDF)
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleReorder()} disabled={busy}>
            <RotateCcw className="mr-1 h-4 w-4" /> {busy ? "Ekleniyor…" : "Yeniden sipariş ver"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => onRequestReturn(order.id)}>
            <Undo2 className="mr-1 h-4 w-4" /> İade / değişim talebi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- İadeler --------------------------------- */

function ReturnsPanel({
  storeId,
  orders,
  returns,
  preselectOrderId,
  onPreselectHandled,
}: {
  storeId: string;
  orders: MyOrder[];
  returns: MyReturn[];
  preselectOrderId: string | null;
  onPreselectHandled: () => void;
}) {
  const queryClient = useQueryClient();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [reason, setReason] = useState<ReturnReason>("changed_mind");
  const [note, setNote] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const createFn = useServerFn(createMyStoreReturn);
  const cancelFn = useServerFn(cancelMyStoreReturn);

  const openReturnNumbers = new Set(
    returns.filter((row) => !["rejected", "cancelled"].includes(row.status)).map((row) => row.orders?.order_number),
  );
  const eligible = orders.filter(
    (order) =>
      ["paid", "partially_refunded"].includes(order.payment_status) && !openReturnNumbers.has(order.order_number),
  );
  const selected = eligible.find((order) => order.id === orderId) ?? null;

  useEffect(() => {
    if (!preselectOrderId) return;
    if (eligible.some((order) => order.id === preselectOrderId)) setOrderId(preselectOrderId);
    else toast.error("Bu sipariş için iade talebi açılamıyor.");
    onPreselectHandled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectOrderId]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["storefront", storeId, "my-returns"] });
    void queryClient.invalidateQueries({ queryKey: ["storefront", storeId, "my-orders"] });
  };

  const reset = () => {
    setOrderId(null);
    setQuantities({});
    setNote("");
    setReason("changed_mind");
  };

  const create = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Sipariş seçin");
      const items = Object.entries(quantities)
        .filter(([, quantity]) => quantity > 0)
        .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
      if (!items.length) throw new Error("En az bir ürün ve adet seçmelisiniz.");
      return createFn({ data: { storeId, orderId: selected.id, reason, customerNote: note || undefined, items } });
    },
    onSuccess: (result) => {
      toast.success(`İade talebiniz oluşturuldu: ${result.returnNumber}`);
      reset();
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "İade talebi oluşturulamadı"),
  });

  const cancel = useMutation({
    mutationFn: (returnId: string) => cancelFn({ data: { storeId, returnId } }),
    onSuccess: () => {
      toast.success("İade talebi iptal edildi");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Talep iptal edilemedi"),
  });

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">İade taleplerim</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {returns.map((row) => (
            <div key={row.id} className="grid gap-2 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{row.return_number}</span>
                <span className="text-xs text-muted-foreground">
                  {row.orders?.order_number ?? ""} · {formatDateTime(row.created_at)}
                </span>
                <span className="font-semibold">{formatMoney(Number(row.refund_amount), row.currency)}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{RETURN_STATUS_LABELS[row.status as ReturnStatus] ?? row.status}</Badge>
                <Badge variant="outline">{RETURN_REASON_LABELS[row.reason as ReturnReason] ?? row.reason}</Badge>
              </div>
              <ul className="grid gap-1 text-sm text-muted-foreground">
                {row.return_items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3">
                    <span>
                      {item.title}
                      {item.variant_title ? ` — ${item.variant_title}` : ""} × {item.quantity}
                    </span>
                    <span>{formatMoney(Number(item.line_total), row.currency)}</span>
                  </li>
                ))}
              </ul>
              {row.staff_note ? <p className="text-sm text-muted-foreground">Mağaza notu: {row.staff_note}</p> : null}
              {row.status === "requested" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-self-start"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate(row.id)}
                >
                  Talebi iptal et
                </Button>
              ) : null}
            </div>
          ))}
          {!returns.length ? <p className="text-sm text-muted-foreground">Henüz iade talebiniz yok.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Yeni iade / değişim talebi</CardTitle>
        </CardHeader>
        <CardContent>
          {selected ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                create.mutate();
              }}
              className="grid gap-4"
            >
              <p className="text-sm font-medium">{selected.order_number}</p>
              <div className="grid gap-2">
                {selected.order_items.map((item) => (
                  <label key={item.id} className="flex items-center gap-3 text-sm">
                    <span className="flex-1">
                      {item.title}
                      {item.variant_title ? ` — ${item.variant_title}` : ""}
                      <span className="text-muted-foreground"> (sipariş adedi {item.quantity})</span>
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={item.quantity}
                      className="w-20"
                      value={quantities[item.id] ?? 0}
                      onChange={(event) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [item.id]: Math.max(0, Math.min(item.quantity, Number(event.target.value) || 0)),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ret-reason">İade nedeni</Label>
                <select
                  id="ret-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value as ReturnReason)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {(Object.keys(RETURN_REASON_LABELS) as ReturnReason[]).map((key) => (
                    <option key={key} value={key}>
                      {RETURN_REASON_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea
                placeholder="Açıklama (opsiyonel)"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <div className="flex gap-2">
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Gönderiliyor…" : "Talebi gönder"}
                </Button>
                <Button type="button" variant="outline" onClick={reset}>
                  Vazgeç
                </Button>
              </div>
            </form>
          ) : eligible.length ? (
            <div className="grid gap-2">
              <Label htmlFor="ret-order">İade edilecek sipariş</Label>
              <select
                id="ret-order"
                value=""
                onChange={(event) => setOrderId(event.target.value || null)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sipariş seçin…</option>
                {eligible.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.order_number} — {formatMoney(Number(order.grand_total), order.currency)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">İade talebi açılabilecek uygun siparişiniz bulunmuyor.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* --------------------------------- Adresler -------------------------------- */

const emptyAddress = {
  id: undefined as string | undefined,
  label: "",
  recipient: "",
  phone: "",
  country: "Türkiye",
  city: "",
  district: "",
  line1: "",
  postalCode: "",
  isDefault: false,
};

function AddressBook({ storeId, addresses }: { storeId: string; addresses: MyAddress[] }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<typeof emptyAddress | null>(null);

  const saveFn = useServerFn(saveMyStoreAddress);
  const deleteFn = useServerFn(deleteMyStoreAddress);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["storefront", storeId, "my-addresses"] });

  const save = useMutation({
    mutationFn: () => {
      if (!form) throw new Error("Form boş");
      return saveFn({
        data: {
          storeId,
          id: form.id,
          label: form.label || undefined,
          recipient: form.recipient,
          phone: form.phone || undefined,
          country: form.country,
          city: form.city,
          district: form.district || undefined,
          line1: form.line1,
          postalCode: form.postalCode || undefined,
          isDefault: form.isDefault,
        },
      });
    },
    onSuccess: () => {
      toast.success("Adres kaydedildi");
      setForm(null);
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Adres kaydedilemedi"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("Adres silindi");
      invalidate();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Adres silinemedi"),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Adres defterim</CardTitle>
        <Button size="sm" onClick={() => setForm({ ...emptyAddress })}>
          <Plus className="mr-1 h-4 w-4" /> Yeni adres
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {addresses.map((address) => (
          <div key={address.id} className="grid gap-2 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{address.label ?? "Adres"}</span>
              {address.is_default ? <Badge>Varsayılan</Badge> : null}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {address.recipient}
              {address.phone ? ` — ${address.phone}` : ""}
              <br />
              {address.line1}
              <br />
              {address.district ? `${address.district} / ` : ""}
              {address.city} {address.postal_code ?? ""}
              <br />
              {address.country}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setForm({
                    id: address.id,
                    label: address.label ?? "",
                    recipient: address.recipient,
                    phone: address.phone ?? "",
                    country: address.country,
                    city: address.city ?? "",
                    district: address.district ?? "",
                    line1: address.line1,
                    postalCode: address.postal_code ?? "",
                    isDefault: address.is_default,
                  })
                }
              >
                <Pencil className="mr-1 h-3.5 w-3.5" /> Düzenle
              </Button>
              <Button size="sm" variant="outline" onClick={() => remove.mutate(address.id)} disabled={remove.isPending}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Sil
              </Button>
            </div>
          </div>
        ))}
        {!addresses.length ? <p className="text-sm text-muted-foreground">Kayıtlı adresiniz yok.</p> : null}
      </CardContent>

      <Dialog open={Boolean(form)} onOpenChange={(open) => (open ? null : setForm(null))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Adresi düzenle" : "Yeni adres"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
              className="grid gap-4"
            >
              <div className="grid gap-2">
                <Label htmlFor="ad-label">Adres adı</Label>
                <Input
                  id="ad-label"
                  placeholder="Ev, İş…"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ad-recipient">Alıcı adı soyadı</Label>
                <Input
                  id="ad-recipient"
                  required
                  value={form.recipient}
                  onChange={(e) => setForm({ ...form, recipient: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ad-phone">Telefon</Label>
                <Input id="ad-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ad-city">Şehir</Label>
                  <Input id="ad-city" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ad-district">İlçe</Label>
                  <Input
                    id="ad-district"
                    value={form.district}
                    onChange={(e) => setForm({ ...form, district: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ad-line1">Açık adres</Label>
                <Textarea
                  id="ad-line1"
                  required
                  value={form.line1}
                  onChange={(e) => setForm({ ...form, line1: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="ad-country">Ülke</Label>
                  <Input
                    id="ad-country"
                    required
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ad-postal">Posta kodu</Label>
                  <Input
                    id="ad-postal"
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label htmlFor="ad-default">Varsayılan adresim olsun</Label>
                <Switch
                  id="ad-default"
                  checked={form.isDefault}
                  onCheckedChange={(checked) => setForm({ ...form, isDefault: checked })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>
                  Vazgeç
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Kaydediliyor…" : "Kaydet"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* --------------------------------- Puanlar --------------------------------- */

function RewardsTab({
  data,
  currency,
}: {
  data: { account: { points_balance: number; lifetime_points: number; tier: string }; transactions: { id: string; kind: string; points: number; description: string | null; created_at: string }[]; campaigns: { id: string; code: string; title: string; type: string; value: number; min_subtotal: number | null; ends_at: string | null }[] } | null;
  currency: string;
}) {
  const account = data?.account ?? { points_balance: 0, lifetime_points: 0, tier: "classic" };
  const nextThreshold = account.lifetime_points >= 5000 ? null : account.lifetime_points >= 1000 ? 5000 : 1000;
  const progress = nextThreshold ? Math.min(100, Math.round((account.lifetime_points / nextThreshold) * 100)) : 100;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Puanlarım</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <MetricCard icon={Award} label="Kullanılabilir puan" value={String(account.points_balance)} />
            <MetricCard icon={Gauge} label="Toplam kazanılan" value={String(account.lifetime_points)} />
            <MetricCard icon={Wallet} label="Seviye" value={TIER_LABELS[account.tier] ?? "Üye"} />
          </div>
          <div className="grid gap-1">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              {nextThreshold
                ? `Bir sonraki seviye için ${nextThreshold - account.lifetime_points} puan daha gerekiyor.`
                : "En yüksek üyelik seviyesindesiniz."}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Her 10 {currency} alışverişte 1 puan kazanırsınız; puanlar sipariş ödemesi tamamlandığında hesabınıza işlenir.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Puan hareketleri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {(data?.transactions ?? []).map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm last:border-0">
              <span>{row.description ?? (row.kind === "earn" ? "Puan kazanımı" : "Puan hareketi")}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(row.created_at)}</span>
              <span className="font-semibold">{row.kind === "earn" ? "+" : "-"}{Math.abs(row.points)}</span>
            </div>
          ))}
          {!data?.transactions.length ? (
            <p className="text-sm text-muted-foreground">Henüz puan hareketiniz yok.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Güncel kampanyalar</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {(data?.campaigns ?? []).map((campaign) => (
            <div key={campaign.id} className="grid gap-1 rounded-xl border border-border p-4">
              <p className="font-medium">{campaign.title}</p>
              <p className="text-sm text-muted-foreground">
                {campaign.type === "percentage"
                  ? `%${campaign.value} indirim`
                  : `${formatMoney(Number(campaign.value), currency)} indirim`}
                {campaign.min_subtotal
                  ? ` · ${formatMoney(Number(campaign.min_subtotal), currency)} ve üzeri alışverişte`
                  : ""}
              </p>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">{campaign.code}</Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard?.writeText(campaign.code);
                    toast.success("Kod kopyalandı");
                  }}
                >
                  Kodu kopyala
                </Button>
              </div>
              {campaign.ends_at ? (
                <p className="text-xs text-muted-foreground">Bitiş: {formatDateTime(campaign.ends_at)}</p>
              ) : null}
            </div>
          ))}
          {!data?.campaigns.length ? (
            <p className="text-sm text-muted-foreground">Şu anda yayında kampanya yok.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------- Hesap ayarları ---------------------------- */

function SettingsTab({ storeId, customer }: { storeId: string; customer: MyCustomer }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(customer.full_name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(customer.date_of_birth ?? "");
  const [marketing, setMarketing] = useState(customer.accepts_marketing);
  const [sms, setSms] = useState(customer.accepts_sms);
  const [whatsapp, setWhatsapp] = useState(customer.accepts_whatsapp);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updateFn = useServerFn(updateMyStoreProfile);
  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          storeId,
          fullName,
          phone: phone || undefined,
          dateOfBirth: dateOfBirth || undefined,
          acceptsMarketing: marketing,
          acceptsSms: sms,
          acceptsWhatsapp: whatsapp,
        },
      }),
    onSuccess: () => {
      toast.success("Bilgileriniz güncellendi");
      void queryClient.invalidateQueries({ queryKey: ["storefront", storeId, "my-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["storefront", storeId, "my-addresses"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Güncellenemedi"),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 8) throw new Error("Yeni şifre en az 8 karakter olmalı.");
      if (newPassword !== confirmPassword) throw new Error("Yeni şifreler birbiriyle aynı değil.");
      if (!customer.email) throw new Error("Hesabınızda e-posta adresi bulunamadı.");
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: customer.email,
        password: currentPassword,
      });
      if (signInError) throw new Error("Mevcut şifreniz doğru değil.");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Şifreniz güncellendi");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Şifre güncellenemedi"),
  });

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kişisel bilgiler</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
            className="grid gap-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="pf-name">Ad soyad</Label>
                <Input id="pf-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pf-email">E-posta</Label>
                <Input id="pf-email" value={customer.email ?? ""} disabled />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pf-phone">Telefon</Label>
                <Input id="pf-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pf-dob">Doğum tarihi</Label>
                <Input id="pf-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>
            </div>
            <Separator />
            <p className="text-sm font-medium">İletişim tercihleri</p>
            <div className="grid gap-2">
              <PrefRow id="pf-mk" label="E-posta bülteni" checked={marketing} onChange={setMarketing} />
              <PrefRow id="pf-sms" label="SMS sipariş bildirimleri" checked={sms} onChange={setSms} />
              <PrefRow id="pf-wa" label="WhatsApp güncellemeleri" checked={whatsapp} onChange={setWhatsapp} />
            </div>
            <Button type="submit" className="justify-self-start" disabled={save.isPending}>
              {save.isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Şifre değiştir</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              changePassword.mutate();
            }}
            className="grid gap-4 sm:max-w-md"
          >
            <div className="grid gap-2">
              <Label htmlFor="pw-current">Mevcut şifre</Label>
              <Input
                id="pw-current"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pw-new">Yeni şifre</Label>
              <Input
                id="pw-new"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pw-confirm">Yeni şifre (tekrar)</Label>
              <Input
                id="pw-confirm"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="justify-self-start" disabled={changePassword.isPending}>
              {changePassword.isPending ? "Güncelleniyor…" : "Şifreyi güncelle"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function PrefRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
