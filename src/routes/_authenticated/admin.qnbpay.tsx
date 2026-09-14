import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, CreditCard, Loader2, PlugZap, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
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
import { formatMoney } from "@/lib/mefti";
import {
  completeQnbpayPayment,
  confirmQnbpayPreAuth,
  createQnbpayChargeLink,
  deleteChargeItemPricing,
  fetchPlatformPricing,
  fetchQnbpayCommissions,
  fetchQnbpayInstallments,
  fetchQnbpayOverview,
  fetchQnbpayTransactions,
  queryQnbpayStatus,
  refundQnbpayPayment,
  saveAppPricing,
  saveChargeItemPricing,
  savePlanPricing,
  saveQnbpaySettings,
  testQnbpayConnection,
} from "@/lib/qnbpay.functions";

export const Route = createFileRoute("/_authenticated/admin/qnbpay")({
  head: () => ({
    meta: [
      { title: "QNBpay POS — Süper Admin" },
      {
        name: "description",
        content:
          "QNBpay sanal POS bağlantısı, platform fiyatlandırması, ödeme linkleri, taksit ve komisyon bilgileri, tahsilat ve iade yönetimi.",
      },
      { property: "og:title", content: "QNBpay POS — Süper Admin" },
      {
        property: "og:description",
        content: "Platform tahsilatlarının tamamı QNBpay sanal POS üzerinden yönetilir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminQnbpayPage,
});

const PURPOSE_LABELS: Record<string, string> = {
  plan: "Paket",
  theme: "Tema",
  app: "Uygulama",
  commission: "Komisyon",
  invoice: "Fatura",
  other: "Diğer",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Beklemede",
  preauth: "Ön provizyon",
  completed: "Tamamlandı",
  failed: "Başarısız",
  cancelled: "İptal",
  refunded: "İade edildi",
  partial_refunded: "Kısmi iade",
};

function copy(text: string) {
  void navigator.clipboard.writeText(text);
  toast.success("Kopyalandı");
}

function AdminQnbpayPage() {
  return (
    <AdminShell
      title="QNBpay POS"
      description="Paket, tema, uygulama ve komisyon tahsilatlarının tamamı QNBpay sanal POS üzerinden yürütülür."
    >
      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="settings">Bağlantı ayarları</TabsTrigger>
          <TabsTrigger value="pricing">Fiyatlandırma</TabsTrigger>
          <TabsTrigger value="charge">Tahsilat oluştur</TabsTrigger>
          <TabsTrigger value="transactions">İşlemler</TabsTrigger>
        </TabsList>
        <TabsContent value="settings">
          <SettingsTab />
        </TabsContent>
        <TabsContent value="pricing">
          <PricingTab />
        </TabsContent>
        <TabsContent value="charge">
          <ChargeTab />
        </TabsContent>
        <TabsContent value="transactions">
          <TransactionsTab />
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}

/* ------------------------------ Ayarlar ------------------------------ */

function SettingsTab() {
  const queryClient = useQueryClient();
  const load = useServerFn(fetchQnbpayOverview);
  const save = useServerFn(saveQnbpaySettings);
  const test = useServerFn(testQnbpayConnection);
  const installments = useServerFn(fetchQnbpayInstallments);
  const commissions = useServerFn(fetchQnbpayCommissions);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-qnbpay", "overview"],
    queryFn: () => load({ data: undefined }),
  });

  const [form, setForm] = useState<Record<string, string | boolean | number>>({});
  const value = <T,>(key: string, fallback: T): T =>
    (form[key] as T | undefined) ?? fallback;

  const saveMutation = useMutation({
    mutationFn: () => {
      const s = data!.settings;
      return save({
        data: {
          environment: value("environment", s.environment),
          isEnabled: value("isEnabled", s.isEnabled),
          testMerchantKey: value("testMerchantKey", s.testMerchantKey),
          testAppId: value("testAppId", s.testAppId),
          liveMerchantKey: value("liveMerchantKey", s.liveMerchantKey),
          liveAppId: value("liveAppId", s.liveAppId),
          currencyCode: value("currencyCode", s.currencyCode as "TRY"),
          maxInstallments: Number(value("maxInstallments", s.maxInstallments)),
          selectedInstallments: s.selectedInstallments,
          isCommissionFromUser: value("isCommissionFromUser", s.isCommissionFromUser),
          transactionType: value("transactionType", s.transactionType),
          paymentCompletedBy: value("paymentCompletedBy", s.paymentCompletedBy),
          force3d: value("force3d", s.force3d),
          saleWebhookKey: value("saleWebhookKey", s.saleWebhookKey ?? ""),
          refundWebhookKey: value("refundWebhookKey", s.refundWebhookKey ?? ""),
          returnOrigin: value("returnOrigin", s.returnOrigin),
        },
      });
    },
    onSuccess: () => {
      toast.success("Ayarlar kaydedildi");
      void queryClient.invalidateQueries({ queryKey: ["admin-qnbpay"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const testMutation = useMutation({
    mutationFn: () => test({ data: undefined }),
    onSuccess: (result) => (result.ok ? toast.success(result.message) : toast.error(result.message)),
    onError: (error: Error) => toast.error(error.message),
  });

  const [card, setCard] = useState("40227805");
  const [amount, setAmount] = useState("100");
  const installmentMutation = useMutation({
    mutationFn: () =>
      installments({
        data: {
          creditCard: card,
          amount: Number(amount.replace(",", ".")) || 0,
          currency: (data?.settings.currencyCode as "TRY") ?? "TRY",
        },
      }),
    onError: (error: Error) => toast.error(error.message),
  });

  const commissionMutation = useMutation({
    mutationFn: () =>
      commissions({ data: { currency: (data?.settings.currencyCode as "TRY") ?? "TRY" } }),
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;
  const s = data.settings;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Ortam</Label>
          <Select
            value={value("environment", s.environment)}
            onValueChange={(v) => setForm((f) => ({ ...f, environment: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="test">Test</SelectItem>
              <SelectItem value="live">Canlı</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Servis adresi: {data.baseUrl}</p>
        </div>
        <div className="space-y-2">
          <Label>Para birimi</Label>
          <Select
            value={value("currencyCode", s.currencyCode)}
            onValueChange={(v) => setForm((f) => ({ ...f, currencyCode: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TRY">TRY</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-inst">Azami taksit</Label>
          <Input
            id="max-inst"
            inputMode="numeric"
            value={String(value("maxInstallments", s.maxInstallments))}
            onChange={(e) => setForm((f) => ({ ...f, maxInstallments: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="test-merchant">Test üye işyeri anahtarı</Label>
          <Input
            id="test-merchant"
            value={value("testMerchantKey", s.testMerchantKey)}
            onChange={(e) => setForm((f) => ({ ...f, testMerchantKey: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="test-app">Test uygulama kimliği</Label>
          <Input
            id="test-app"
            value={value("testAppId", s.testAppId)}
            onChange={(e) => setForm((f) => ({ ...f, testAppId: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="return-origin">Dönüş adresi kökü</Label>
          <Input
            id="return-origin"
            value={value("returnOrigin", s.returnOrigin)}
            onChange={(e) => setForm((f) => ({ ...f, returnOrigin: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="live-merchant">Canlı üye işyeri anahtarı</Label>
          <Input
            id="live-merchant"
            value={value("liveMerchantKey", s.liveMerchantKey)}
            onChange={(e) => setForm((f) => ({ ...f, liveMerchantKey: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="live-app">Canlı uygulama kimliği</Label>
          <Input
            id="live-app"
            value={value("liveAppId", s.liveAppId)}
            onChange={(e) => setForm((f) => ({ ...f, liveAppId: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label>İşlem tipi</Label>
          <Select
            value={value("transactionType", s.transactionType)}
            onValueChange={(v) => setForm((f) => ({ ...f, transactionType: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Auth">Peşin satış (Auth)</SelectItem>
              <SelectItem value="PreAuth">Ön provizyon (PreAuth)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="sale-hook">Satış webhook anahtarı</Label>
          <Input
            id="sale-hook"
            value={value("saleWebhookKey", s.saleWebhookKey ?? "")}
            onChange={(e) => setForm((f) => ({ ...f, saleWebhookKey: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="refund-hook">İade webhook anahtarı</Label>
          <Input
            id="refund-hook"
            value={value("refundWebhookKey", s.refundWebhookKey ?? "")}
            onChange={(e) => setForm((f) => ({ ...f, refundWebhookKey: e.target.value }))}
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="enabled" className="text-xs">
              QNBpay tahsilatı açık
            </Label>
            <Switch
              id="enabled"
              checked={value("isEnabled", s.isEnabled)}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isEnabled: v }))}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="force3d" className="text-xs">
              3D Secure zorunlu
            </Label>
            <Switch
              id="force3d"
              checked={value("force3d", s.force3d)}
              onCheckedChange={(v) => setForm((f) => ({ ...f, force3d: v }))}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="comm-user" className="text-xs">
              Vade farkını kart hamili ödesin
            </Label>
            <Switch
              id="comm-user"
              checked={value("isCommissionFromUser", s.isCommissionFromUser)}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isCommissionFromUser: v }))}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:col-span-3">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Kaydet
          </Button>
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
          >
            {testMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <PlugZap className="mr-2 size-4" />
            )}
            Bağlantıyı test et
          </Button>
          <Badge variant={data.configured ? "secondary" : "destructive"}>
            {data.configured ? "Bilgiler tam" : "Bilgiler eksik"}
          </Badge>
          {!data.secretConfigured ? (
            <Badge variant="destructive">Canlı gizli anahtar kaydedilmedi</Badge>
          ) : null}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Webhook ve dönüş adresleri</h2>
        <p className="text-xs text-muted-foreground">
          Bu adresleri QNBpay üye işyeri panelinde Ayarlar &gt; Entegrasyon &amp; API bölümüne
          kaydedin.
        </p>
        {[
          { label: "Satış webhook", url: data.saleWebhookUrl },
          { label: "İade webhook", url: data.refundWebhookUrl },
          { label: "Başarılı dönüş", url: data.returnUrl },
          { label: "İptal dönüş", url: data.cancelUrl },
        ].map((row) => (
          <div key={row.label} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-36 text-muted-foreground">{row.label}</span>
            <code className="rounded bg-muted px-2 py-1 text-xs">{row.url}</code>
            <Button size="sm" variant="ghost" onClick={() => copy(row.url)}>
              <Copy className="size-3.5" />
            </Button>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Taksit ve komisyon sorgulama</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="bin">Kart ilk 8 hane</Label>
            <Input id="bin" value={card} onChange={(e) => setCard(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="amt">Tutar</Label>
            <Input
              id="amt"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-32"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => installmentMutation.mutate()}
            disabled={installmentMutation.isPending}
          >
            Taksitleri getir
          </Button>
          <Button
            variant="outline"
            onClick={() => commissionMutation.mutate()}
            disabled={commissionMutation.isPending}
          >
            Komisyonları getir
          </Button>
        </div>
        {installmentMutation.data?.length ? (
          <div className="divide-y rounded-lg border text-sm">
            {installmentMutation.data.map((row) => (
              <div key={`${row.installment}-${row.posName}`} className="flex flex-wrap gap-3 p-2">
                <span className="w-20 font-medium">{row.installment} taksit</span>
                <span className="tabular-nums">
                  {formatMoney(row.amountToBePaid, row.currency ?? "TRY")}
                </span>
                <span className="text-muted-foreground">{row.cardProgram ?? "—"}</span>
                <span className="text-muted-foreground">{row.posName ?? ""}</span>
              </div>
            ))}
          </div>
        ) : null}
        {commissionMutation.data ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Textarea readOnly rows={8} value={commissionMutation.data.commissions} />
            <Textarea readOnly rows={8} value={commissionMutation.data.installments} />
          </div>
        ) : null}
      </section>

      {s.environment === "test" ? (
        <section className="space-y-2 rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Test kartları</h2>
          {data.testCards.map((testCard) => (
            <p key={testCard.number} className="text-sm text-muted-foreground">
              {testCard.number} · CVV {testCard.cvv} · SKT {testCard.expiry} · {testCard.bank}
            </p>
          ))}
        </section>
      ) : null}
    </div>
  );
}

/* --------------------------- Fiyatlandırma --------------------------- */

function PricingTab() {
  const queryClient = useQueryClient();
  const load = useServerFn(fetchPlatformPricing);
  const savePlan = useServerFn(savePlanPricing);
  const saveApp = useServerFn(saveAppPricing);
  const saveItem = useServerFn(saveChargeItemPricing);
  const removeItem = useServerFn(deleteChargeItemPricing);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-qnbpay", "pricing"],
    queryFn: () => load({ data: undefined }),
  });

  const [planDraft, setPlanDraft] = useState<Record<string, Record<string, string>>>({});
  const [appDraft, setAppDraft] = useState<Record<string, string>>({});
  const [item, setItem] = useState({
    kind: "theme" as "theme" | "service" | "commission" | "other",
    code: "",
    name: "",
    price: "0",
    commissionRate: "0",
  });

  const invalidate = () => {
    toast.success("Kaydedildi");
    void queryClient.invalidateQueries({ queryKey: ["admin-qnbpay", "pricing"] });
  };
  const planMutation = useMutation({
    mutationFn: (input: {
      planId: string;
      priceMonthly: number;
      priceYearly: number;
      commissionRate: number;
    }) => savePlan({ data: input }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
  const appMutation = useMutation({
    mutationFn: (input: { appId: string; price: number }) => saveApp({ data: input }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });
  const itemMutation = useMutation({
    mutationFn: () =>
      saveItem({
        data: {
          kind: item.kind,
          code: item.code.trim(),
          name: item.name.trim(),
          price: Number(item.price.replace(",", ".")) || 0,
          currency: "TRY",
          commissionRate: Number(item.commissionRate.replace(",", ".")) || 0,
          isActive: true,
          sortOrder: 0,
        },
      }),
    onSuccess: () => {
      setItem({ kind: "theme", code: "", name: "", price: "0", commissionRate: "0" });
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeItem({ data: { id } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading || !data) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-card">
        <h2 className="border-b p-4 text-sm font-semibold">Paket fiyatları</h2>
        <div className="divide-y">
          {data.plans.map((plan) => {
            const draft = planDraft[plan.id] ?? {};
            return (
              <div key={plan.id} className="flex flex-wrap items-end gap-3 p-4">
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">{plan.code}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Aylık</Label>
                  <Input
                    className="w-28"
                    value={draft["m"] ?? String(plan.priceMonthly)}
                    onChange={(e) =>
                      setPlanDraft((d) => ({ ...d, [plan.id]: { ...draft, m: e.target.value } }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Yıllık</Label>
                  <Input
                    className="w-28"
                    value={draft["y"] ?? String(plan.priceYearly)}
                    onChange={(e) =>
                      setPlanDraft((d) => ({ ...d, [plan.id]: { ...draft, y: e.target.value } }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Komisyon %</Label>
                  <Input
                    className="w-24"
                    value={draft["c"] ?? String(plan.commissionRate)}
                    onChange={(e) =>
                      setPlanDraft((d) => ({ ...d, [plan.id]: { ...draft, c: e.target.value } }))
                    }
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    planMutation.mutate({
                      planId: plan.id,
                      priceMonthly: Number((draft["m"] ?? plan.priceMonthly).toString().replace(",", ".")),
                      priceYearly: Number((draft["y"] ?? plan.priceYearly).toString().replace(",", ".")),
                      commissionRate: Number(
                        (draft["c"] ?? plan.commissionRate).toString().replace(",", "."),
                      ),
                    })
                  }
                >
                  Kaydet
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b p-4 text-sm font-semibold">Uygulama fiyatları</h2>
        <div className="max-h-96 divide-y overflow-y-auto">
          {data.apps.map((app) => (
            <div key={app.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-40 flex-1">
                <p className="text-sm font-medium">{app.name}</p>
                <p className="text-xs text-muted-foreground">
                  {app.code} · {app.pricingModel}
                </p>
              </div>
              <Input
                className="w-28"
                value={appDraft[app.id] ?? String(app.price)}
                onChange={(e) => setAppDraft((d) => ({ ...d, [app.id]: e.target.value }))}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  appMutation.mutate({
                    appId: app.id,
                    price: Number((appDraft[app.id] ?? String(app.price)).replace(",", ".")) || 0,
                  })
                }
              >
                Kaydet
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <h2 className="border-b p-4 text-sm font-semibold">
          Tema, hizmet ve komisyon fiyat kalemleri
        </h2>
        <div className="flex flex-wrap items-end gap-3 border-b p-4">
          <div className="space-y-1">
            <Label className="text-xs">Tür</Label>
            <Select
              value={item.kind}
              onValueChange={(v) => setItem((i) => ({ ...i, kind: v as typeof i.kind }))}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="theme">Tema</SelectItem>
                <SelectItem value="service">Hizmet</SelectItem>
                <SelectItem value="commission">Komisyon</SelectItem>
                <SelectItem value="other">Diğer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kod</Label>
            <Input
              className="w-36"
              value={item.code}
              onChange={(e) => setItem((i) => ({ ...i, code: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ad</Label>
            <Input
              className="w-48"
              value={item.name}
              onChange={(e) => setItem((i) => ({ ...i, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fiyat</Label>
            <Input
              className="w-28"
              value={item.price}
              onChange={(e) => setItem((i) => ({ ...i, price: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Komisyon %</Label>
            <Input
              className="w-24"
              value={item.commissionRate}
              onChange={(e) => setItem((i) => ({ ...i, commissionRate: e.target.value }))}
            />
          </div>
          <Button
            onClick={() => itemMutation.mutate()}
            disabled={itemMutation.isPending || item.code.length < 2 || item.name.length < 2}
          >
            Ekle
          </Button>
        </div>
        <div className="divide-y">
          {data.items.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Henüz kalem yok.</p>
          ) : (
            data.items.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-3 p-3">
                <Badge variant="secondary">{row.kind}</Badge>
                <span className="text-sm font-medium">{row.name}</span>
                <span className="text-xs text-muted-foreground">{row.code}</span>
                <span className="ml-auto text-sm tabular-nums">
                  {formatMoney(row.price, row.currency)}
                </span>
                <span className="text-xs text-muted-foreground">%{row.commissionRate}</span>
                <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(row.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------------------------- Tahsilat ---------------------------- */

function ChargeTab() {
  const queryClient = useQueryClient();
  const create = useServerFn(createQnbpayChargeLink);
  const loadPricing = useServerFn(fetchPlatformPricing);
  const { data: pricing } = useQuery({
    queryKey: ["admin-qnbpay", "pricing"],
    queryFn: () => loadPricing({ data: undefined }),
  });

  const [purpose, setPurpose] = useState<"plan" | "theme" | "app" | "commission" | "other">("plan");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [link, setLink] = useState<string | null>(null);

  const options = useMemo(() => {
    if (!pricing) return [] as Array<{ code: string; label: string; price: number }>;
    if (purpose === "plan")
      return pricing.plans.map((p) => ({
        code: p.code,
        label: `${p.name} (aylık)`,
        price: p.priceMonthly,
      }));
    if (purpose === "app")
      return pricing.apps.map((a) => ({ code: a.code, label: a.name, price: a.price }));
    return pricing.items
      .filter((i) => (purpose === "theme" ? i.kind === "theme" : i.kind !== "theme"))
      .map((i) => ({ code: i.code, label: i.name, price: i.price }));
  }, [pricing, purpose]);

  const mutation = useMutation({
    mutationFn: (selectedCode?: string) =>
      create({
        data: {
          purpose,
          description: description.trim(),
          amount: Number(amount.replace(",", ".")) || 0,
          currency: "TRY",
          buyerName: name.trim(),
          buyerSurname: surname.trim(),
          ...(selectedCode ? { chargeItemCode: selectedCode } : {}),
        },
      }),
    onSuccess: (result) => {
      setLink(result.link);
      toast.success("Ödeme bağlantısı oluşturuldu");
      void queryClient.invalidateQueries({ queryKey: ["admin-qnbpay", "transactions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [selectedCode, setSelectedCode] = useState<string>("");

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-xl border bg-card p-5 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Tahsilat türü</Label>
          <Select value={purpose} onValueChange={(v) => setPurpose(v as typeof purpose)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="plan">Paket</SelectItem>
              <SelectItem value="theme">Tema</SelectItem>
              <SelectItem value="app">Uygulama</SelectItem>
              <SelectItem value="commission">Komisyon</SelectItem>
              <SelectItem value="other">Diğer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Fiyat kalemi</Label>
          <Select
            value={selectedCode}
            onValueChange={(code) => {
              setSelectedCode(code);
              const option = options.find((o) => o.code === code);
              if (option) {
                setAmount(String(option.price));
                setDescription(option.label);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seçin (isteğe bağlı)" />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.label} — {formatMoney(option.price, "TRY")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="charge-amount">Tutar</Label>
          <Input
            id="charge-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
          />
        </div>
        <div className="space-y-2 md:col-span-3">
          <Label htmlFor="charge-desc">Açıklama</Label>
          <Input
            id="charge-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="charge-name">Alıcı adı</Label>
          <Input id="charge-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="charge-surname">Alıcı soyadı</Label>
          <Input id="charge-surname" value={surname} onChange={(e) => setSurname(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button
            onClick={() => mutation.mutate(selectedCode || undefined)}
            disabled={
              mutation.isPending ||
              description.trim().length < 2 ||
              !name.trim() ||
              !surname.trim() ||
              !(Number(amount.replace(",", ".")) > 0)
            }
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 size-4" />
            )}
            Ödeme bağlantısı oluştur
          </Button>
        </div>
      </section>

      {link ? (
        <section className="space-y-2 rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Ödeme bağlantısı</h2>
          <div className="flex flex-wrap items-center gap-2">
            <code className="max-w-full break-all rounded bg-muted px-2 py-1 text-xs">{link}</code>
            <Button size="sm" variant="outline" onClick={() => copy(link)}>
              <Copy className="mr-2 size-3.5" /> Kopyala
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a href={link} target="_blank" rel="noreferrer">
                Aç
              </a>
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/* ---------------------------- İşlemler ---------------------------- */

function TransactionsTab() {
  const queryClient = useQueryClient();
  const load = useServerFn(fetchQnbpayTransactions);
  const queryStatus = useServerFn(queryQnbpayStatus);
  const complete = useServerFn(completeQnbpayPayment);
  const confirm = useServerFn(confirmQnbpayPreAuth);
  const refund = useServerFn(refundQnbpayPayment);

  const [status, setStatus] = useState("all");
  const [purpose, setPurpose] = useState("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-qnbpay", "transactions", status, purpose, search],
    queryFn: () =>
      load({
        data: {
          status: status as "all",
          purpose: purpose as "all",
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      }),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["admin-qnbpay", "transactions"] });

  const statusMutation = useMutation({
    mutationFn: (id: string) => queryStatus({ data: { transactionId: id } }),
    onSuccess: (result) => {
      toast.success(`Durum: ${STATUS_LABELS[result.status] ?? result.status}`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const completeMutation = useMutation({
    mutationFn: (input: { transactionId: string; action: "complete" | "cancel" }) =>
      complete({ data: input }),
    onSuccess: () => {
      toast.success("İşlem güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const confirmMutation = useMutation({
    mutationFn: (input: { transactionId: string; action: "approve" | "cancel" }) =>
      confirm({ data: input }),
    onSuccess: () => {
      toast.success("Ön provizyon güncellendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const refundMutation = useMutation({
    mutationFn: (input: { transactionId: string; amount: number }) => refund({ data: input }),
    onSuccess: () => {
      toast.success("İade talebi işlendi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={purpose} onValueChange={setPurpose}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm türler</SelectItem>
            {Object.entries(PURPOSE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Fatura no, sipariş no, mağaza…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button variant="outline" size="sm" onClick={invalidate}>
          <RefreshCw className="mr-2 size-3.5" /> Yenile
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data?.length ? (
        <p className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Kayıt bulunamadı.
        </p>
      ) : (
        <div className="divide-y rounded-xl border bg-card">
          {data.map((row) => (
            <div key={row.id} className="space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{PURPOSE_LABELS[row.purpose] ?? row.purpose}</Badge>
                <span className="text-sm font-medium">{row.invoiceRef}</span>
                <Badge variant={row.status === "completed" ? "default" : "outline"}>
                  {STATUS_LABELS[row.status] ?? row.status}
                </Badge>
                {row.environment === "test" ? <Badge variant="outline">Test</Badge> : null}
                <span className="ml-auto text-sm tabular-nums">
                  {formatMoney(row.amount, row.currency)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {row.description ?? "—"}
                {row.storeName ? ` · ${row.storeName}` : ""}
                {row.orderId ? ` · Sipariş ${row.orderId}` : ""}
                {row.creditCardNo ? ` · ${row.creditCardNo}` : ""}
                {row.refundedAmount > 0
                  ? ` · İade ${formatMoney(row.refundedAmount, row.currency)}`
                  : ""}
              </p>
              {row.statusDescription || row.errorMessage ? (
                <p className="text-xs text-muted-foreground">
                  {row.statusDescription ?? ""} {row.errorMessage ?? ""}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => statusMutation.mutate(row.id)}
                  disabled={statusMutation.isPending}
                >
                  Durum sorgula
                </Button>
                {row.checkoutUrl ? (
                  <Button size="sm" variant="ghost" onClick={() => copy(row.checkoutUrl!)}>
                    Bağlantıyı kopyala
                  </Button>
                ) : null}
                {row.transactionType === "PreAuth" && row.status !== "completed" ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        confirmMutation.mutate({ transactionId: row.id, action: "approve" })
                      }
                    >
                      Provizyonu onayla
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        confirmMutation.mutate({ transactionId: row.id, action: "cancel" })
                      }
                    >
                      Provizyonu iptal et
                    </Button>
                  </>
                ) : null}
                {row.status === "pending" && row.orderId ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        completeMutation.mutate({ transactionId: row.id, action: "complete" })
                      }
                    >
                      Ödemeyi tamamla
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        completeMutation.mutate({ transactionId: row.id, action: "cancel" })
                      }
                    >
                      İptal et
                    </Button>
                  </>
                ) : null}
                {row.status === "completed" && row.refundedAmount < row.amount ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => refundMutation.mutate({ transactionId: row.id, amount: 0 })}
                    disabled={refundMutation.isPending}
                  >
                    Tamamını iade et
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
