import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/ui/button";
import { PlatformDataTable } from "@/components/platform-data-table";
import { useAuth } from "@/lib/auth-context";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { platformAnalyticsQuery } from "@/lib/platform-admin-queries";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Gelişmiş Analitik — Süper Admin" },
      {
        name: "description",
        content: "Platform genelinde ciro, komisyon, MRR, dönüşüm, sipariş kırılımı ve en iyi mağazalar.",
      },
      { property: "og:title", content: "Gelişmiş Analitik — Süper Admin" },
      { property: "og:description", content: "Mefticaret platformunun canlı analitik merkezi." },
    ],
  }),
  component: AdminAnalyticsPage,
});

const RANGES = [7, 30, 90, 180, 365] as const;
const PIE_COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-chart-3, #8b5cf6)",
  "var(--color-chart-4, #10b981)",
  "var(--color-chart-5, #f59e0b)",
  "var(--color-muted-foreground)",
];

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AdminAnalyticsPage() {
  const { isPlatformAdmin } = useAuth();
  const [days, setDays] = useState<number>(30);
  const { data, isLoading } = useQuery(platformAnalyticsQuery(days, isPlatformAdmin));

  const totals = data?.totals;
  const series = data?.series ?? [];

  return (
    <AdminShell
      title="Gelişmiş analitik"
      description="Platform geneli ciro, komisyon, abonelik, dönüşüm ve mağaza performansı."
      actions={
        <div className="flex flex-wrap gap-1">
          {RANGES.map((range) => (
            <Button
              key={range}
              size="sm"
              variant={days === range ? "default" : "outline"}
              onClick={() => setDays(range)}
            >
              {range}g
            </Button>
          ))}
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Platform cirosu" value={formatMoney(totals?.revenue ?? 0)} hint={`${days} günlük`} />
        <Kpi label="Komisyon geliri" value={formatMoney(totals?.commission ?? 0)} />
        <Kpi label="Tahmini MRR" value={formatMoney(totals?.mrr ?? 0)} hint="Aktif + deneme abonelikleri" />
        <Kpi label="Sipariş" value={formatNumber(totals?.orders ?? 0)} />
        <Kpi label="Ortalama sepet" value={formatMoney(totals?.aov ?? 0)} />
        <Kpi
          label="Dönüşüm oranı"
          value={`${((totals?.conversion ?? 0) * 100).toFixed(2)}%`}
          hint={`${formatNumber(totals?.visitors ?? 0)} ziyaretçi`}
        />
        <Kpi label="Yeni mağaza" value={formatNumber(totals?.newStores ?? 0)} />
        <Kpi label="Yeni müşteri" value={formatNumber(totals?.newCustomers ?? 0)} />
        <Kpi label="Terk edilen sepet" value={formatNumber(totals?.abandoned ?? 0)} />
        <Kpi label="İptal / iade" value={formatNumber(totals?.cancelled ?? 0)} />
        <Kpi label="İade tutarı" value={formatMoney(totals?.refunds ?? 0)} />
        <Kpi label="Mağaza başı ciro" value={formatMoney(totals?.arpu ?? 0)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Ciro & komisyon trendi">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(days / 8))} />
                <YAxis tick={{ fontSize: 11 }} width={70} />
                <Tooltip formatter={(value: number) => formatMoney(value)} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Ciro"
                  stroke="var(--color-primary)"
                  fill="var(--color-primary)"
                  fillOpacity={0.15}
                />
                <Area
                  type="monotone"
                  dataKey="commission"
                  name="Komisyon"
                  stroke="var(--color-accent)"
                  fill="var(--color-accent)"
                  fillOpacity={0.2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Sipariş, mağaza ve müşteri büyümesi">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(days / 8))} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={40} />
                <Tooltip formatter={(value: number) => formatNumber(value)} />
                <Line type="monotone" dataKey="orders" name="Sipariş" stroke="var(--color-primary)" dot={false} />
                <Line type="monotone" dataKey="stores" name="Mağaza" stroke="var(--color-accent)" dot={false} />
                <Line
                  type="monotone"
                  dataKey="customers"
                  name="Müşteri"
                  stroke="var(--color-muted-foreground)"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Sipariş durum kırılımı">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.statusBreakdown ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={40} />
                <Tooltip formatter={(value: number) => formatNumber(value)} />
                <Bar dataKey="value" name="Sipariş" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Paket dağılımı">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.planDistribution ?? []}
                  dataKey="value"
                  nameKey="key"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {(data?.planDistribution ?? []).map((entry, i) => (
                    <Cell key={entry.key} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatNumber(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
            {(data?.planDistribution ?? []).map((entry, i) => (
              <li key={entry.key} className="flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                {entry.key}: {formatNumber(entry.value)}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="En iyi mağazalar">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="pb-2">Mağaza</th>
                  <th className="pb-2">Sipariş</th>
                  <th className="pb-2">Ciro</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(data?.topStores ?? []).map((store) => (
                  <tr key={store.storeId}>
                    <td className="py-2">
                      <p className="font-medium">{store.name}</p>
                      <p className="text-xs text-muted-foreground">{store.slug}</p>
                    </td>
                    <td className="py-2">{formatNumber(store.orders)}</td>
                    <td className="py-2">{formatMoney(store.revenue)}</td>
                    <td className="py-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/store/$storeId" params={{ storeId: store.storeId }}>
                          Kontrol
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {!isLoading && (data?.topStores ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      Bu aralıkta sipariş yok.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="En çok satan ürünler">
          <ul className="divide-y divide-border text-sm">
            {(data?.topProducts ?? []).map((product) => (
              <li key={product.title} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">{product.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatNumber(product.quantity)} adet · {formatMoney(product.revenue)}
                </span>
              </li>
            ))}
            {!isLoading && (data?.topProducts ?? []).length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">Kayıt yok.</li>
            ) : null}
          </ul>
        </Panel>

        <Panel title="Finans defteri kırılımı">
          <ul className="divide-y divide-border text-sm">
            {(data?.ledgerBreakdown ?? []).map((entry) => (
              <li key={entry.key} className="flex items-center justify-between gap-3 py-2">
                <span>{entry.key}</span>
                <span className="text-xs text-muted-foreground">{formatMoney(entry.value)}</span>
              </li>
            ))}
            {!isLoading && (data?.ledgerBreakdown ?? []).length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">Kayıt yok.</li>
            ) : null}
          </ul>
        </Panel>

        <Panel title="Abonelik & ödeme durumları">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ul className="divide-y divide-border text-sm">
              {(data?.subscriptionStatus ?? []).map((entry) => (
                <li key={entry.key} className="flex items-center justify-between gap-3 py-2">
                  <span>{entry.key}</span>
                  <span className="text-xs text-muted-foreground">{formatNumber(entry.value)}</span>
                </li>
              ))}
            </ul>
            <ul className="divide-y divide-border text-sm">
              {(data?.paymentBreakdown ?? []).map((entry) => (
                <li key={entry.key} className="flex items-center justify-between gap-3 py-2">
                  <span>{entry.key}</span>
                  <span className="text-xs text-muted-foreground">{formatNumber(entry.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <Panel title="Mağaza bazlı günlük veriler">
        <PlatformDataTable dataset="analytics" />
      </Panel>
    </AdminShell>
  );
}
