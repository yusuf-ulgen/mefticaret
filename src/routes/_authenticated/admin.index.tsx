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

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatMoney, formatNumber } from "@/lib/mefti";
import { adminGrowthQuery, adminOverviewQuery } from "@/lib/admin-queries";
import { adminAuditQuery } from "@/lib/store-queries";
import { platformSummaryQuery } from "@/lib/platform-admin-queries";

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

  const cards = [
    { label: "Toplam mağaza", value: formatNumber(summary?.stores ?? 0) },
    { label: "Aktif mağaza", value: formatNumber(summary?.activeStores ?? 0) },
    { label: "Kullanıcı", value: formatNumber(summary?.users ?? 0) },
    { label: "Satıcı", value: formatNumber(summary?.sellers ?? 0) },
    { label: "Aktif abonelik", value: formatNumber(summary?.subscriptions ?? 0) },
    { label: "Açık ticket", value: formatNumber(summary?.openTickets ?? 0) },
    { label: "Platform GMV", value: formatMoney(overview?.gmv ?? 0) },
    { label: "Komisyon geliri", value: formatMoney(summary?.commission ?? overview?.fees ?? 0) },
  ];

  return (
    <AdminShell title="Dashboard" description="Platform genelinde kiracı, gelir ve destek görünürlüğü.">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="surface-card p-5">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-2 font-display text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
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
