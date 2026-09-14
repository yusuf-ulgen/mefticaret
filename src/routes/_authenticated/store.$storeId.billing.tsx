import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, Check, FileText, Gauge, History, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { isPaidPlanSlug } from "@/lib/paddle-plans";
import { startPlanCardPayment } from "@/lib/plan-checkout.functions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { readFeatures } from "@/lib/billing-queries";
import { MODULE_CATALOG, isModuleKey } from "@/lib/plan-features";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/mefti";
import { plansQuery, storeAuditQuery, storeQuery } from "@/lib/store-queries";
import {
  BILLING_INTERVAL_LABELS,
  BILLING_REMINDER_LABELS,
  INVOICE_STATUS_LABELS,
  SUBSCRIPTION_STATUS_LABELS,
  limitLabel,
  limitRatio,
  trialDaysLeft,
} from "@/lib/subscription";
import {
  billingCyclesQuery,
  billingRemindersQuery,
  invoicesQuery,
  metricUsageQuery,
  planFeaturesQuery,
  storeSubscriptionQuery,
  subscriptionItemsQuery,
} from "@/lib/subscription-queries";

import {
  issueInvoiceForCycle,
  markInvoicePaid,
  setSubscriptionCancellation,
  upsertSubscription,
} from "@/lib/subscription.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/billing")({
  head: () => ({
    meta: [
      { title: "Abonelik & Limitler — Mefticaret" },
      {
        name: "description",
        content:
          "Paketini yükselt, aylık/yıllık aboneliğini yönet, limit kullanımını izle ve faturalarını görüntüle.",
      },
      { property: "og:title", content: "Abonelik & Limitler — Mefticaret" },
      { property: "og:description", content: "Abonelik, limit kullanımı ve faturalar tek ekranda." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: plans, isPending: plansPending } = useQuery(plansQuery());
  const { data: planFeatures } = useQuery(planFeaturesQuery());
  const { data: subscription } = useQuery(storeSubscriptionQuery(storeId));
  const { data: items } = useQuery(subscriptionItemsQuery(storeId));
  const { data: usage } = useQuery(metricUsageQuery(storeId));
  const { data: cycles } = useQuery(billingCyclesQuery(storeId));
  const { data: invoices } = useQuery(invoicesQuery(storeId));
  const { data: audit } = useQuery(storeAuditQuery(storeId));
  const { data: reminders } = useQuery(billingRemindersQuery(storeId));


  const subscribeFn = useServerFn(upsertSubscription);
  const cancelFn = useServerFn(setSubscriptionCancellation);
  const invoiceFn = useServerFn(issueInvoiceForCycle);
  const payFn = useServerFn(markInvoicePaid);

  const refresh = () => {
    for (const key of [
      ["store", storeId],
      ["store-subscription", storeId],
      ["subscription-items", storeId],
      ["billing-cycles", storeId],
      ["invoices", storeId],
      ["store-audit", storeId],
      ["billing-reminders", storeId],

      ["my-stores"],
    ]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const subscribeMutation = useMutation({
    mutationFn: (planId: string) =>
      subscribeFn({ data: { storeId, planId, billingInterval: interval, startTrial: true } }),
    onSuccess: (result) => {
      toast.success(`Abonelik güncellendi: ${result.planName}`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // Ücretli paketler QNBpay tahsilat sayfasından geçer; fiyat sunucuda belirlenir.
  const startPlanPaymentFn = useServerFn(startPlanCardPayment);
  const checkoutMutation = useMutation({
    mutationFn: (planId: string) =>
      startPlanPaymentFn({ data: { storeId, planId, billingInterval: interval } }),
    onSuccess: (result) => {
      toast.success(`${result.planName} için ödeme sayfası açılıyor`);
      window.location.href = result.link;
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const cancelMutation = useMutation({
    mutationFn: (cancel: boolean) => cancelFn({ data: { storeId, cancel } }),
    onSuccess: (result) => {
      toast.success(
        result.cancelAtPeriodEnd
          ? "Abonelik dönem sonunda sona erecek"
          : "Abonelik yeniden başlatıldı",
      );
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const invoiceMutation = useMutation({
    mutationFn: (cycleId: string) => invoiceFn({ data: { storeId, cycleId } }),
    onSuccess: (result) => {
      toast.success(`Fatura oluşturuldu: ${result.invoiceNumber}`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const payMutation = useMutation({
    mutationFn: (invoiceId: string) => payFn({ data: { storeId, invoiceId } }),
    onSuccess: () => {
      toast.success("Fatura ödendi olarak işaretlendi");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const activePlanId = subscription?.plan_id ?? store?.plan_id ?? null;
  const currentPlan = plans?.find((plan) => plan.id === activePlanId) ?? null;
  const currentFeatures = (planFeatures ?? [])
    .filter(
      (feature) =>
        feature.plan_id === activePlanId && feature.is_enabled && !isModuleKey(feature.metric_key),
    )
    .sort((a, b) => a.sort_order - b.sort_order);
  /** Paketle açılan/kapanan modüller (kotalardan ayrı gösterilir). */
  const currentModules = MODULE_CATALOG.map((module) => {
    const row = (planFeatures ?? []).find(
      (feature) => feature.plan_id === activePlanId && feature.metric_key === module.key,
    );
    return { ...module, enabled: Boolean(row?.is_enabled) };
  });
  const trialLeft = trialDaysLeft(subscription?.trial_ends_at);

  const openInvoice = (invoices ?? []).find((invoice) => invoice.status !== "paid") ?? null;
  const openPayUrl = openInvoice?.pay_token
    ? `${typeof window === "undefined" ? "https://mefticaret.com" : window.location.origin}/fatura/${openInvoice.pay_token}`
    : null;
  const frozen = store?.status === "suspended";
  const dunningState =
    frozen || subscription?.status === "past_due"
      ? {
          frozen,
          title: frozen ? "Mağazanız donduruldu" : "Ödeme gecikti — mağazanız risk altında",
          message: frozen
            ? "Ödenmeyen abonelik faturası nedeniyle mağaza satışa kapatıldı. Ödeme tamamlandığında mağaza otomatik olarak yeniden açılır."
            : "Vadesi geçen faturanız var. 3 gün içinde ödeme yapılmazsa mağazanız geçici olarak dondurulur.",
          payUrl: openPayUrl,
        }
      : null;


  return (
    <AppShell
      storeId={storeId}
      title="Abonelik & Limitler"
      description="Paket, aylık/yıllık abonelik, limit kullanımı ve faturalar."
    >
      <div className="space-y-8">
        {dunningState ? (
          <section
            className={`flex flex-wrap items-start justify-between gap-4 rounded-xl border p-5 ${
              dunningState.frozen
                ? "border-destructive/50 bg-destructive/5"
                : "border-amber-500/50 bg-amber-500/5"
            }`}
          >
            <div className="flex gap-3">
              <AlertTriangle
                className={`mt-0.5 size-5 ${dunningState.frozen ? "text-destructive" : "text-amber-600"}`}
              />
              <div className="space-y-1">
                <p className="font-medium">{dunningState.title}</p>
                <p className="text-sm text-muted-foreground">{dunningState.message}</p>
              </div>
            </div>
            {dunningState.payUrl ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(dunningState.payUrl!);
                  toast.success("Ödeme linki kopyalandı");
                }}
              >
                Ödeme linkini kopyala
              </Button>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Aktif abonelik
              </p>
              <p className="text-2xl font-semibold">{currentPlan?.name ?? "Paket atanmadı"}</p>
              <p className="text-sm text-muted-foreground">
                {subscription
                  ? `${SUBSCRIPTION_STATUS_LABELS[subscription.status] ?? subscription.status} · ${
                      BILLING_INTERVAL_LABELS[subscription.billing_interval]
                    } · ${formatMoney(Number(subscription.amount ?? 0), subscription.currency)} · dönem sonu ${formatDateTime(
                      subscription.current_period_end,
                    )}`
                  : "Henüz abonelik oluşturulmadı."}
              </p>
              {subscription?.cancel_at_period_end ? (
                <p className="text-sm text-destructive">
                  Abonelik {formatDateTime(subscription.current_period_end)} tarihinde sona erecek.
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="size-3.5" />
                {trialLeft !== null && trialLeft > 0
                  ? `${trialLeft} gün deneme kaldı`
                  : currentPlan?.trial_days
                    ? `${currentPlan.trial_days} gün deneme`
                    : "Deneme yok"}
              </Badge>
              {subscription ? (
                <Button
                  size="sm"
                  variant={subscription.cancel_at_period_end ? "default" : "outline"}
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(!subscription.cancel_at_period_end)}
                >
                  {subscription.cancel_at_period_end ? "İptali geri al" : "Dönem sonunda iptal et"}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {currentFeatures.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Bu paket için limit tanımı bulunamadı.
              </p>
            ) : (
              currentFeatures.map((feature) => {
                const used = usage?.[feature.metric_key] ?? 0;
                const ratio = limitRatio(used, feature.limit_value);
                return (
                  <div
                    key={feature.id}
                    className="space-y-2 rounded-lg border bg-background p-4"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 font-medium">
                        <Gauge className="size-3.5 text-muted-foreground" />
                        {feature.label}
                      </span>
                      <span className="text-muted-foreground">
                        {formatNumber(used)} / {limitLabel(feature.limit_value)}
                      </span>
                    </div>
                    <Progress value={ratio ?? 8} />
                    <p className="text-xs text-muted-foreground">
                      {ratio === null
                        ? `Sınırsız${feature.unit ? ` (${feature.unit})` : ""}`
                        : ratio >= 90
                          ? "Limit doluyor, yükseltmeyi düşün"
                          : `%${ratio} kullanıldı${feature.unit ? ` · ${feature.unit}` : ""}`}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-8 space-y-3">
            <h3 className="text-sm font-semibold">Paketinizle açılan özellikler</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {currentModules.map((module) => (
                <div
                  key={module.key}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                    module.enabled ? "bg-background" : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {module.enabled ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  ) : (
                    <Lock className="mt-0.5 size-4 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{module.label}</p>
                    <p className="text-xs text-muted-foreground">{module.description}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Kapalı özellikler menüde görünmez ve işlem yapılamaz. Üst pakete geçerek açabilirsiniz.
            </p>
          </div>
        </section>

        <Tabs defaultValue="plans" className="space-y-4">
          <TabsList>
            <TabsTrigger value="plans">Paketler</TabsTrigger>
            <TabsTrigger value="invoices">Faturalar</TabsTrigger>
            <TabsTrigger value="cycles">Faturalama dönemleri</TabsTrigger>
            <TabsTrigger value="activity">Hareketler</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Ödeme dönemi:</span>
              {(["monthly", "yearly"] as const).map((option) => (
                <Button
                  key={option}
                  size="sm"
                  variant={interval === option ? "default" : "outline"}
                  onClick={() => setInterval(option)}
                >
                  {BILLING_INTERVAL_LABELS[option]}
                </Button>
              ))}
            </div>

            {plansPending ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((key) => (
                  <Skeleton key={key} className="h-56 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(plans ?? [])
                  .filter((plan) => plan.is_active)
                  .map((plan) => {
                    const active = plan.id === activePlanId;
                    const planRows = (planFeatures ?? []).filter(
                      (feature) => feature.plan_id === plan.id && feature.is_enabled,
                    );
                    const planLimits = planRows
                      .filter((feature) => !isModuleKey(feature.metric_key))
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .slice(0, 6);
                    const planModules = planRows
                      .filter((feature) => isModuleKey(feature.metric_key))
                      .sort((a, b) => a.sort_order - b.sort_order);
                    const extras = readFeatures(plan.features).slice(0, 2);
                    const price =
                      interval === "yearly"
                        ? Number(plan.price_yearly ?? 0)
                        : Number(plan.price_monthly ?? 0);
                    return (
                      <article
                        key={plan.id}
                        className={`flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm ${
                          active ? "border-primary ring-1 ring-primary/40" : ""
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{plan.name}</h3>
                            {active ? <Badge>Aktif</Badge> : null}
                          </div>
                          <p className="text-2xl font-semibold">
                            {formatMoney(price, plan.currency ?? "TRY")}
                            <span className="text-sm font-normal text-muted-foreground">
                              {interval === "yearly" ? " / yıl" : " / ay"}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Komisyon {Number(plan.commission_rate ?? 0) * 100}% ·{" "}
                            {plan.trial_days} gün deneme
                          </p>
                          {plan.description ? (
                            <p className="text-sm text-muted-foreground">{plan.description}</p>
                          ) : null}
                        </div>

                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {planLimits.map((feature) => (
                            <li key={feature.id}>
                              {feature.label}: {limitLabel(feature.limit_value)}
                              {feature.unit ? ` ${feature.unit}` : ""}
                            </li>
                          ))}
                          {planModules.map((feature) => (
                            <li key={feature.id} className="flex items-center gap-1.5">
                              <Check className="size-3.5 shrink-0 text-primary" />
                              {feature.label}
                            </li>
                          ))}
                          {extras.map((extra) => (
                            <li key={extra} className="flex items-center gap-1.5">
                              <Check className="size-3.5 text-primary" />
                              {extra}
                            </li>
                          ))}
                        </ul>

                        <Button
                          className="mt-auto"
                          variant={
                            active && subscription?.billing_interval === interval
                              ? "secondary"
                              : "default"
                          }
                          disabled={
                            (active && subscription?.billing_interval === interval) ||
                            subscribeMutation.isPending ||
                            checkoutMutation.isPending
                          }
                          onClick={() =>
                            isPaidPlanSlug(plan.code)
                              ? checkoutMutation.mutate(plan.id)
                              : subscribeMutation.mutate(plan.id)
                          }
                        >
                          {active && subscription?.billing_interval === interval
                            ? "Mevcut abonelik"
                            : active
                              ? `${BILLING_INTERVAL_LABELS[interval]} ödemeye geç`
                              : "Bu pakete geç"}
                        </Button>
                      </article>
                    );
                  })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="invoices" className="space-y-3">
            <div className="divide-y rounded-xl border bg-card">
              {(invoices ?? []).length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">Henüz fatura yok.</p>
              ) : (
                (invoices ?? []).map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{invoice.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(invoice.issued_at)} ·{" "}
                          {INVOICE_STATUS_LABELS[invoice.status] ?? invoice.status}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">
                        {formatMoney(Number(invoice.total ?? 0), invoice.currency)}
                      </span>
                      {invoice.status !== "paid" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={payMutation.isPending}
                          onClick={() => payMutation.mutate(invoice.id)}
                        >
                          Ödendi işaretle
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
            {(items ?? []).length ? (
              <div className="rounded-xl border bg-card p-4 text-sm">
                <p className="font-medium">Abonelik kalemleri</p>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {(items ?? []).map((item) => (
                    <li key={item.id}>
                      {item.description} — {formatNumber(Number(item.quantity ?? 1))} ×{" "}
                      {formatMoney(Number(item.unit_price ?? 0), item.currency)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="mt-4 rounded-xl border bg-card p-4 text-sm">
              <p className="font-medium">Yenileme & tahsilat otomasyonu</p>
              {(reminders ?? []).length === 0 ? (
                <p className="mt-2 text-muted-foreground">
                  Henüz hatırlatma gönderilmedi. Dönem bitimine 7, 3 ve 1 gün kala fatura ve ödeme
                  linki otomatik olarak gönderilir.
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {(reminders ?? []).map((reminder) => (
                    <li key={reminder.id}>
                      {formatDateTime(reminder.sent_at)} ·{" "}
                      {BILLING_REMINDER_LABELS[reminder.kind] ?? reminder.kind} · {reminder.channel}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>


          <TabsContent value="cycles">
            <div className="divide-y rounded-xl border bg-card">
              {(cycles ?? []).length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">Faturalama dönemi yok.</p>
              ) : (
                (cycles ?? []).map((cycle) => (
                  <div
                    key={cycle.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {formatDateTime(cycle.period_start)} — {formatDateTime(cycle.period_end)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {cycle.status === "invoiced"
                          ? "Faturalandı"
                          : cycle.status === "closed"
                            ? "Kapandı"
                            : "Açık"}{" "}
                        · {formatMoney(Number(cycle.amount_due ?? 0), cycle.currency)}
                      </p>
                    </div>
                    {cycle.status !== "invoiced" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={invoiceMutation.isPending}
                        onClick={() => invoiceMutation.mutate(cycle.id)}
                      >
                        Fatura oluştur
                      </Button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <div className="divide-y rounded-xl border bg-card">
              {(audit ?? []).length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">Henüz kayıt yok.</p>
              ) : (
                (audit ?? []).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <History className="size-3.5 text-muted-foreground" />
                      {entry.action}
                    </span>
                    <span className="text-muted-foreground">{formatDateTime(entry.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
