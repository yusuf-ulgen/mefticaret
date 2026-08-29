import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, CreditCard, Gauge, History, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { changeStorePlan } from "@/lib/billing.functions";
import { readFeatures, readLimits, storeUsageQuery, usageRatio } from "@/lib/billing-queries";
import { formatDateTime, formatMoney, formatNumber, planLimitLabel } from "@/lib/mefti";
import { plansQuery, storeAuditQuery, storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/billing")({
  head: () => ({
    meta: [
      { title: "Abonelik & Limitler — Mefticaret" },
      {
        name: "description",
        content: "Mağaza paketini yükselt, plan limitlerinin kullanımını izle ve abonelik hareketlerini denetle.",
      },
      { property: "og:title", content: "Abonelik & Limitler — Mefticaret" },
      { property: "og:description", content: "Paket kullanımını ve abonelik geçmişini tek ekranda yönet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: plans, isPending: plansPending } = useQuery(plansQuery());
  const { data: usage } = useQuery(storeUsageQuery(storeId));
  const { data: audit } = useQuery(storeAuditQuery(storeId));

  const changePlanFn = useServerFn(changeStorePlan);
  const changeMutation = useMutation({
    mutationFn: (planId: string) => changePlanFn({ data: { storeId, planId } }),
    onSuccess: (result) => {
      toast.success(`Paket güncellendi: ${result.planName}`);
      void queryClient.invalidateQueries({ queryKey: ["store", storeId] });
      void queryClient.invalidateQueries({ queryKey: ["my-stores"] });
      void queryClient.invalidateQueries({ queryKey: ["store-audit", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const currentPlan = plans?.find((plan) => plan.id === store?.plan_id) ?? null;
  const limits = readLimits(currentPlan?.limits);

  const meters = [
    { label: "Ürün", used: usage?.products ?? 0, limit: limits.products },
    { label: "Personel", used: usage?.staff ?? 0, limit: limits.staff },
    { label: "Domain", used: usage?.domains ?? 0, limit: limits.domains },
    { label: "Sipariş", used: usage?.orders ?? 0, limit: limits.orders_monthly },
  ];

  return (
    <AppShell storeId={storeId}>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <CreditCard className="size-7 text-primary" />
            Abonelik & Limitler
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {store?.name ?? "Mağaza"} için aktif paketi, limit kullanımını ve abonelik hareketlerini yönet.
            Paket değişikliği anında geçerli olur ve denetim kaydına işlenir.
          </p>
        </header>

        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aktif paket</p>
              <p className="text-2xl font-semibold">{currentPlan?.name ?? "Paket atanmadı"}</p>
              {currentPlan ? (
                <p className="text-sm text-muted-foreground">
                  {formatMoney(Number(currentPlan.price_monthly ?? 0), currentPlan.currency ?? "TRY")} / ay ·
                  Komisyon {Number(currentPlan.commission_rate ?? 0) * 100}%
                </p>
              ) : null}
            </div>
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="size-3.5" />
              {currentPlan?.trial_days ? `${currentPlan.trial_days} gün deneme` : "Deneme yok"}
            </Badge>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {meters.map((meter) => {
              const ratio = usageRatio(meter.used, meter.limit);
              return (
                <div key={meter.label} className="space-y-2 rounded-lg border bg-background p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Gauge className="size-3.5 text-muted-foreground" />
                      {meter.label}
                    </span>
                    <span className="text-muted-foreground">
                      {formatNumber(meter.used)} / {planLimitLabel(meter.limit)}
                    </span>
                  </div>
                  <Progress value={ratio ?? 8} />
                  <p className="text-xs text-muted-foreground">
                    {ratio === null
                      ? "Sınırsız kullanım"
                      : ratio >= 90
                        ? "Limit doluyor, yükseltmeyi düşün"
                        : `%${ratio} kullanıldı`}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Paketler</h2>
          {plansPending ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((key) => (
                <Skeleton key={key} className="h-56 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(plans ?? [])
                .filter((plan) => plan.is_active)
                .map((plan) => {
                  const active = plan.id === store?.plan_id;
                  const planLimits = readLimits(plan.limits);
                  const features = readFeatures(plan.features).slice(0, 4);
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
                          {formatMoney(Number(plan.price_monthly ?? 0), plan.currency ?? "TRY")}
                          <span className="text-sm font-normal text-muted-foreground"> / ay</span>
                        </p>
                        {plan.description ? (
                          <p className="text-sm text-muted-foreground">{plan.description}</p>
                        ) : null}
                      </div>

                      <ul className="space-y-1.5 text-sm text-muted-foreground">
                        <li>Ürün limiti: {planLimitLabel(planLimits.products)}</li>
                        <li>Personel: {planLimitLabel(planLimits.staff)}</li>
                        <li>Komisyon: {Number(plan.commission_rate ?? 0) * 100}%</li>
                        {features.map((feature) => (
                          <li key={feature} className="flex items-center gap-1.5">
                            <Check className="size-3.5 text-primary" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      <Button
                        className="mt-auto"
                        variant={active ? "secondary" : "default"}
                        disabled={active || changeMutation.isPending}
                        onClick={() => changeMutation.mutate(plan.id)}
                      >
                        {active ? "Mevcut paket" : "Bu pakete geç"}
                      </Button>
                    </article>
                  );
                })}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <History className="size-4 text-muted-foreground" />
            Son abonelik & mağaza hareketleri
          </h2>
          <div className="divide-y rounded-xl border bg-card">
            {(audit ?? []).length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">Henüz kayıt yok.</p>
            ) : (
              (audit ?? []).map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <span className="font-medium">{entry.action}</span>
                  <span className="text-muted-foreground">{formatDateTime(entry.created_at)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
