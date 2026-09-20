import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { Boxes, Repeat, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatMoney } from "@/lib/mefti";
import {
  CUSTOMER_SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_INTERVAL_PRESETS,
  WALLET_KIND_LABELS,
  intervalLabel,
  subscriberPrice,
  subscriptionCommitmentValue,
} from "@/lib/retention";
import {
  addWalletTransactionFn,
  deleteSubscriptionPlanFn,
  enrollSubscriptionFn,
  fetchSubscriptionPlans,
  fetchWallets,
  saveSubscriptionPlanFn,
  setSubscriptionStatusFn,
  simulateOrderSplitFn,
} from "@/lib/retention.functions";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/retention")({
  head: () => ({
    meta: [
      { title: "Abonelik & Cüzdan — Mefticaret" },
      {
        name: "description",
        content:
          "Tüketilebilir ürünler için abonelik planları kurun, müşteri cüzdanı bakiyesi yönetin ve siparişleri depolar arasında akıllıca bölün.",
      },
      { property: "og:title", content: "Abonelik & Cüzdan — Mefticaret" },
      {
        property: "og:description",
        content: "Abonelik ticareti, mağaza cüzdanı ve akıllı sipariş bölme tek ekranda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RetentionPage,
});

const subscriptionsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["subscription-commerce", storeId],
    queryFn: () => fetchSubscriptionPlans({ data: { storeId } }),
  });

const walletsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["customer-wallets", storeId],
    queryFn: () => fetchWallets({ data: { storeId } }),
  });

