import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BellRing, RefreshCcw, Repeat } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";
import { formatMoney, formatNumber } from "@/lib/mefti";
import {
  intervalBands,
  productRepurchase,
  reminderCandidates,
  repurchaseSummary,
} from "@/lib/repurchase";
import { repurchaseQuery } from "@/lib/repurchase-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/repurchase")({
  head: () => ({
    meta: [
      { title: "Tekrar Satın Alma Analizi — Mefticaret" },
      {
        name: "description",
        content:
          "Ürün bazlı tekrar satın alma oranı, satın alma sıklığı ve hatırlatma kampanyası için gecikmiş müşteri listesi.",
      },
      { property: "og:title", content: "Tekrar Satın Alma Analizi — Mefticaret" },
      {
        property: "og:description",
        content: "Hangi ürünler tekrar alınıyor, ne sıklıkla? Gecikmiş müşterilere hatırlatma fırsatlarını gör.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RepurchasePage,
});

const RANGES = [180, 365, 730];

function daysLabel(days: number) {
  if (days <= 0) return "—";
  return `${days.toFixed(days < 10 ? 1 : 0)} gün`;
}

function RepurchasePage() {
  const { storeId } = Route.useParams();
  const [days, setDays] = useState(365);
  const { data, isLoading } = useQuery(repurchaseQuery(storeId, days));
  const lines = data ?? [];

  const summary = useMemo(() => repurchaseSummary(lines), [lines]);
  const products = useMemo(() => productRepurchase(lines), [lines]);
  const bands = useMemo(() => intervalBands(lines), [lines]);
  const reminders = useMemo(() => reminderCandidates(lines), [lines]);
  const maxBand = Math.max(1, ...bands.map((band) => band.count));

  const exportReminders = () => {
    downloadCsv(
      `hatirlatma-${storeId}.csv`,
      reminders.slice(0, 500).map((item) => ({
        urun: item.productTitle,
        musteri: item.customerKey,
        son_alim: item.lastPurchaseAt.slice(0, 10),
        gecen_gun: item.daysSincePurchase,
        beklenen_aralik: item.expectedIntervalDays,
        gecikme: item.overdueDays,
      })),
    );
  };

  return (
    <AppShell
      storeId={storeId}
      title="Tekrar Satın Alma"
      description="Ürünlerin tekrar alım oranını, satın alma sıklığını ve hatırlatma fırsatlarını analiz et."
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((range) => (
            <Button
              key={range}
              size="sm"
              variant={days === range ? "default" : "outline"}
              onClick={() => setDays(range)}
            >
              {range} gün
            </Button>
          ))}
          {reminders.length > 0 ? (
            <Button size="sm" variant="outline" className="ml-auto" onClick={exportReminders}>
              Hatırlatma listesi (CSV)
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Tekrar alım verileri hesaplanıyor…</p>
        ) : lines.length === 0 ? (
          <p className="text-muted-foreground text-sm">Bu dönemde analiz edilecek sipariş kalemi yok.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label="Tekrar alım oranı"
                value={`%${summary.repurchaseRate.toFixed(1)}`}
                hint={`${formatNumber(summary.repeatCustomers)} / ${formatNumber(summary.customers)} müşteri`}
              />
              <Kpi
                label="Ort. alım aralığı"
                value={daysLabel(summary.avgIntervalDays)}
                hint={`Medyan ${daysLabel(summary.medianIntervalDays)}`}
              />
              <Kpi
                label="Tekrar alım cirosu"
                value={formatMoney(summary.repeatRevenue)}
                hint={`Toplamın %${summary.repeatRevenueShare.toFixed(1)}'i`}
              />
              <Kpi
                label="Hatırlatma adayı"
                value={formatNumber(reminders.length)}
                hint="Beklenen aralığı aşan müşteri-ürün çifti"
              />
            </div>

            <section className="space-y-3 rounded-xl border p-5">
              <h3 className="font-display flex items-center gap-2 text-lg">
                <RefreshCcw className="size-4 text-primary" /> Tekrar alım aralığı dağılımı
              </h3>
              {bands.map((band) => (
                <div key={band.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{band.label}</span>
                    <span className="text-muted-foreground">
                      {formatNumber(band.count)} tekrar · %{band.share.toFixed(1)}
                    </span>
                  </div>
                  <div className="bg-muted h-3 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${Math.round((band.count / maxBand) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <h3 className="font-display flex items-center gap-2 text-lg">
                <Repeat className="size-4 text-primary" /> Ürün bazlı tekrar alım
              </h3>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="p-3">Ürün</th>
                      <th className="p-3 text-right">Alıcı</th>
                      <th className="p-3 text-right">Tekrar alan</th>
                      <th className="p-3 text-right">Tekrar oranı</th>
                      <th className="p-3 text-right">Sipariş/alıcı</th>
                      <th className="p-3 text-right">Ort. aralık</th>
                      <th className="p-3 text-right">Ciro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.slice(0, 40).map((row) => (
                      <tr key={row.productId} className="border-t">
                        <td className="p-3 font-medium">{row.productTitle}</td>
                        <td className="p-3 text-right">{formatNumber(row.buyers)}</td>
                        <td className="p-3 text-right">{formatNumber(row.repeatBuyers)}</td>
                        <td className="p-3 text-right">
                          {row.repurchaseRate >= 25 ? (
                            <Badge>%{row.repurchaseRate.toFixed(0)}</Badge>
                          ) : (
                            <span>%{row.repurchaseRate.toFixed(0)}</span>
                          )}
                        </td>
                        <td className="p-3 text-right">{row.ordersPerBuyer.toFixed(2)}</td>
                        <td className="p-3 text-right">{daysLabel(row.avgIntervalDays)}</td>
                        <td className="p-3 text-right">{formatMoney(row.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-display flex items-center gap-2 text-lg">
                <BellRing className="size-4 text-primary" /> Hatırlatma fırsatları
              </h3>
              {reminders.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Beklenen alım aralığını aşan müşteri yok.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-3">Ürün</th>
                        <th className="p-3">Müşteri</th>
                        <th className="p-3">Son alım</th>
                        <th className="p-3 text-right">Beklenen aralık</th>
                        <th className="p-3 text-right">Gecikme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reminders.slice(0, 25).map((item) => (
                        <tr key={`${item.productId}-${item.customerKey}`} className="border-t">
                          <td className="p-3 font-medium">{item.productTitle}</td>
                          <td className="p-3 font-mono text-xs">{item.customerKey.slice(2, 14)}…</td>
                          <td className="p-3">{item.lastPurchaseAt.slice(0, 10)}</td>
                          <td className="p-3 text-right">{item.expectedIntervalDays} gün</td>
                          <td className="p-3 text-right">
                            <span className={item.overdueDays > 30 ? "text-destructive font-medium" : undefined}>
                              +{item.overdueDays} gün
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
      <p className="font-display mt-1 text-2xl">{value}</p>
      {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
