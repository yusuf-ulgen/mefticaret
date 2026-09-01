import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatMoney, formatNumber, STORE_STATUS_LABELS } from "@/lib/mefti";
import { adminAuditQuery, adminStoresQuery } from "@/lib/store-queries";
import {
  adminGrowthQuery,
  adminOverviewQuery,
  adminPlansQuery,
  type PlanRow,
} from "@/lib/admin-queries";
import { downloadCsv, toCsv } from "@/lib/csv";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { savePlatformPlan, setStoreStatus } from "@/lib/admin.functions";
import { savePlanFeatures } from "@/lib/subscription.functions";
import { planFeaturesQuery, type PlanFeatureRow } from "@/lib/subscription-queries";
import { METRIC_CATALOG, limitLabel } from "@/lib/subscription";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Süper Admin — Mefticaret" },
      {
        name: "description",
        content: "Platform genelinde mağazaları, paketleri, komisyonları ve denetim kayıtlarını yönet.",
      },
      { property: "og:title", content: "Süper Admin — Mefticaret" },
      { property: "og:description", content: "Çok kiracılı platformun merkezi yönetim konsolu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const STATUS_OPTIONS = ["draft", "active", "suspended", "archived"] as const;

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

function AdminPage() {
  const { isPlatformAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const { data: stores } = useQuery(adminStoresQuery(isPlatformAdmin));
  const { data: audit } = useQuery(adminAuditQuery(isPlatformAdmin));
  const { data: plans } = useQuery(adminPlansQuery(isPlatformAdmin));
  const { data: overview } = useQuery(adminOverviewQuery(isPlatformAdmin));
  const { data: growth } = useQuery(adminGrowthQuery(isPlatformAdmin));

  const { data: allFeatures } = useQuery(planFeaturesQuery());

  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [features, setFeatures] = useState<FeatureDraft[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | (typeof STATUS_OPTIONS)[number]>("all");

  const updateStatus = useServerFn(setStoreStatus);
  const savePlan = useServerFn(savePlatformPlan);
  const saveFeatures = useServerFn(savePlanFeatures);

  const featuresByPlan = (planId: string) =>
    (allFeatures ?? []).filter((row) => row.plan_id === planId);

  const openPlan = (plan?: PlanRow) => {
    setDraft(toDraft(plan));
    setFeatures(toFeatureDrafts(plan ? featuresByPlan(plan.id) : []));
  };

  const statusMutation = useMutation({
    mutationFn: (input: { storeId: string; status: (typeof STATUS_OPTIONS)[number] }) =>
      updateStatus({ data: input }),
    onSuccess: () => {
      toast.success("Mağaza durumu güncellendi");
      queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

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

  if (!loading && !isPlatformAdmin) {
    return (
      <AppShell title="Süper Admin" description="Bu alan platform yöneticilerine ayrılmıştır.">
        <div className="surface-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold">Erişim yetkiniz yok</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Yetkiler veritabanı seviyesinde denetlenir; bu sayfadaki veriler size gösterilmez.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/stores">Mağazalarıma dön</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const allRows = stores ?? [];
  const active = allRows.filter((store) => store.status === "active").length;
  const term = search.trim().toLocaleLowerCase("tr-TR");
  const rows = allRows.filter((store) => {
    if (statusFilter !== "all" && store.status !== statusFilter) return false;
    if (!term) return true;
    return (
      store.name.toLocaleLowerCase("tr-TR").includes(term) ||
      store.slug.toLocaleLowerCase("tr-TR").includes(term)
    );
  });

  const exportStores = () => {
    downloadCsv(
      `mefticaret-magazalar-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ["Mağaza", "Slug", "Paket", "Durum", "Oluşturma"],
        rows.map((store) => [
          store.name,
          store.slug,
          store.plans?.name ?? "",
          STORE_STATUS_LABELS[store.status] ?? store.status,
          formatDateTime(store.created_at),
        ]),
      ),
    );
  };

  return (
    <AppShell title="Süper Admin" description="Platform genelinde kiracı, paket ve finans görünürlüğü.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Toplam mağaza", value: formatNumber(rows.length) },
          { label: "Aktif mağaza", value: formatNumber(active) },
          { label: "Platform GMV", value: formatMoney(overview?.gmv ?? 0) },
          { label: "Komisyon geliri", value: formatMoney(overview?.fees ?? 0) },
        ].map((card) => (
          <div key={card.label} className="surface-card p-5">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-2 font-display text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="stores" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stores">Mağazalar</TabsTrigger>
          <TabsTrigger value="plans">Paketler</TabsTrigger>
          <TabsTrigger value="growth">Büyüme</TabsTrigger>
          <TabsTrigger value="audit">Denetim</TabsTrigger>
        </TabsList>

        <TabsContent value="stores" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Mağaza adı veya slug ara"
              className="h-9 w-full sm:w-72"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
            >
              <SelectTrigger className="h-9 w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm durumlar</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STORE_STATUS_LABELS[status] ?? status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {formatNumber(rows.length)} kayıt listeleniyor
            </span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={exportStores}>
              <Download className="size-4" /> CSV indir
            </Button>
          </div>
          <div className="surface-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Mağaza</th>
                  <th className="px-5 py-3">Paket</th>
                  <th className="px-5 py-3">Durum</th>
                  <th className="px-5 py-3">Oluşturma</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((store) => (
                  <tr key={store.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{store.name}</p>
                      <p className="text-xs text-muted-foreground">{store.slug}</p>
                    </td>
                    <td className="px-5 py-3">{store.plans?.name ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Select
                        value={store.status}
                        onValueChange={(value) =>
                          statusMutation.mutate({
                            storeId: store.id,
                            status: value as (typeof STATUS_OPTIONS)[number],
                          })
                        }
                      >
                        <SelectTrigger className="h-9 w-[170px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                              {STORE_STATUS_LABELS[status] ?? status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {formatDateTime(store.created_at)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/store/$storeId/dashboard" params={{ storeId: store.id }}>
                          Panel
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Paket fiyatları, komisyon oranı ve kiracı limitleri buradan yönetilir.
            </p>
            <Button size="sm" onClick={() => setDraft(toDraft())}>
              <Plus className="size-4" /> Yeni paket
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(plans ?? []).map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => setDraft(toDraft(plan))}
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
                  {(Number(plan.commission_rate) * 100).toFixed(2)}% komisyon
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {Object.keys(plan.limits ?? {}).length} limit tanımı · {plan.trial_days} gün deneme
                </p>
              </button>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="growth" className="grid gap-4 xl:grid-cols-2">
          <section className="surface-card p-6">
            <h2 className="font-display text-lg font-semibold">Platform cirosu (30 gün)</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growth ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={4} />
                  <YAxis tick={{ fontSize: 11 }} width={70} />
                  <Tooltip
                    formatter={(value: number, name) =>
                      name === "revenue" ? formatMoney(value) : formatNumber(value)
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-primary)"
                    fill="var(--color-primary)"
                    fillOpacity={0.15}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>
          <section className="surface-card p-6">
            <h2 className="font-display text-lg font-semibold">Yeni mağaza & sipariş adedi</h2>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={growth ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={4} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={40} />
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                  <Bar dataKey="orders" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="stores" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Koyu çubuklar sipariş adedini, vurgu rengi yeni açılan mağazaları gösterir.
            </p>
          </section>
        </TabsContent>

        <TabsContent value="audit">
          <section className="surface-card p-6">
            <h2 className="font-display text-lg font-semibold">Platform denetim kayıtları</h2>
            <ul className="mt-4 divide-y divide-border">
              {(audit ?? []).map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="font-medium">{log.action}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>
      </Tabs>

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
              <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="space-y-2">
                <Label htmlFor="plan-limits">Limitler (JSON)</Label>
                <Textarea
                  id="plan-limits"
                  rows={6}
                  className="font-mono text-xs"
                  value={draft.limits}
                  onChange={(event) => setDraft({ ...draft, limits: event.target.value })}
                />
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
    </AppShell>
  );
}
