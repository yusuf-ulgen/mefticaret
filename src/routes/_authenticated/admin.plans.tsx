import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/mefti";
import { adminPlansQuery, type PlanRow } from "@/lib/admin-queries";
import { savePlatformPlan } from "@/lib/admin.functions";
import { savePlanFeatures } from "@/lib/subscription.functions";
import { planFeaturesQuery, type PlanFeatureRow } from "@/lib/subscription-queries";
import { METRIC_CATALOG, limitLabel } from "@/lib/subscription";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  head: () => ({
    meta: [
      { title: "Paketler — Süper Admin" },
      { name: "description", content: "SaaS paketlerini, komisyon oranlarını ve kiracı limitlerini yönet." },
      { property: "og:title", content: "Paketler — Süper Admin" },
      { property: "og:description", content: "Paket limitleri veritabanından yönetilir, kodda sabit değildir." },
    ],
  }),
  component: AdminPlans,
});

type PlanDraft = {
  id?: string | undefined;
  code: string;
  name: string;
  description: string;
  priceMonthly: string;
  priceYearly: string;
  commissionRate: string;
  trialDays: string;
  sortOrder: string;
  isActive: boolean;
};

type FeatureDraft = {
  metricKey: string;
  label: string;
  unit: string;
  limitValue: string;
  isEnabled: boolean;
  sortOrder: number;
};

function toDraft(plan?: PlanRow): PlanDraft {
  return {
    id: plan?.id,
    code: plan?.code ?? "",
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    priceMonthly: String(plan?.price_monthly ?? 0),
    priceYearly: String(plan?.price_yearly ?? 0),
    commissionRate: String(((plan?.commission_rate ?? 0.02) * 100).toFixed(2)),
    trialDays: String(plan?.trial_days ?? 0),
    sortOrder: String(plan?.sort_order ?? 0),
    isActive: plan?.is_active ?? true,
  };
}

/** Paket limitleri veritabanından okunur; eksik metrikler katalogdan boş (sınırsız) eklenir. */
function toFeatureDrafts(rows: PlanFeatureRow[]): FeatureDraft[] {
  const byKey = new Map(rows.map((row) => [row.metric_key, row]));
  const drafts: FeatureDraft[] = METRIC_CATALOG.map((metric, index) => {
    const row = byKey.get(metric.key);
    byKey.delete(metric.key);
    return {
      metricKey: metric.key,
      label: row?.label ?? metric.label,
      unit: row?.unit ?? metric.unit,
      limitValue: row?.limit_value === null || row?.limit_value === undefined ? "" : String(row.limit_value),
      isEnabled: row?.is_enabled ?? true,
      sortOrder: row?.sort_order ?? index + 1,
    };
  });
  let extra = drafts.length;
  for (const row of byKey.values()) {
    extra += 1;
    drafts.push({
      metricKey: row.metric_key,
      label: row.label,
      unit: row.unit ?? "",
      limitValue: row.limit_value === null ? "" : String(row.limit_value),
      isEnabled: row.is_enabled,
      sortOrder: row.sort_order || extra,
    });
  }
  return drafts;
}

