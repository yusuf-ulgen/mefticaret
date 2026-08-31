import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { LOSS_LABELS, STALE_PENDING_HOURS, analyzeLosses, type LossKind } from "@/lib/losses";
import { lossesDataQuery } from "@/lib/losses-queries";
import { formatMoney, formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/losses")({
  head: () => ({
    meta: [
      { title: "İptal & Kayıp Analizi — Mefticaret" },
      {
        name: "description",
        content:
          "İptal, geri ödeme ve başarısız ödemelerden doğan ciro kaybını sebep, ay ve ürün bazında incele.",
      },
      { property: "og:title", content: "İptal & Kayıp Analizi — Mefticaret" },
      {
        property: "og:description",
        content: "Kayıp ciro oranı, sebep kırılımı, aylık trend ve kurtarılabilir sipariş listesi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LossesPage,
});

function LossesPage() {
  const { storeId } = Route.useParams();
  const [kind, setKind] = useState<LossKind | "all">("all");

  const { data, isLoading } = useQuery(lossesDataQuery(storeId));
  const analysis = useMemo(() => analyzeLosses(data?.orders ?? [], data?.items ?? []), [data]);

  const rows = kind === "all" ? analysis.rows : analysis.rows.filter((row) => row.kind === kind);

  const exportCsv = () => {
    downloadCsv(
      `iptal-kayip-${storeId}.csv`,
      toCsv(
        ["Sipariş", "Tarih", "Müşteri", "Tutar", "Sebep", "Kupon"],
        rows.map((row) => [
          row.orderNumber,
          row.placedAt.slice(0, 10),
          row.customerName,
          row.amount.toFixed(2),
          LOSS_LABELS[row.kind],
          row.discountCode ?? "",
        ]),
      ),
    );
  };

  const kpis = [
    { label: "Kayıp ciro", value: formatMoney(analysis.summary.lostRevenue) },
    { label: "Kayıp oranı", value: `${(analysis.summary.lossRate * 100).toFixed(1)}%` },
    { label: "Kayıp sipariş", value: formatNumber(analysis.summary.lostOrders) },
    { label: "Kurtarılabilir", value: formatMoney(analysis.summary.recoverableRevenue) },
  ];

  return (
    <AppShell
      storeId={storeId}
      title="İptal & Kayıp Analizi"
      description="Son 180 günde iptal, geri ödeme ve ödeme sorunlarından kaynaklanan ciro kaybını incele."
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

        {analysis.summary.recoverableRevenue > 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
            <AlertTriangle className="mt-0.5 size-5 text-amber-600" />
            <div>
              <p className="font-medium">
                {formatMoney(analysis.summary.recoverableRevenue)} tutarında sipariş ödeme sorunu
                nedeniyle kayıpta
              </p>
              <p className="text-sm text-muted-foreground">
                {STALE_PENDING_HOURS} saatten uzun süre ödeme bekleyen veya ödemesi başarısız olan
                siparişler müşteriye hatırlatma ile kurtarılabilir.
              </p>
            </div>
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3 rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <TrendingDown className="size-4 text-muted-foreground" />
              <h2 className="font-display text-lg font-semibold">Sebep kırılımı</h2>
            </div>
            <div className="space-y-3">
              {analysis.byKind.map((entry) => (
                <div key={entry.kind} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{entry.label}</span>
                    <span className="text-muted-foreground">
                      {formatNumber(entry.orders)} sipariş · {formatMoney(entry.amount)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.max(2, entry.share * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
              {!analysis.byKind.length ? (
                <p className="text-sm text-muted-foreground">
                  {isLoading ? "Yükleniyor…" : "Kayıp kaydı bulunmuyor. Harika!"}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-display text-lg font-semibold">Aylık kayıp / gerçekleşen ciro</h2>
            {analysis.byMonth.length ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number, name) => [
                        formatMoney(value),
                        name === "wonAmount" ? "Gerçekleşen" : "Kayıp",
                      ]}
                      contentStyle={{ borderRadius: 12 }}
                    />
                    <Legend
                      formatter={(value) => (value === "wonAmount" ? "Gerçekleşen" : "Kayıp")}
                    />
                    <Bar dataKey="wonAmount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lostAmount" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Yükleniyor…" : "Yeterli sipariş verisi yok."}
              </p>
            )}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="font-display text-lg font-semibold">En çok kayıp yaşanan ürünler</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Ürün</th>
                  <th className="py-2">Kayıp sipariş</th>
                  <th className="py-2">Adet</th>
                  <th className="py-2">Kayıp tutar</th>
                </tr>
              </thead>
              <tbody>
                {analysis.topProducts.map((product) => (
                  <tr key={product.productId} className="border-t">
                    <td className="py-2 font-medium">{product.title}</td>
                    <td className="py-2">{formatNumber(product.orders)}</td>
                    <td className="py-2">{formatNumber(product.units)}</td>
                    <td className="py-2">{formatMoney(product.amount)}</td>
                  </tr>
                ))}
                {!analysis.topProducts.length ? (
                  <tr>
                    <td colSpan={4} className="py-4 text-sm text-muted-foreground">
                      {isLoading ? "Yükleniyor…" : "Kayıp ürün kaydı yok."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">
              Kayıp siparişler ({formatNumber(rows.length)})
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={kind === "all" ? "default" : "outline"}
                onClick={() => setKind("all")}
              >
                Tümü
              </Button>
              {analysis.byKind.map((entry) => (
                <Button
                  key={entry.kind}
                  size="sm"
                  variant={kind === entry.kind ? "default" : "outline"}
                  onClick={() => setKind(entry.kind)}
                >
                  {entry.label}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={exportCsv} disabled={!rows.length}>
                <Download className="mr-2 size-4" /> CSV
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-2">Sipariş</th>
                  <th className="py-2">Müşteri</th>
                  <th className="py-2">Tutar</th>
                  <th className="py-2">Sebep</th>
                  <th className="py-2">Kupon</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((row) => (
                  <tr key={row.id} className="border-t">
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
                    <td className="py-2">{formatMoney(row.amount)}</td>
                    <td className="py-2">
                      <Badge variant={row.kind === "refunded" ? "destructive" : "secondary"}>
                        {LOSS_LABELS[row.kind]}
                      </Badge>
                    </td>
                    <td className="py-2 text-muted-foreground">{row.discountCode ?? "—"}</td>
                  </tr>
                ))}
                {!rows.length ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-sm text-muted-foreground">
                      {isLoading ? "Yükleniyor…" : "Bu filtrede kayıp sipariş yok."}
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
