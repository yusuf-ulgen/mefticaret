import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, Timer } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import { DEFAULT_SLA_TARGETS, analyzeSla } from "@/lib/sla";
import { slaDataQuery } from "@/lib/sla-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/sla")({
  head: () => ({
    meta: [
      { title: "Karşılama SLA — Mefticaret" },
      {
        name: "description",
        content:
          "Sipariş karşılama, kargoya verme ve teslim sürelerini hedeflerle karşılaştır; SLA aşan siparişleri yakala.",
      },
      { property: "og:title", content: "Karşılama SLA — Mefticaret" },
      {
        property: "og:description",
        content: "Sipariş karşılama süreleri, taşıyıcı bazlı SLA performansı ve gecikme uyarıları.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SlaPage,
});

function SlaPage() {
  const { storeId } = Route.useParams();
  const [handling, setHandling] = useState(DEFAULT_SLA_TARGETS.handling);
  const [dispatch, setDispatch] = useState(DEFAULT_SLA_TARGETS.dispatch);
  const [delivery, setDelivery] = useState(DEFAULT_SLA_TARGETS.delivery);
  const [onlyBreached, setOnlyBreached] = useState(true);

  const { data, isLoading } = useQuery(slaDataQuery(storeId));

  const analysis = useMemo(
    () => analyzeSla(data?.orders ?? [], data?.shipments ?? [], { handling, dispatch, delivery }),
    [data, handling, dispatch, delivery],
  );

  const rows = onlyBreached ? analysis.rows.filter((row) => row.breached) : analysis.rows;

  const exportCsv = () => {
    downloadCsv(
      `karsilama-sla-${storeId}.csv`,
      toCsv(
        [
          "Sipariş",
          "Müşteri",
          "Tarih",
          "Taşıyıcı",
          "Karşılama (sa)",
          "Kargoya verme (sa)",
          "Teslim (sa)",
          "Toplam (sa)",
          "Bekleyen (sa)",
          "SLA",
        ],
        rows.map((row) => [
          row.orderNumber,
          row.customerName,
          row.placedAt.slice(0, 10),
          row.carrier ?? "-",
          row.handlingHours ?? "",
          row.dispatchHours ?? "",
          row.deliveryHours ?? "",
          row.totalHours ?? "",
          row.pendingHours ?? "",
          row.breached ? "Aşıldı" : "Uygun",
        ]),
      ),
    );
  };

  const kpis = [
    {
      label: "Zamanında karşılama",
      value: `${(analysis.summary.onTimeRate * 100).toFixed(1)}%`,
    },
    {
      label: "Ort. karşılama süresi",
      value: analysis.summary.avgHandling === null ? "—" : `${analysis.summary.avgHandling} sa`,
    },
    {
      label: "Ort. teslim süresi",
      value: analysis.summary.avgTotal === null ? "—" : `${analysis.summary.avgTotal} sa`,
    },
    { label: "Risk altındaki ciro", value: formatMoney(analysis.summary.atRiskValue) },
  ];

  return (
    <AppShell
      storeId={storeId}
      title="Karşılama SLA"
      description="Sipariş → sevkiyat → kargo → teslim adımlarındaki süreleri hedeflerinle karşılaştır."
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

        <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="sla-handling">Karşılama hedefi (sa)</Label>
            <Input
              id="sla-handling"
              type="number"
              min={1}
              value={handling}
              onChange={(event) => setHandling(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sla-dispatch">Kargoya verme hedefi (sa)</Label>
            <Input
              id="sla-dispatch"
              type="number"
              min={1}
              value={dispatch}
              onChange={(event) => setDispatch(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sla-delivery">Teslim hedefi (sa)</Label>
            <Input
              id="sla-delivery"
              type="number"
              min={1}
              value={delivery}
              onChange={(event) => setDelivery(Math.max(1, Number(event.target.value) || 1))}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={() => setOnlyBreached((value) => !value)}>
              {onlyBreached ? "Tümünü göster" : "Sadece gecikenler"}
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
              <Download className="mr-2 size-4" /> CSV
            </Button>
          </div>
        </section>

        {analysis.summary.breachedCount > 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <AlertTriangle className="mt-0.5 size-5 text-destructive" />
            <div>
              <p className="font-medium">
                {formatNumber(analysis.summary.breachedCount)} sipariş SLA hedefini aştı
              </p>
              <p className="text-sm text-muted-foreground">
                {formatNumber(analysis.summary.openOrders)} sipariş hâlâ sevkiyat bekliyor. Öncelikli
                işleri Operasyon Merkezi'nden takip edebilirsin.
              </p>
            </div>
          </div>
        ) : null}

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-muted-foreground" />
            <h2 className="font-display text-lg font-semibold">Günlük karşılama süresi trendi</h2>
          </div>
          {analysis.trend.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysis.trend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit=" sa" />
                  <Tooltip
                    formatter={(value: number) => [`${value} sa`, "Ort. karşılama"]}
                    contentStyle={{ borderRadius: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgHandling"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Yükleniyor…" : "Henüz sevkiyatı tamamlanmış sipariş yok."}
            </p>
          )}
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Taşıyıcı bazlı SLA</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Taşıyıcı</th>
                  <th className="py-2">Sevkiyat</th>
                  <th className="py-2">Teslim edilen</th>
                  <th className="py-2">Ort. kargoya verme</th>
                  <th className="py-2">Ort. teslim</th>
                  <th className="py-2">Zamanında</th>
                </tr>
              </thead>
              <tbody>
                {analysis.carriers.map((carrier) => (
                  <tr key={carrier.carrier} className="border-t">
                    <td className="py-2 font-medium">{carrier.carrier}</td>
                    <td className="py-2">{formatNumber(carrier.shipments)}</td>
                    <td className="py-2">{formatNumber(carrier.delivered)}</td>
                    <td className="py-2">
                      {carrier.avgDispatch === null ? "—" : `${carrier.avgDispatch} sa`}
                    </td>
                    <td className="py-2">
                      {carrier.avgDelivery === null ? "—" : `${carrier.avgDelivery} sa`}
                    </td>
                    <td className="py-2">{(carrier.onTimeRate * 100).toFixed(0)}%</td>
                  </tr>
                ))}
                {!analysis.carriers.length ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-sm text-muted-foreground">
                      Taşıyıcı verisi bulunamadı.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">
            Sipariş detayları ({formatNumber(rows.length)})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Sipariş</th>
                  <th className="py-2">Müşteri</th>
                  <th className="py-2">Karşılama</th>
                  <th className="py-2">Kargoya verme</th>
                  <th className="py-2">Teslim</th>
                  <th className="py-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="py-2">
                      <Link
                        to="/store/$storeId/orders/$orderId"
                        params={{ storeId, orderId: row.id }}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        #{row.orderNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">{row.placedAt.slice(0, 10)}</p>
                    </td>
                    <td className="py-2">{row.customerName}</td>
                    <td className="py-2">
                      {row.handlingHours !== null
                        ? `${row.handlingHours} sa`
                        : row.pendingHours !== null
                          ? `${row.pendingHours} sa bekliyor`
                          : "—"}
                    </td>
                    <td className="py-2">
                      {row.dispatchHours === null ? "—" : `${row.dispatchHours} sa`}
                    </td>
                    <td className="py-2">
                      {row.deliveryHours === null ? "—" : `${row.deliveryHours} sa`}
                    </td>
                    <td className="py-2">
                      {row.breached ? (
                        <div className="space-y-1">
                          <Badge variant="destructive">SLA aşıldı</Badge>
                          <p className="text-xs text-muted-foreground">
                            {row.breachReasons.join(" · ")}
                          </p>
                        </div>
                      ) : (
                        <Badge variant="secondary">Uygun</Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-sm text-muted-foreground">
                      {isLoading ? "Yükleniyor…" : "Bu filtrede sipariş yok."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
