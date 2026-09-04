import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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

import {
  Activity,
  BadgeCheck,
  Coins,
  Radio,
  Receipt,
  ShoppingCart,
  Store,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/mefti";
import { adminGrowthQuery, adminOverviewQuery } from "@/lib/admin-queries";
import { adminAuditQuery } from "@/lib/store-queries";
import { platformLiveQuery, platformSummaryQuery } from "@/lib/platform-admin-queries";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Platform Dashboard — Süper Admin" },
      {
        name: "description",
        content: "Kiracı sayısı, GMV, komisyon geliri ve açık destek talepleri tek ekranda.",
      },
      { property: "og:title", content: "Platform Dashboard — Süper Admin" },
      { property: "og:description", content: "Mefticaret platformunun canlı işletme özeti." },
    ],
  }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { isPlatformAdmin } = useAuth();
  const { data: overview } = useQuery(adminOverviewQuery(isPlatformAdmin));
  const { data: growth } = useQuery(adminGrowthQuery(isPlatformAdmin));
  const { data: audit } = useQuery(adminAuditQuery(isPlatformAdmin));
  const { data: summary } = useQuery(platformSummaryQuery(isPlatformAdmin));
  const { data: live } = useQuery(platformLiveQuery(60, isPlatformAdmin));

  const liveBuckets = live?.buckets ?? [];
  const liveMax = Math.max(1, ...liveBuckets.map((bucket) => bucket.count));

  const cards = [
    { label: "Toplam mağaza", value: formatNumber(summary?.stores ?? 0), icon: Store },
    { label: "Aktif mağaza", value: formatNumber(summary?.activeStores ?? 0), icon: BadgeCheck },
    { label: "Kullanıcı", value: formatNumber(summary?.users ?? 0), icon: Users },
    { label: "Satıcı", value: formatNumber(summary?.sellers ?? 0), icon: Activity },
    { label: "Aktif abonelik", value: formatNumber(summary?.subscriptions ?? 0), icon: Receipt },
    { label: "Açık ticket", value: formatNumber(summary?.openTickets ?? 0), icon: Ticket },
    { label: "Platform GMV", value: formatMoney(overview?.gmv ?? 0), icon: TrendingUp },
    { label: "Komisyon geliri", value: formatMoney(summary?.commission ?? overview?.fees ?? 0), icon: Coins },
  ];

  return (
    <AdminShell title="Dashboard" description="Platform genelinde kiracı, gelir ve destek görünürlüğü.">
      <section className="surface-card relative overflow-hidden p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-2 border-success/30 bg-success/10 text-success">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-2 animate-ping rounded-full bg-success/60" />
                  <span className="relative inline-flex size-2 rounded-full bg-success" />
                </span>
                Canlı
              </Badge>
              <span className="text-xs text-muted-foreground">son 60 dakika</span>
            </div>
            <p className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {formatNumber(live?.visitors ?? 0)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              anlık ziyaretçi · {formatNumber(live?.activeStores ?? 0)} mağazada hareket var
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <LiveStat icon={<ShoppingCart />} label="Aktif sepet" value={formatNumber(live?.cartCount ?? 0)} />
              <LiveStat icon={<Receipt />} label="Bugün sipariş" value={formatNumber(live?.orderCount ?? 0)} />
              <LiveStat icon={<Coins />} label="Bugün ciro" value={formatMoney(live?.revenue ?? 0)} />
            </div>
            <Button asChild size="sm" variant="outline" className="mt-4">
              <Link to="/admin/live">
                <Radio className="size-4" />
                Canlı izlemeye git
              </Link>
            </Button>
          </div>
          <div>
            <div className="flex h-32 items-end gap-[3px]" aria-label="Son 60 dakikadaki platform ziyaretçileri">
              {liveBuckets.map((bucket) => (
                <div
                  key={bucket.minute}
                  className="min-w-0 flex-1 rounded-t-sm bg-primary/25 transition-colors hover:bg-primary/60"
                  style={{ height: `${Math.max(6, (bucket.count / liveMax) * 100)}%` }}
                  title={`${bucket.count} ziyaretçi`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>60 dk önce</span>
              <span>şimdi</span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="surface-card p-4 sm:p-5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <card.icon className="size-3.5" />
              </span>
              <span className="truncate">{card.label}</span>
            </div>
            <p className="mt-2 font-display text-xl font-semibold sm:text-2xl">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
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
      </div>

      <section className="surface-card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Son denetim kayıtları</h2>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/audit">Tümünü gör</Link>
          </Button>
        </div>
        <ul className="mt-4 divide-y divide-border">
          {(audit ?? []).slice(0, 10).map((log) => (
            <li key={log.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="font-medium">{log.action}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}

function LiveStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span className="text-primary [&>svg]:size-3.5">{icon}</span>
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
