import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/mefti";
import { adminPlansQuery } from "@/lib/admin-queries";
import { storeControlQuery } from "@/lib/platform-admin-queries";
import { setStorePlanFn } from "@/lib/platform-admin.functions";
import { setStoreStatus } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/store/$storeId")({
  head: () => ({
    meta: [
      { title: "Mağaza Kontrol Merkezi — Süper Admin" },
      {
        name: "description",
        content: "Tek kiracının paketi, durumu, ekibi, katalog sayaçları ve son siparişleri tek ekranda.",
      },
      { property: "og:title", content: "Mağaza Kontrol Merkezi — Süper Admin" },
      { property: "og:description", content: "Platform yöneticisi için 360° mağaza görünümü." },
    ],
  }),
  component: StoreControlPage,
});

const STATUSES = ["draft", "active", "suspended", "archived"] as const;
const STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  active: "Aktif",
  suspended: "Askıda",
  archived: "Arşiv",
};

function StoreControlPage() {
  const { storeId } = Route.useParams();
  const { isPlatformAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery(storeControlQuery(storeId, isPlatformAdmin));
  const { data: plans } = useQuery(adminPlansQuery(isPlatformAdmin));
  const [planId, setPlanId] = useState<string>("");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["platform-store-control", storeId] });
    void queryClient.invalidateQueries({ queryKey: ["admin-stores"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: (typeof STATUSES)[number]) => setStoreStatus({ data: { storeId, status } }),
    onSuccess: () => {
      toast.success("Mağaza durumu güncellendi");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const planMutation = useMutation({
    mutationFn: (value: string) =>
      setStorePlanFn({ data: { storeId, planId: value === "none" ? null : value } }),
    onSuccess: () => {
      toast.success("Paket güncellendi");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const store = data?.store as Record<string, unknown> | undefined;
  const currentPlanId = (store?.["plan_id"] as string | null) ?? "none";
  const counts = data?.counts;

  const cards = [
    { label: "Ürün", value: formatNumber(counts?.products ?? 0), hint: `${formatNumber(counts?.activeProducts ?? 0)} aktif` },
    { label: "Varyant", value: formatNumber(counts?.variants ?? 0) },
    { label: "Sipariş", value: formatNumber(counts?.orders ?? 0) },
    { label: "Müşteri", value: formatNumber(counts?.customers ?? 0) },
    { label: "Kupon", value: formatNumber(counts?.discounts ?? 0) },
    { label: "Sayfa", value: formatNumber(counts?.pages ?? 0) },
    { label: "Tema bölümü", value: formatNumber(counts?.sections ?? 0) },
    { label: "Domain", value: formatNumber(counts?.domains ?? 0) },
    { label: "Webhook", value: formatNumber(counts?.webhooks ?? 0) },
    { label: "API anahtarı", value: formatNumber(counts?.apiKeys ?? 0) },
    { label: "Ciro (defter)", value: formatMoney(data?.finance.revenue ?? 0) },
    { label: "Komisyon", value: formatMoney(data?.finance.fees ?? 0) },
  ];

  return (
    <AdminShell
      title={(store?.["name"] as string) ?? "Mağaza kontrol merkezi"}
      description="Kiracıya ait paket, durum, ekip, katalog ve finans görünümü."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/stores">Mağazalar</Link>
          </Button>
          {store?.["slug"] ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/s/$slug" params={{ slug: store["slug"] as string }}>
                Vitrin
              </Link>
            </Button>
          ) : null}
          <Button asChild size="sm">
            <Link to="/store/$storeId/dashboard" params={{ storeId }}>
              Satıcı paneli
            </Link>
          </Button>
        </div>
      }
    >
      {error ? (
        <div className="surface-card p-6 text-sm text-destructive">{(error as Error).message}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <section className="surface-card p-6 xl:col-span-2">
          <h2 className="font-display text-lg font-semibold">Kiracı bilgileri</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Slug</dt>
              <dd>{(store?.["slug"] as string) ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sektör</dt>
              <dd>{(store?.["industry"] as string) ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Para birimi / dil</dt>
              <dd>
                {(store?.["currency"] as string) ?? "—"} · {(store?.["locale"] as string) ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Oluşturma</dt>
              <dd>{store?.["created_at"] ? formatDateTime(store["created_at"] as string) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sahibi</dt>
              <dd>
                {data?.owner?.full_name ?? "—"}
                <span className="block text-xs text-muted-foreground">{data?.owner?.email ?? "—"}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Abonelik</dt>
              <dd>
                {data?.subscription
                  ? `${String(data.subscription["status"])} · ${String(data.subscription["billing_interval"])}`
                  : "Abonelik yok"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="surface-card p-6">
          <h2 className="font-display text-lg font-semibold">Yönetim</h2>
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Durum</p>
              <Select
                value={(store?.["status"] as string) ?? "draft"}
                onValueChange={(value) => statusMutation.mutate(value as (typeof STATUSES)[number])}
                disabled={isLoading || statusMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Paket</p>
              <Select
                value={planId || currentPlanId}
                onValueChange={(value) => {
                  setPlanId(value);
                  planMutation.mutate(value);
                }}
                disabled={isLoading || planMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Paket seç" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Paketsiz</SelectItem>
                  {(plans ?? []).map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="surface-card p-5">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-2 font-display text-2xl font-semibold">{card.value}</p>
            {card.hint ? <p className="mt-1 text-[11px] text-muted-foreground">{card.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="surface-card p-6">
          <h2 className="font-display text-lg font-semibold">Ekip</h2>
          <ul className="mt-4 divide-y divide-border text-sm">
            {(data?.team ?? []).map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">
                  {member.fullName ?? member.email}
                  <span className="block text-xs text-muted-foreground">{member.email}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{member.role}</span>
              </li>
            ))}
            {!isLoading && (data?.team ?? []).length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">Ekip kaydı yok.</li>
            ) : null}
          </ul>
        </section>

        <section className="surface-card p-6">
          <h2 className="font-display text-lg font-semibold">Son siparişler</h2>
          <ul className="mt-4 divide-y divide-border text-sm">
            {(data?.recentOrders ?? []).map((order) => (
              <li key={String(order["id"])} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">
                  {String(order["order_number"])}
                  <span className="block text-xs text-muted-foreground">
                    {String(order["status"])} · {String(order["payment_status"])}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatMoney(Number(order["grand_total"] ?? 0))}
                </span>
              </li>
            ))}
            {!isLoading && (data?.recentOrders ?? []).length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">Sipariş yok.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {CONTROL_GROUPS.map((group) => (
          <section key={group.title} className="surface-card p-6">
            <h2 className="font-display text-lg font-semibold">{group.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {group.links.map((link) => (
                <Button key={link.to} asChild size="sm" variant="outline">
                  <Link to={link.to} params={{ storeId }}>
                    {link.label}
                  </Link>
                </Button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminShell>
  );
}

/** Süper yöneticinin kiracının ön yüzünü ve arka yüzünü doğrudan yönetmesi için kısayollar. */
const CONTROL_GROUPS = [
  {
    title: "Ön uç yönetimi",
    description: "Vitrin görünümü, tema blokları, sayfalar, menü, medya ve SEO.",
    links: [
      { to: "/admin/frontend/$storeId", label: "Ön uç kontrol paneli" },
      { to: "/store/$storeId/theme-editor", label: "Tema editörü" },

      { to: "/store/$storeId/themes", label: "Tema mağazası" },
      { to: "/store/$storeId/theme-sections", label: "Tema bölümleri" },
      { to: "/store/$storeId/pages", label: "Sayfalar" },
      { to: "/store/$storeId/navigation", label: "Menüler" },
      { to: "/store/$storeId/media", label: "Medya" },
      { to: "/store/$storeId/blog", label: "Blog" },
      { to: "/store/$storeId/seo", label: "SEO" },
      { to: "/store/$storeId/domains", label: "Domainler" },
      { to: "/store/$storeId/live", label: "Canlı izleme" },
    ],
  },
  {
    title: "Arka uç yönetimi",
    description: "Katalog, sipariş, müşteri, stok, kargo, ödeme, finans ve entegrasyonlar.",
    links: [
      { to: "/store/$storeId/products", label: "Ürünler" },
      { to: "/store/$storeId/orders", label: "Siparişler" },
      { to: "/store/$storeId/customers", label: "Müşteriler" },
      { to: "/store/$storeId/inventory", label: "Stok" },
      { to: "/store/$storeId/shipping", label: "Kargo" },
      { to: "/store/$storeId/payments", label: "Ödeme" },
      { to: "/store/$storeId/finance", label: "Finans" },
      { to: "/store/$storeId/discounts", label: "Kuponlar" },
      { to: "/store/$storeId/api", label: "API" },
      { to: "/store/$storeId/webhooks", label: "Webhook" },
      { to: "/store/$storeId/team", label: "Ekip" },
      { to: "/store/$storeId/settings", label: "Ayarlar" },
    ],
  },
] as const;
