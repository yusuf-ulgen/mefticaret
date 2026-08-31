import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HelpCircle, MessageSquare, Timer } from "lucide-react";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/mefti";
import { channelStats, dailyTrend, pendingQueue, responseBands, supportSummary } from "@/lib/support";
import { supportQuery } from "@/lib/support-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/support-performance")({
  head: () => ({
    meta: [
      { title: "Müşteri İletişimi Performansı — Mefticaret" },
      {
        name: "description",
        content:
          "Ürün sorularına ve değerlendirmelere yanıt süreleri, yanıtlama oranı ve bekleyen talep kuyruğu analizi.",
      },
      { property: "og:title", content: "Müşteri İletişimi Performansı — Mefticaret" },
      {
        property: "og:description",
        content: "Yanıt süresi SLA'sı, kanal bazlı yanıtlama oranı ve bekleyen müşteri talepleri tek ekranda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupportPerformancePage,
});

const RANGES = [30, 90, 180];

function hoursLabel(hours: number) {
  if (hours <= 0) return "—";
  if (hours < 24) return `${hours.toFixed(1)} sa`;
  return `${(hours / 24).toFixed(1)} gün`;
}

function SupportPerformancePage() {
  const { storeId } = Route.useParams();
  const [days, setDays] = useState(90);
  const { data, isLoading } = useQuery(supportQuery(storeId, days));

  const threads = data?.threads ?? [];
  const titleByProduct = data?.titleByProduct ?? new Map<string, string>();

  const summary = useMemo(() => supportSummary(threads), [threads]);
  const bands = useMemo(() => responseBands(threads), [threads]);
  const channels = useMemo(() => channelStats(threads), [threads]);
  const trend = useMemo(() => dailyTrend(threads), [threads]);
  const pending = useMemo(() => pendingQueue(threads, titleByProduct), [threads, titleByProduct]);
  const maxBand = Math.max(1, ...bands.map((band) => band.count));

  return (
    <AppShell
      storeId={storeId}
      title="Müşteri İletişimi Performansı"
      description="Soru ve değerlendirmelere yanıt hızını ölç, bekleyen talepleri sıraya al."
    >
      <div className="space-y-8">
        <div className="flex flex-wrap gap-2">
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
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Yanıt verileri hesaplanıyor…</p>
        ) : threads.length === 0 ? (
          <p className="text-muted-foreground text-sm">Bu dönemde müşteri sorusu veya değerlendirmesi yok.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label="Toplam talep"
                value={formatNumber(summary.total)}
                hint={`${formatNumber(summary.answered)} yanıtlandı`}
              />
              <Kpi
                label="Yanıtlama oranı"
                value={`%${summary.answerRate.toFixed(1)}`}
                hint={`${formatNumber(summary.pending)} bekliyor`}
              />
              <Kpi
                label="Ortalama yanıt"
                value={hoursLabel(summary.avgResponseHours)}
                hint={`Medyan ${hoursLabel(summary.medianResponseHours)}`}
              />
              <Kpi
                label="24 saat içinde"
                value={`%${summary.within24hRate.toFixed(1)}`}
                hint={
                  summary.oldestPendingHours > 0
                    ? `En eski bekleyen ${hoursLabel(summary.oldestPendingHours)}`
                    : "Kuyruk temiz"
                }
              />
            </div>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-xl border p-5">
                <h3 className="font-display flex items-center gap-2 text-lg">
                  <Timer className="size-4 text-primary" /> Yanıt süresi dağılımı
                </h3>
                {bands.map((band) => (
                  <div key={band.label} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{band.label}</span>
                      <span className="text-muted-foreground">
                        {formatNumber(band.count)} · %{band.share.toFixed(1)}
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
              </div>

              <div className="space-y-3 rounded-xl border p-5">
                <h3 className="font-display flex items-center gap-2 text-lg">
                  <MessageSquare className="size-4 text-primary" /> Kanal karşılaştırması
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-muted-foreground text-left">
                      <tr>
                        <th className="py-2">Kanal</th>
                        <th className="py-2 text-right">Talep</th>
                        <th className="py-2 text-right">Yanıt oranı</th>
                        <th className="py-2 text-right">Ort. süre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map((channel) => (
                        <tr key={channel.kind} className="border-t">
                          <td className="py-2 font-medium">{channel.label}</td>
                          <td className="py-2 text-right">{formatNumber(channel.total)}</td>
                          <td className="py-2 text-right">%{channel.answerRate.toFixed(1)}</td>
                          <td className="py-2 text-right">{hoursLabel(channel.avgResponseHours)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg">Günlük talep ve yanıt trendi</h3>
              <div className="h-72 rounded-xl border p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="incoming" name="Gelen" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="answered" name="Yanıtlanan" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-display flex items-center gap-2 text-lg">
                <HelpCircle className="size-4 text-primary" /> Bekleyen talepler
              </h3>
              {pending.length === 0 ? (
                <p className="text-muted-foreground text-sm">Tüm talepler yanıtlanmış. 👏</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left">
                      <tr>
                        <th className="p-3">Ürün</th>
                        <th className="p-3">Kanal</th>
                        <th className="p-3">Tarih</th>
                        <th className="p-3 text-right">Bekleme</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.slice(0, 25).map((item) => (
                        <tr key={`${item.kind}-${item.id}`} className="border-t">
                          <td className="p-3 font-medium">{item.productTitle}</td>
                          <td className="p-3">
                            <Badge variant="outline">
                              {item.kind === "question" ? "Soru" : "Değerlendirme"}
                            </Badge>
                          </td>
                          <td className="p-3">{new Date(item.createdAt).toLocaleDateString("tr-TR")}</td>
                          <td className="p-3 text-right">
                            <span className={item.waitingHours > 48 ? "text-destructive font-medium" : undefined}>
                              {hoursLabel(item.waitingHours)}
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