function AdminPlans() {
  const { isPlatformAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: plans } = useQuery(adminPlansQuery(isPlatformAdmin));
  const { data: allFeatures } = useQuery(planFeaturesQuery());

  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [features, setFeatures] = useState<FeatureDraft[]>([]);

  const savePlan = useServerFn(savePlatformPlan);
  const saveFeatures = useServerFn(savePlanFeatures);

  const featuresByPlan = (planId: string) => (allFeatures ?? []).filter((row) => row.plan_id === planId);

  const openPlan = (plan?: PlanRow) => {
    setDraft(toDraft(plan));
    setFeatures(toFeatureDrafts(plan ? featuresByPlan(plan.id) : []));
  };

  const planMutation = useMutation({
    mutationFn: async (input: PlanDraft) => {
      const limits = Object.fromEntries(
        features
          .filter((feature) => feature.isEnabled)
          .map((feature) => [
            feature.metricKey,
            feature.limitValue.trim() === "" ? -1 : Number(feature.limitValue),
          ]),
      ) as Record<string, number>;

      await savePlan({
        data: {
          id: input.id,
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description.trim() || null,
          priceMonthly: Number(input.priceMonthly) || 0,
          priceYearly: Number(input.priceYearly) || 0,
          commissionRate: (Number(input.commissionRate) || 0) / 100,
          trialDays: Number(input.trialDays) || 0,
          sortOrder: Number(input.sortOrder) || 0,
          isActive: input.isActive,
          limits,
        },
      });

      if (input.id) {
        await saveFeatures({
          data: {
            planId: input.id,
            features: features.map((feature, index) => ({
              metricKey: feature.metricKey,
              label: feature.label.trim() || feature.metricKey,
              unit: feature.unit.trim() || null,
              limitValue: feature.limitValue.trim() === "" ? null : Number(feature.limitValue),
              isEnabled: feature.isEnabled,
              sortOrder: feature.sortOrder || index + 1,
            })),
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Paket ve limitler kaydedildi");
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["plan-features"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AdminShell
      title="Paketler"
      description="Paket fiyatları, komisyon oranı ve kiracı limitleri buradan yönetilir."
      actions={
        <Button size="sm" onClick={() => openPlan()}>
          <Plus className="size-4" /> Yeni paket
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(plans ?? []).map((plan) => (
          <button
            key={plan.id}
            type="button"
            onClick={() => openPlan(plan)}
            className="surface-card p-5 text-left transition hover:border-primary/50"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-lg font-semibold">{plan.name}</p>
              <Badge variant={plan.is_active ? "default" : "secondary"}>
                {plan.is_active ? "Aktif" : "Pasif"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{plan.code}</p>
            <p className="mt-3 text-sm">
              {formatMoney(Number(plan.price_monthly), plan.currency)} / ay ·{" "}
              {formatMoney(Number(plan.price_yearly), plan.currency)} / yıl ·{" "}
              {(Number(plan.commission_rate) * 100).toFixed(2)}% komisyon
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {featuresByPlan(plan.id).length} limit tanımı · {plan.trial_days} gün deneme
            </p>
            <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              {featuresByPlan(plan.id)
                .slice(0, 4)
                .map((feature) => (
                  <li key={feature.id}>
                    {feature.label}: {limitLabel(feature.limit_value)}
                    {feature.unit ? ` ${feature.unit}` : ""}
                  </li>
                ))}
            </ul>
          </button>
        ))}
      </div>

      <Sheet open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{draft?.id ? "Paketi düzenle" : "Yeni paket"}</SheetTitle>
          </SheetHeader>
          {draft ? (
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                planMutation.mutate(draft);
              }}
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plan-code">Kod</Label>
                  <Input
                    id="plan-code"
                    value={draft.code}
                    onChange={(event) => setDraft({ ...draft, code: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-name">Ad</Label>
                  <Input
                    id="plan-name"
                    value={draft.name}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="plan-desc">Açıklama</Label>
                <Textarea
                  id="plan-desc"
                  rows={2}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="plan-monthly">Aylık fiyat</Label>
                  <Input
                    id="plan-monthly"
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.priceMonthly}
                    onChange={(event) => setDraft({ ...draft, priceMonthly: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-yearly">Yıllık fiyat</Label>
                  <Input
                    id="plan-yearly"
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft.priceYearly}
                    onChange={(event) => setDraft({ ...draft, priceYearly: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-commission">Komisyon (%)</Label>
                  <Input
                    id="plan-commission"
                    type="number"
                    min={0}
                    max={50}
                    step="0.01"
                    value={draft.commissionRate}
                    onChange={(event) => setDraft({ ...draft, commissionRate: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-trial">Deneme (gün)</Label>
                  <Input
                    id="plan-trial"
                    type="number"
                    min={0}
                    value={draft.trialDays}
                    onChange={(event) => setDraft({ ...draft, trialDays: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="plan-sort">Sıra</Label>
                  <Input
                    id="plan-sort"
                    type="number"
                    min={0}
                    value={draft.sortOrder}
                    onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })}
                  />
                </div>
                <div className="flex items-end gap-3">
                  <Switch
                    id="plan-active"
                    checked={draft.isActive}
                    onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })}
                  />
                  <Label htmlFor="plan-active">Satışta</Label>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <Label>Paket limitleri</Label>
                  <p className="text-xs text-muted-foreground">
                    Limitler veritabanında tutulur. Boş bırakılan alan sınırsız kabul edilir.
                  </p>
                </div>
                {draft.id ? (
                  <div className="space-y-2">
                    {features.map((feature, index) => (
                      <div
                        key={feature.metricKey}
                        className="grid grid-cols-[1fr_110px_70px_auto] items-center gap-2 rounded-lg border border-border p-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{feature.label}</p>
                          <p className="truncate text-xs text-muted-foreground">{feature.metricKey}</p>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Sınırsız"
                          value={feature.limitValue}
                          aria-label={`${feature.label} limiti`}
                          onChange={(event) =>
                            setFeatures(
                              features.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, limitValue: event.target.value } : row,
                              ),
                            )
                          }
                        />
                        <Input
                          value={feature.unit}
                          aria-label={`${feature.label} birimi`}
                          onChange={(event) =>
                            setFeatures(
                              features.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, unit: event.target.value } : row,
                              ),
                            )
                          }
                        />
                        <Switch
                          checked={feature.isEnabled}
                          aria-label={`${feature.label} aktif`}
                          onCheckedChange={(checked) =>
                            setFeatures(
                              features.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, isEnabled: checked } : row,
                              ),
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                    Paketi kaydettikten sonra limitleri düzenleyebilirsin.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                  Vazgeç
                </Button>
                <Button type="submit" disabled={planMutation.isPending}>
                  {planMutation.isPending ? "Kaydediliyor…" : "Kaydet"}
                </Button>
              </div>
            </form>
          ) : null}
        </SheetContent>
      </Sheet>
    </AdminShell>
  );
}