function RetentionPage() {
  const { storeId } = Route.useParams();
  const { data: store } = useQuery(storeQuery(storeId));
  const currency = store?.currency ?? "TRY";

  return (
    <AppShell storeId={storeId} title="Abonelik & Cüzdan">
      <div className="space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Sadakat</p>
          <h1 className="mt-1 text-2xl font-semibold">Abonelik & Cüzdan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {store?.name ?? "Mağaza"} için tekrarlayan satış planları, müşteri cüzdanı bakiyesi ve
            siparişleri depolar arasında bölen akıllı sevkiyat.
          </p>
        </header>

        <Tabs defaultValue="plans">
          <TabsList className="flex w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="plans">Abonelik Planları</TabsTrigger>
            <TabsTrigger value="subscribers">Aboneler</TabsTrigger>
            <TabsTrigger value="wallet">Mağaza Cüzdanı</TabsTrigger>
            <TabsTrigger value="split">Akıllı Sipariş Bölme</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="mt-5">
            <PlansTab storeId={storeId} currency={currency} />
          </TabsContent>
          <TabsContent value="subscribers" className="mt-5">
            <SubscribersTab storeId={storeId} currency={currency} />
          </TabsContent>
          <TabsContent value="wallet" className="mt-5">
            <WalletTab storeId={storeId} currency={currency} />
          </TabsContent>
          <TabsContent value="split" className="mt-5">
            <SplitTab storeId={storeId} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function PlansTab({ storeId, currency }: { storeId: string; currency: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(subscriptionsQuery(storeId));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("Aylık teslimat");
  const [productId, setProductId] = useState<string>("");
  const [intervalDays, setIntervalDays] = useState("30");
  const [discountPercent, setDiscountPercent] = useState("10");
  const [minCycles, setMinCycles] = useState("3");
  const [isActive, setIsActive] = useState(true);

  const products = data?.products ?? [];
  const selectedProduct = products.find((item) => item.id === productId);
  const basePrice = selectedProduct?.basePrice ?? 0;
  const discountValue = Number(discountPercent) || 0;

  const save = useMutation({
    mutationFn: () =>
      saveSubscriptionPlanFn({
        data: {
          storeId,
          id: editingId,
          productId: productId || null,
          name: name.trim(),
          intervalDays: Math.max(1, Number(intervalDays) || 30),
          discountPercent: Math.min(90, Math.max(0, discountValue)),
          minCycles: Math.max(1, Number(minCycles) || 1),
          isActive,
        },
      }),
    onSuccess: async () => {
      toast.success(editingId ? "Plan güncellendi" : "Abonelik planı oluşturuldu");
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ["subscription-commerce", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSubscriptionPlanFn({ data: { storeId, id } }),
    onSuccess: async () => {
      toast.success("Plan silindi");
      await queryClient.invalidateQueries({ queryKey: ["subscription-commerce", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Repeat className="size-4 text-brand" />
          {editingId ? "Planı düzenle" : "Yeni abonelik planı"}
        </h2>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Plan adı</Label>
            <Input id="plan-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Ürün</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Tüm ürünler için geçerli" />
              </SelectTrigger>
              <SelectContent>
                {products.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tekrar aralığı</Label>
            <Select value={intervalDays} onValueChange={setIntervalDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBSCRIPTION_INTERVAL_PRESETS.map((preset) => (
                  <SelectItem key={preset.days} value={String(preset.days)}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-discount">Abone indirimi (%)</Label>
              <Input
                id="plan-discount"
                type="number"
                min={0}
                max={90}
                value={discountPercent}
                onChange={(event) => setDiscountPercent(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-cycles">En az döngü</Label>
              <Input
                id="plan-cycles"
                type="number"
                min={1}
                value={minCycles}
                onChange={(event) => setMinCycles(event.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-xl border px-3 py-2">
            <span className="text-sm">Plan aktif</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {selectedProduct ? (
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <p>
                Liste fiyatı <strong>{formatMoney(basePrice, currency)}</strong> → abone fiyatı{" "}
                <strong>{formatMoney(subscriberPrice(basePrice, discountValue), currency)}</strong>
              </p>
              <p className="mt-1 text-muted-foreground">
                {intervalLabel(Number(intervalDays) || 30)} · taahhüt değeri{" "}
                {formatMoney(
                  subscriptionCommitmentValue(basePrice, discountValue, 1, Number(minCycles) || 1),
                  currency,
                )}
              </p>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
              {editingId ? "Kaydet" : "Plan oluştur"}
            </Button>
            {editingId ? (
              <Button variant="outline" onClick={() => setEditingId(null)}>
                Vazgeç
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Planlar</h2>
        {isLoading ? (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (data?.plans ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Henüz abonelik planı yok. Tüketilebilir ürünleriniz için tekrarlayan teslimat planı
            oluşturun.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {(data?.plans ?? []).map((plan) => {
              const product = products.find((item) => item.id === plan.productId);
              return (
                <li key={plan.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product?.title ?? "Tüm ürünler"} · {intervalLabel(plan.intervalDays)} · %
                        {plan.discountPercent} indirim · en az {plan.minCycles} döngü
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={plan.isActive ? "default" : "secondary"}>
                        {plan.isActive ? "Aktif" : "Kapalı"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(plan.id);
                          setName(plan.name);
                          setProductId(plan.productId ?? "");
                          setIntervalDays(String(plan.intervalDays));
                          setDiscountPercent(String(plan.discountPercent));
                          setMinCycles(String(plan.minCycles));
                          setIsActive(plan.isActive);
                        }}
                      >
                        Düzenle
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Planı sil"
                        onClick={() => remove.mutate(plan.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function SubscribersTab({ storeId, currency }: { storeId: string; currency: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(subscriptionsQuery(storeId));
  const { data: walletData } = useQuery(walletsQuery(storeId));

  const [customerId, setCustomerId] = useState("");
  const [planId, setPlanId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");

  const customers = walletData?.customers ?? [];
  const plans = (data?.plans ?? []).filter((plan) => plan.isActive);

  const enroll = useMutation({
    mutationFn: () =>
      enrollSubscriptionFn({
        data: {
          storeId,
          customerId,
          planId,
          quantity: Math.max(1, Number(quantity) || 1),
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      }),
    onSuccess: async () => {
      toast.success("Müşteri abone edildi");
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["subscription-commerce", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setStatus = useMutation({
    mutationFn: (input: { id: string; status: "active" | "paused" | "canceled" }) =>
      setSubscriptionStatusFn({ data: { storeId, ...input } }),
    onSuccess: async () => {
      toast.success("Abonelik güncellendi");
      await queryClient.invalidateQueries({ queryKey: ["subscription-commerce", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activeCount = (data?.subscriptions ?? []).filter((row) => row.status === "active").length;
  const monthlyValue = useMemo(() => {
    const planById = new Map((data?.plans ?? []).map((plan) => [plan.id, plan]));
    const productById = new Map((data?.products ?? []).map((product) => [product.id, product]));
    return (data?.subscriptions ?? [])
      .filter((row) => row.status === "active")
      .reduce((sum, row) => {
        const plan = planById.get(row.planId);
        if (!plan) return sum;
        const product = plan.productId ? productById.get(plan.productId) : undefined;
        const unit = subscriberPrice(product?.basePrice ?? 0, plan.discountPercent);
        const perMonth = (30 / Math.max(1, plan.intervalDays)) * unit * row.quantity;
        return sum + perMonth;
      }, 0);
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Aktif abone" value={String(activeCount)} />
        <MetricCard label="Aylık tekrarlayan ciro" value={formatMoney(monthlyValue, currency)} />
        <MetricCard label="Toplam abonelik" value={String((data?.subscriptions ?? []).length)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Müşteriyi abone et</h2>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Müşteri</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Müşteri seçin" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Plan seçin" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} · {intervalLabel(plan.intervalDays)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-qty">Adet</Label>
              <Input
                id="sub-qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-note">Not</Label>
              <Textarea id="sub-note" value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
            </div>
            <Button
              className="w-full"
              disabled={!customerId || !planId || enroll.isPending}
              onClick={() => enroll.mutate()}
            >
              Abone et
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Abonelikler</h2>
          {isLoading ? (
            <Skeleton className="mt-4 h-24 w-full" />
          ) : (data?.subscriptions ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Henüz abone kaydı yok.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {(data?.subscriptions ?? []).map((row) => {
                const plan = (data?.plans ?? []).find((item) => item.id === row.planId);
                return (
                  <li key={row.id} className="rounded-xl border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{row.customerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {plan?.name ?? "Plan"} · {row.quantity} adet · sonraki gönderim{" "}
                          {formatDateTime(row.nextOrderAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={row.status === "active" ? "default" : "secondary"}>
                          {CUSTOMER_SUBSCRIPTION_STATUS_LABELS[row.status] ?? row.status}
                        </Badge>
                        {row.status === "active" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus.mutate({ id: row.id, status: "paused" })}
                          >
                            Duraklat
                          </Button>
                        ) : row.status === "paused" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus.mutate({ id: row.id, status: "active" })}
                          >
                            Sürdür
                          </Button>
                        ) : null}
                        {row.status !== "canceled" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setStatus.mutate({ id: row.id, status: "canceled" })}
                          >
                            İptal
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function WalletTab({ storeId, currency }: { storeId: string; currency: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(walletsQuery(storeId));

  const [customerId, setCustomerId] = useState("");
  const [kind, setKind] = useState<"topup" | "spend" | "refund" | "adjustment">("topup");
  const [amount, setAmount] = useState("100");
  const [note, setNote] = useState("");

  const add = useMutation({
    mutationFn: () =>
      addWalletTransactionFn({
        data: {
          storeId,
          customerId,
          kind,
          amount: Number(amount) || 0,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      }),
    onSuccess: async (result) => {
      toast.success(`Cüzdan bakiyesi: ${formatMoney(result.balance, currency)}`);
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["customer-wallets", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totalBalance = (data?.wallets ?? []).reduce((sum, wallet) => sum + wallet.balance, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Toplam cüzdan bakiyesi" value={formatMoney(totalBalance, currency)} />
        <MetricCard label="Cüzdan sayısı" value={String((data?.wallets ?? []).length)} />
        <MetricCard
          label="Hareket sayısı"
          value={String((data?.wallets ?? []).reduce((sum, wallet) => sum + wallet.transactions.length, 0))}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
        <section className="rounded-2xl border bg-card p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Wallet className="size-4 text-brand" />
            Bakiye hareketi ekle
          </h2>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label>Müşteri</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Müşteri seçin" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.customers ?? []).map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hareket türü</Label>
              <Select value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WALLET_KIND_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wallet-amount">Tutar ({currency})</Label>
              <Input
                id="wallet-amount"
                type="number"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wallet-note">Not</Label>
              <Input id="wallet-note" value={note} onChange={(event) => setNote(event.target.value)} />
            </div>
            <Button className="w-full" disabled={!customerId || add.isPending} onClick={() => add.mutate()}>
              Hareketi kaydet
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Cüzdanlar</h2>
          {isLoading ? (
            <Skeleton className="mt-4 h-24 w-full" />
          ) : (data?.wallets ?? []).length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Henüz cüzdan yok. İlk bakiye hareketini eklediğinizde cüzdan otomatik oluşur.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {(data?.wallets ?? []).map((wallet) => (
                <li key={wallet.id} className="rounded-xl border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{wallet.customerName}</p>
                    <Badge variant="secondary">{formatMoney(wallet.balance, wallet.currency)}</Badge>
                  </div>
                  {wallet.transactions.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {wallet.transactions.slice(0, 5).map((tx) => (
                        <li key={tx.id} className="flex justify-between gap-2">
                          <span>
                            {WALLET_KIND_LABELS[tx.kind] ?? tx.kind}
                            {tx.note ? ` · ${tx.note}` : ""}
                          </span>
                          <span>
                            {formatMoney(tx.amount, wallet.currency)} · {formatDateTime(tx.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SplitTab({ storeId }: { storeId: string }) {
  const { data } = useQuery(subscriptionsQuery(storeId));
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("5");
  const [country, setCountry] = useState("TR");

  const simulate = useMutation({
    mutationFn: () =>
      simulateOrderSplitFn({
        data: {
          storeId,
          destinationCountry: country,
          lines: [{ productId, quantity: Math.max(1, Number(quantity) || 1) }],
        },
      }),
    onError: (error: Error) => toast.error(error.message),
  });

  const result = simulate.data;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_1fr]">
      <section className="rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Boxes className="size-4 text-brand" />
          Sipariş bölme simülasyonu
        </h2>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label>Ürün</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Ürün seçin" />
              </SelectTrigger>
              <SelectContent>
                {(data?.products ?? []).map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="split-qty">Adet</Label>
              <Input
                id="split-qty"
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="split-country">Teslim ülkesi</Label>
              <Input
                id="split-country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              />
            </div>
          </div>
          <Button
            className="w-full"
            disabled={!productId || simulate.isPending}
            onClick={() => simulate.mutate()}
          >
            Depoları hesapla
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Sevkiyat planı</h2>
        {!result ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Ürün ve adet seçip hesaplayın; sistem gerçek depo stoklarınıza göre siparişi en az
            parçaya böler.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={result.singleParcel ? "default" : "secondary"}>
                {result.parcelCount} parça
              </Badge>
              <span className="text-sm text-muted-foreground">{result.reason}</span>
            </div>
            <ul className="space-y-2">
              {result.parcels.map((parcel) => (
                <li key={parcel.warehouseId} className="rounded-xl border p-3">
                  <p className="text-sm font-medium">
                    {parcel.warehouseName} · {parcel.countryCode}
                  </p>
                  <ul className="mt-1 text-xs text-muted-foreground">
                    {parcel.lines.map((line) => (
                      <li key={line.sku}>
                        {line.title} — {line.quantity} adet
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            {result.unfulfilled.length > 0 ? (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">Stok yetersiz</p>
                <ul className="mt-1 text-xs text-muted-foreground">
                  {result.unfulfilled.map((line) => (
                    <li key={line.sku}>
                      {line.title} — {line.quantity} adet karşılanamıyor
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
