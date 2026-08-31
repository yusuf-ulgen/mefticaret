import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Megaphone } from "lucide-react";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { campaignAlerts, campaignRows, campaignSummary, campaignTrend } from "@/lib/campaigns";
import { campaignAnalyticsQuery } from "@/lib/campaigns-queries";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/campaigns")({
  head: () => ({
    meta: [
      { title: "Kampanya Performansı — Mefticaret" },
      {
        name: "description",
        content: "Kupon başına ciro, verilen indirim, sepet artışı ve yeni müşteri kazanımını ölç.",
      },
      { property: "og:title", content: "Kampanya Performansı — Mefticaret" },
      {
        property: "og:description",
        content: "Kuponlu ve kuponsuz siparişleri karşılaştır, kampanya kârlılığını takip et.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CampaignsPage,
});

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

function CampaignsPage() {
  const { storeId } = Route.useParams();
  const [windowDays, setWindowDays] = useState(90);

  const { data, isLoading } = useQuery(campaignAnalyticsQuery(storeId, windowDays));
  const input = data ?? { orders: [], discounts: [] };

  const summary = useMemo(() => campaignSummary(input), [input]);
  const rows = useMemo(() => campaignRows(input), [input]);
  const trend = useMemo(() => campaignTrend(input, Math.min(windowDays, 90)), [input, windowDays]);
  const alerts = useMemo(() => campaignAlerts(input), [input]);

  const exportCsv = () => {
    downloadCsv(
      `kampanya-performansi-${storeId}.csv`,
      toCsv(
        ["Kupon", "Başlık", "Sipariş", "Ciro", "Verilen indirim", "Ortalama sepet", "İndirim oranı", "Yeni müşteri"],
        rows.map((row) => [
          row.code,
          row.title ?? "",
          row.orders,
          row.revenue.toFixed(2),
          row.discountGiven.toFixed(2),
          row.aov.toFixed(2),
          pct(row.discountRate),
          row.newCustomers,
        ]),
      ),
    );
  };

  return (
    <AppShell
      storeId={storeId}
      title="Kampanya Performansı"
      description="Kupon başına ciro, indirim maliyeti, sepet artışı ve müşteri kazanımı."
    >
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Megaphone className="size-5 text-primary" /> Kampanya Performansı
            </h1>
            <p className="text-sm text-muted-foreground">
              Son {windowDays} günde kuponların ciroya ve sepet büyüklüğüne etkisi.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-32 space-y-1">
              <Label htmlFor="window">Gün</Label>
              <Input
                id="window"
                type="number"
                min={7}
                max={365}
                value={windowDays}
                onChange={(event) => setWindowDays(Math.min(365, Math.max(7, Number(event.target.value) || 90)))}
              />
            </div>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="mr-2 size-4" /> CSV
            </Button>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Kuponlu sipariş payı", value: pct(summary.couponShare), hint: `${formatNumber(summary.couponOrders)} sipariş` },
            { label: "Kupon cirosu", value: formatMoney(summary.couponRevenue), hint: `Toplam ${formatMoney(summary.totalRevenue)}` },
            { label: "Verilen indirim", value: formatMoney(summary.discountGiven), hint: "Kampanya maliyeti" },
            {
              label: "Sepet etkisi",
              value: `${summary.aovLift >= 0 ? "+" : ""}${pct(summary.aovLift)}`,
              hint: `Kuponlu ${formatMoney(summary.couponAov)} / organik ${formatMoney(summary.organicAov)}`,
            },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold">{card.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
            </div>
          ))}
        </div>

        {alerts.length > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
            <p className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="size-4 text-amber-500" /> Dikkat gerektiren kuponlar
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {alerts.map((alert) => (
                <li key={alert.id}>
                  <span className="font-medium text-foreground">{alert.code}</span>{" "}
                  {alert.nearLimit ? `kullanım limitine yaklaştı (${pct(alert.usageRatio)})` : "süresi yakında doluyor"}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium">Kuponlu vs organik ciro</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(value: string) => value.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => formatMoney(Number(value))} />
                <Area
                  type="monotone"
                  dataKey="organicRevenue"
                  name="Organik"
                  stackId="1"
                  stroke="hsl(var(--muted-foreground))"
                  fill="hsl(var(--muted))"
                />
                <Area
                  type="monotone"
                  dataKey="couponRevenue"
                  name="Kuponlu"
                  stackId="1"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.3)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-3">Kupon</th>
                <th className="p-3 text-right">Sipariş</th>
                <th className="p-3 text-right">Ciro</th>
                <th className="p-3 text-right">İndirim</th>
                <th className="p-3 text-right">Ort. sepet</th>
                <th className="p-3 text-right">İndirim oranı</th>
                <th className="p-3 text-right">Yeni / tekrar</th>
                <th className="p-3">Durum</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={8}>
                    Yükleniyor…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={8}>
                    Bu dönemde kupon kullanılan sipariş bulunmuyor.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.code} className="border-t">
                  <td className="p-3">
                    <p className="font-medium">{row.code}</p>
                    {row.title && <p className="text-xs text-muted-foreground">{row.title}</p>}
                  </td>
                  <td className="p-3 text-right">{formatNumber(row.orders)}</td>
                  <td className="p-3 text-right">{formatMoney(row.revenue)}</td>
                  <td className="p-3 text-right">{formatMoney(row.discountGiven)}</td>
                  <td className="p-3 text-right">{formatMoney(row.aov)}</td>
                  <td className="p-3 text-right">{pct(row.discountRate)}</td>
                  <td className="p-3 text-right">
                    {formatNumber(row.newCustomers)} / {formatNumber(row.repeatCustomers)}
                  </td>
                  <td className="p-3">
                    <Badge variant={row.isActive ? "default" : "secondary"}>{row.isActive ? "Aktif" : "Pasif"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
