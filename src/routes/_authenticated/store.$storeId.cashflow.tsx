import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { CASH_KIND_LABELS, analyzeCashflow } from "@/lib/cashflow";
import { cashflowDataQuery } from "@/lib/cashflow-queries";
import { formatMoney, formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/cashflow")({
  head: () => ({
    meta: [
      { title: "Nakit Akışı — Mefticaret" },
      {
        name: "description",
        content:
          "Finans defterinden haftalık ve aylık nakit giriş/çıkışı, gider kırılımı ve 3 aylık nakit projeksiyonu.",
      },
      { property: "og:title", content: "Nakit Akışı — Mefticaret" },
      {
        property: "og:description",
        content: "Net nakit akışı, kümülatif bakiye, komisyon/iade giderleri ve bekleyen hakedişler.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CashflowPage,
});

function CashflowPage() {
  const { storeId } = Route.useParams();
  const [grain, setGrain] = useState<"month" | "week">("month");

  const { data, isLoading } = useQuery(cashflowDataQuery(storeId));
  const analysis = useMemo(() => analyzeCashflow(data?.entries ?? [], data?.payouts ?? []), [data]);

  const periods = grain === "month" ? analysis.months : analysis.weeks;

  const chartData = periods.map((period) => ({
    name: period.label,
    giriş: Number(period.inflow.toFixed(2)),
    çıkış: Number(period.outflow.toFixed(2)),
    net: Number(period.net.toFixed(2)),
  }));

  const cumulativeData = periods.map((period) => ({
    name: period.label,
    bakiye: Number(period.cumulative.toFixed(2)),
  }));

  const exportCsv = () => {
    downloadCsv(
      `nakit-akisi-${grain}-${storeId}.csv`,
      toCsv(
        ["Dönem", "Giriş", "Çıkış", "Net", "Kümülatif"],
        periods.map((period) => [
          period.label,
          period.inflow.toFixed(2),
          period.outflow.toFixed(2),
          period.net.toFixed(2),
          period.cumulative.toFixed(2),
        ]),
      ),
    );
  };

  const kpis = [
    { label: "Nakit giriş", value: formatMoney(analysis.summary.inflow) },
    { label: "Nakit çıkış", value: formatMoney(analysis.summary.outflow) },
    { label: "Net akış", value: formatMoney(analysis.summary.net) },
    { label: "Net marj", value: `${(analysis.summary.margin * 100).toFixed(1)}%` },
  ];

  return (
    <AppShell
      storeId={storeId}
      title="Nakit Akışı"
      description="Finans defterine dayalı nakit giriş/çıkış analizi, gider kırılımı ve projeksiyon."
    >
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
              <p className="mt-1 font-display text-2xl font-semibold">{kpi.value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Günlük ortalama net</p>
            <p className="mt-1 font-display text-xl font-semibold">
              {formatMoney(analysis.summary.avgDailyNet)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Bekleyen hakediş</p>
            <p className="mt-1 font-display text-xl font-semibold">
              {formatMoney(analysis.summary.pendingPayouts)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ödenen hakediş</p>
            <p className="mt-1 font-display text-xl font-semibold">
              {formatMoney(analysis.summary.paidPayouts)}
            </p>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Nakit giriş / çıkış</h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={grain === "month" ? "default" : "outline"}
                onClick={() => setGrain("month")}
              >
                Aylık
              </Button>
              <Button
                size="sm"
                variant={grain === "week" ? "default" : "outline"}
                onClick={() => setGrain("week")}
              >
                Haftalık
              </Button>
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!periods.length}>
                <Download className="mr-2 size-4" /> CSV
              </Button>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(value: number) => formatMoney(value)} />
                <Legend />
                <Bar dataKey="giriş" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="çıkış" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="mb-4 font-display text-lg font-semibold">Kümülatif nakit bakiyesi</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(value: number) => formatMoney(value)} />
                <Line type="monotone" dataKey="bakiye" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border bg-card">
            <div className="border-b p-4">
              <h2 className="font-display text-lg font-semibold">Kalem kırılımı</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Kalem</th>
                    <th className="px-4 py-3 text-left">Yön</th>
                    <th className="px-4 py-3 text-right">Kayıt</th>
                    <th className="px-4 py-3 text-right">Tutar</th>
                    <th className="px-4 py-3 text-right">Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        Yükleniyor…
                      </td>
                    </tr>
                  ) : analysis.kinds.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-muted-foreground">
                        Henüz finans kaydı yok.
                      </td>
                    </tr>
                  ) : (
                    analysis.kinds.map((row) => (
                      <tr key={row.kind} className="border-t">
                        <td className="px-4 py-3 font-medium">{CASH_KIND_LABELS[row.kind] ?? row.kind}</td>
                        <td className="px-4 py-3">
                          <Badge variant={row.direction === "credit" ? "secondary" : "outline"}>
                            {row.direction === "credit" ? "Giriş" : "Çıkış"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">{formatNumber(row.count)}</td>
                        <td className="px-4 py-3 text-right font-medium">{formatMoney(row.total)}</td>
                        <td className="px-4 py-3 text-right">{(row.share * 100).toFixed(1)}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b p-4">
              <Wallet className="size-4 text-muted-foreground" />
              <h2 className="font-display text-lg font-semibold">3 aylık projeksiyon</h2>
            </div>
            <ul className="divide-y">
              {analysis.projection.map((item) => (
                <li key={item.label} className="flex items-center justify-between px-4 py-3">
                  <span>{item.label}</span>
                  <span className={item.net >= 0 ? "font-medium text-emerald-600" : "font-medium text-destructive"}>
                    {formatMoney(item.net)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t p-4 text-xs text-muted-foreground">
              Projeksiyon, son 3 ayın ağırlıklı ortalama net akışına dayanır; sezonluk kampanyalar dahil
              değildir.
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
