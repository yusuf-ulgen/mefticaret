import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Boxes,
  Download,
  Globe2,
  Megaphone,
  Printer,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/app-shell";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHANNEL_LABELS, SPEND_CHANNELS, toCsv, type BiReportView } from "@/lib/bi";
import {
  addMarketingSpendFn,
  deleteMarketingSpendFn,
  fetchBusinessIntelligence,
  saveCostSettingsFn,
} from "@/lib/bi.functions";
import { formatMoney } from "@/lib/mefti";
import { RANGE_PRESETS, buildRange, type RangePreset } from "@/lib/analytics-range";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/bi")({
  head: () => ({
    meta: [
      { title: "Süper Analitik & İş Zekâsı — Mefticaret" },
      {
        name: "description",
        content:
          "Gerçekleşen net kâr, dönüşüm hunisi, kohort sadakati, canlı ziyaretçi akışı, kanal ve tedarikçi performansı ile stok tükenme tahmini tek ekranda.",
      },
      { property: "og:title", content: "Süper Analitik & İş Zekâsı — Mefticaret" },
      {
        property: "og:description",
        content: "Kârlılık, dönüşüm, canlı trafik, kanal ve stok zekâsını tek panelde yönetin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BiPage,
});

const biQuery = (storeId: string, range: { fromIso: string; toIso: string; days: number; label: string }) =>
  queryOptions({
    queryKey: ["bi-report", storeId, range.fromIso, range.toIso],
    queryFn: async (): Promise<BiReportView> =>
      (await fetchBusinessIntelligence({ data: { storeId, ...range } })) as BiReportView,
    refetchInterval: 60_000,
  });

const PIE_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function BiPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const store = useQuery(storeQuery(storeId));

  const [preset, setPreset] = useState<RangePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const range = useMemo(() => buildRange(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const report = useQuery(
    biQuery(storeId, { fromIso: range.fromIso, toIso: range.toIso, days: range.days, label: range.label }),
  );

  const data = report.data;
  const currency = data?.currency ?? store.data?.currency ?? "TRY";
  const money = (value: number) => formatMoney(value, currency);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["bi-report", storeId] });

  const saveCosts = useMutation({
    mutationFn: saveCostSettingsFn,
    onSuccess: () => {
      toast.success("Maliyet varsayımları kaydedildi");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addSpend = useMutation({
    mutationFn: addMarketingSpendFn,
    onSuccess: () => {
      toast.success("Reklam harcaması eklendi");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeSpend = useMutation({
    mutationFn: deleteMarketingSpendFn,
    onSuccess: () => {
      toast.success("Harcama silindi");
      void invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const exportCsv = () => {
    if (!data) return;
    const rows = data.daily.map((row) => ({
      Tarih: row.date,
      "Brüt satış": row.grossSales,
      "Net satış": row.netSales,
      "Net kâr": row.netProfit,
      Sipariş: row.orders,
      "Reklam harcaması": row.spend,
      "Para birimi": data.currency,
    }));
    const csv = toCsv(rows.length > 0 ? rows : [{ Tarih: "-", "Net satış": 0 }]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mefticaret-bi-${range.from}_${range.to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell title="Süper Analitik & İş Zekâsı" storeId={storeId}>
      <div className="space-y-6">
        {/* Üst bar: dönem seçimi ve dışa aktarım */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>Dönem</Label>
              <Select value={preset} onValueChange={(value) => setPreset(value as RangePreset)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_PRESETS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {preset === "custom" ? (
              <>
                <div className="space-y-1">
                  <Label>Başlangıç</Label>
                  <Input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Bitiş</Label>
                  <Input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
                </div>
              </>
            ) : null}
            <Badge variant="secondary" className="mb-1">
              {range.from} → {range.to}
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={!data}>
              <Download className="mr-2 size-4" /> Excel (CSV)
            </Button>
            <Button variant="outline" onClick={() => window.print()} disabled={!data}>
              <Printer className="mr-2 size-4" /> PDF
            </Button>
          </div>
        </div>

        {report.isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : (
          <>
            {/* Canlı şerit */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-5">
              <LiveStat label="Şu an online" value={String(data.live.activeUsers)} icon={<Activity className="size-4" />} />
              <LiveStat label="Aktif sepet" value={String(data.live.activeCarts)} />
              <LiveStat label="Sepetlerdeki tutar" value={money(data.live.activeCartValue)} />
              <LiveStat label="Son 15 dk ciro" value={money(data.live.liveRevenue)} />
              <LiveStat label="Son 15 dk etkinlik" value={String(data.live.eventsLast15Min)} />
            </div>

            <Tabs defaultValue="finance">
              <TabsList className="flex w-full flex-wrap justify-start">
                <TabsTrigger value="finance">
                  <TrendingUp className="mr-1 size-4" /> Kârlılık
                </TabsTrigger>
                <TabsTrigger value="funnel">Dönüşüm & Kohort</TabsTrigger>
                <TabsTrigger value="geo">
                  <Globe2 className="mr-1 size-4" /> Canlı & Coğrafya
                </TabsTrigger>
                <TabsTrigger value="channels">
                  <Megaphone className="mr-1 size-4" /> Kanal & Tedarikçi
                </TabsTrigger>
                <TabsTrigger value="stock">
                  <Boxes className="mr-1 size-4" /> Stok Tahmini
                </TabsTrigger>
              </TabsList>

              {/* 1. Finans & kârlılık */}
              <TabsContent value="finance" className="space-y-4 pt-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <Stat label="Brüt satış" value={money(data.profit.grossSales)} />
                  <Stat label="Net satış" value={money(data.profit.netSales)} />
                  <Stat
                    label="Gerçekleşen net kâr"
                    value={money(data.profit.netProfit)}
                    hint={`Marj %${data.profit.marginPercent}`}
                    positive={data.profit.netProfit >= 0}
                  />
                  <Stat label="Reklam harcaması" value={money(data.profit.adsSpend)} hint={`ROAS ${data.metrics.roas}x`} />
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Brüt satış · net satış · net kâr</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={data.daily}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip formatter={(value: number) => money(Number(value))} />
                      <Legend />
                      <Bar name="Brüt satış" dataKey="grossSales" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                      <Bar name="Net satış" dataKey="netSales" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                      <Line name="Net kâr" dataKey="netProfit" stroke="var(--color-chart-3)" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <Accordion type="single" collapsible className="rounded-xl border border-border bg-card px-4">
                  <AccordionItem value="detail">
                    <AccordionTrigger>Detaylı kâr-zarar dökümü</AccordionTrigger>
                    <AccordionContent>
                      <dl className="grid gap-2 md:grid-cols-2">
                        {[
                          ["Brüt satış", data.profit.grossSales],
                          ["İndirimler", -data.profit.discounts],
                          ["İadeler", -data.profit.refunds],
                          ["Net satış", data.profit.netSales],
                          ["Kargo geliri", data.profit.shippingRevenue],
                          ["Vergi", -data.profit.taxTotal],
                          ["Ürün maliyeti (COGS)", -data.profit.cogs],
                          ["Reklam harcaması", -data.profit.adsSpend],
                          ["Kargo maliyeti", -data.profit.shippingCost],
                          ["Paketleme", -data.profit.packagingCost],
                          ["Ödeme komisyonu", -data.profit.gatewayCommission],
                          ["Genel gider", -data.profit.overhead],
                          ["Gerçekleşen net kâr", data.profit.netProfit],
                        ].map(([label, value]) => (
                          <div key={String(label)} className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm">
                            <dt className="text-muted-foreground">{label}</dt>
                            <dd className="font-medium">{money(Number(value))}</dd>
                          </div>
                        ))}
                      </dl>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="mb-3 text-sm font-semibold">Para birimi bazlı ihracat kârlılığı</h3>
                    {data.currencyBreakdown.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Bu dönemde sipariş yok.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-left text-muted-foreground">
                          <tr>
                            <th className="py-1">Para birimi</th>
                            <th className="py-1">Sipariş</th>
                            <th className="py-1 text-right">Ciro</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.currencyBreakdown.map((row) => (
                            <tr key={row.currency} className="border-t border-border/60">
                              <td className="py-1.5 font-medium">{row.currency}</td>
                              <td className="py-1.5">{row.orders}</td>
                              <td className="py-1.5 text-right">{formatMoney(row.baseRevenue, row.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <CostSettingsCard
                    settings={data.settings}
                    saving={saveCosts.isPending}
                    onSave={(values) => saveCosts.mutate({ data: { storeId, ...values } })}
                  />
                </div>

                <SpendCard
                  currency={currency}
                  rows={data.spend}
                  adding={addSpend.isPending}
                  onAdd={(values) => addSpend.mutate({ data: { storeId, ...values } })}
                  onDelete={(id) => removeSpend.mutate({ data: { storeId, id } })}
                />
              </TabsContent>

              {/* 2. Dönüşüm & kohort */}
              <TabsContent value="funnel" className="space-y-4 pt-4">
                <div className="grid gap-3 md:grid-cols-4">
                  <Stat label="Sepet ortalaması (AOV)" value={money(data.metrics.aov)} />
                  <Stat label="Müşteri yaşam boyu değeri (LTV)" value={money(data.metrics.ltv)} />
                  <Stat label="Müşteri kazanma maliyeti (CAC)" value={money(data.metrics.cac)} />
                  <Stat label="ROAS / POAS" value={`${data.metrics.roas}x / ${data.metrics.poas}x`} />
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">5 adımlı dönüşüm hunisi</h3>
                  <div className="space-y-3">
                    {data.funnel.map((stage) => (
                      <div key={stage.key}>
                        <div className="flex items-center justify-between text-sm">
                          <span>{stage.label}</span>
                          <span className="text-muted-foreground">
                            {stage.value.toLocaleString("tr-TR")} · %{stage.share}
                            {stage.key !== "visits" ? ` · geçiş %${stage.stepRate}` : ""}
                          </span>
                        </div>
                        <Progress value={stage.share} className="mt-1" />
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Dönüşüm oranı %{data.metrics.conversionRate} · tekrar satın alma %{data.metrics.repeatRate}
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">12 aylık kohort sadakat haritası</h3>
                  {data.cohorts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Kohort oluşturmak için yeterli sipariş geçmişi yok.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-[720px] text-xs">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="p-1 text-left">Kohort</th>
                            <th className="p-1">Müşteri</th>
                            {Array.from({ length: 12 }, (_, index) => (
                              <th key={index} className="p-1">
                                {index}. ay
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.cohorts.map((row) => (
                            <tr key={row.cohort}>
                              <td className="p-1 font-medium">{row.cohort}</td>
                              <td className="p-1 text-center">{row.size}</td>
                              {row.retention.map((value, index) => (
                                <td key={index} className="p-1 text-center">
                                  <span
                                    className="inline-block w-full rounded px-1 py-0.5"
                                    style={{
                                      backgroundColor: `color-mix(in oklab, var(--color-primary) ${Math.min(100, value)}%, transparent)`,
                                      color: value > 55 ? "var(--color-primary-foreground)" : "inherit",
                                    }}
                                  >
                                    {value > 0 ? `%${value}` : "–"}
                                  </span>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* 3. Canlı & coğrafya */}
              <TabsContent value="geo" className="space-y-4 pt-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="mb-3 text-sm font-semibold">Ülke ve şehir bazlı satış</h3>
                    {data.geo.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Bu dönemde ziyaretçi verisi yok.</p>
                    ) : (
                      <div className="max-h-80 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="text-left text-muted-foreground">
                            <tr>
                              <th className="py-1">Ülke</th>
                              <th className="py-1">Şehir</th>
                              <th className="py-1">Oturum</th>
                              <th className="py-1 text-right">Ciro</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.geo.map((row) => (
                              <tr key={`${row.country}-${row.city}`} className="border-t border-border/60">
                                <td className="py-1.5">{row.country}</td>
                                <td className="py-1.5">{row.city}</td>
                                <td className="py-1.5">{row.sessions}</td>
                                <td className="py-1.5 text-right">{money(row.revenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <h3 className="mb-3 text-sm font-semibold">Cihaz dağılımı</h3>
                      {data.devices.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Veri yok.</p>
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie data={data.devices} dataKey="sessions" nameKey="label" outerRadius={80} label>
                              {data.devices.map((row, index) => (
                                <Cell key={row.device} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <ChartTooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="rounded-xl border border-border bg-card p-4">
                      <h3 className="mb-3 text-sm font-semibold">En çok girilen sayfalar</h3>
                      {data.landingPages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Veri yok.</p>
                      ) : (
                        <ul className="space-y-1 text-sm">
                          {data.landingPages.map((row) => (
                            <li key={row.path} className="flex justify-between border-b border-border/60 py-1">
                              <span className="truncate pr-2">{row.path}</span>
                              <span className="text-muted-foreground">{row.sessions}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* 4. Kanal & tedarikçi */}
              <TabsContent value="channels" className="space-y-4 pt-4">
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Trafik kanalı katkısı</h3>
                  {data.channels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Bu dönemde trafik verisi yok.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-left text-muted-foreground">
                        <tr>
                          <th className="py-1">Kanal</th>
                          <th className="py-1">Oturum</th>
                          <th className="py-1">Sipariş</th>
                          <th className="py-1">Dönüşüm</th>
                          <th className="py-1 text-right">Ciro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.channels.map((row) => (
                          <tr key={row.channel} className="border-t border-border/60">
                            <td className="py-1.5">{row.label}</td>
                            <td className="py-1.5">{row.sessions}</td>
                            <td className="py-1.5">{row.orders}</td>
                            <td className="py-1.5">%{row.conversion}</td>
                            <td className="py-1.5 text-right">{money(row.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Pazaryeri ve vitrin karşılaştırması</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.marketplaces}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip formatter={(value: number) => money(Number(value))} />
                      <Legend />
                      <Bar name="Brüt" dataKey="gross" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                      <Bar name="Net" dataKey="net" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Tedarikçi / marka performans karnesi</h3>
                  {data.vendorScorecard.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Bu dönemde satılan ürün yok.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead className="text-left text-muted-foreground">
                          <tr>
                            <th className="py-1">Tedarikçi</th>
                            <th className="py-1">Adet</th>
                            <th className="py-1">Sipariş</th>
                            <th className="py-1">İade oranı</th>
                            <th className="py-1">Ortalama hazırlık</th>
                            <th className="py-1">Marj</th>
                            <th className="py-1 text-right">Ciro</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.vendorScorecard.map((row) => (
                            <tr key={row.name} className="border-t border-border/60">
                              <td className="py-1.5">{row.name}</td>
                              <td className="py-1.5">{row.units}</td>
                              <td className="py-1.5">{row.orders}</td>
                              <td className="py-1.5">%{row.returnRate}</td>
                              <td className="py-1.5">{row.avgFulfillHours === null ? "—" : `${row.avgFulfillHours} sa`}</td>
                              <td className="py-1.5">%{row.marginPercent}</td>
                              <td className="py-1.5 text-right">{money(row.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* 5. Stok tahmini */}
              <TabsContent value="stock" className="space-y-4 pt-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <Stat label="Tahmini kayıp ciro (30 gün)" value={money(data.stockLossTotal)} />
                  <Stat
                    label="Kritik ürün (≤7 gün)"
                    value={String(data.depletion.filter((row) => row.status === "critical").length)}
                  />
                  <Stat label="Stoğu bitmiş ürün" value={String(data.depletion.filter((row) => row.status === "out").length)} />
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-sm font-semibold">Stok tükenme tahmini</h3>
                  {data.depletion.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Bu dönemde satılan ürün yok.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="text-left text-muted-foreground">
                        <tr>
                          <th className="py-1">Ürün</th>
                          <th className="py-1">Stok</th>
                          <th className="py-1">Günlük satış</th>
                          <th className="py-1">Tahmin</th>
                          <th className="py-1 text-right">Kayıp ciro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.depletion.map((row) => (
                          <tr key={row.productId} className="border-t border-border/60">
                            <td className="py-1.5">{row.title}</td>
                            <td className="py-1.5">{row.stock}</td>
                            <td className="py-1.5">{row.dailyVelocity}</td>
                            <td className="py-1.5">
                              {row.status === "out" ? (
                                <Badge variant="destructive">Stok bitti</Badge>
                              ) : row.daysLeft === null ? (
                                <Badge variant="secondary">Satış yok</Badge>
                              ) : (
                                <Badge variant={row.status === "critical" ? "destructive" : "secondary"}>
                                  {row.daysLeft} günde biter
                                </Badge>
                              )}
                            </td>
                            <td className="py-1.5 text-right">{money(row.lostRevenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  hint,
  positive,
}: {
  label: string;
  value: string;
  hint?: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${positive === false ? "text-destructive" : ""}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function LiveStat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function CostSettingsCard({
  settings,
  saving,
  onSave,
}: {
  settings: BiReportView["settings"];
  saving: boolean;
  onSave: (values: BiReportView["settings"]) => void;
}) {
  const [form, setForm] = useState(settings);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Maliyet varsayımları</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Net kâr hesabında kullanılır. Ürün maliyeti ürün kartlarındaki alış fiyatından otomatik gelir.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Ödeme komisyonu (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.paymentCommissionRate}
            onChange={(event) => setForm({ ...form, paymentCommissionRate: Number(event.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label>Sipariş başı kargo maliyeti</Label>
          <Input
            type="number"
            step="0.01"
            value={form.shippingCostPerOrder}
            onChange={(event) => setForm({ ...form, shippingCostPerOrder: Number(event.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label>Sipariş başı paketleme</Label>
          <Input
            type="number"
            step="0.01"
            value={form.packagingCostPerOrder}
            onChange={(event) => setForm({ ...form, packagingCostPerOrder: Number(event.target.value) })}
          />
        </div>
        <div className="space-y-1">
          <Label>Genel gider oranı (%)</Label>
          <Input
            type="number"
            step="0.01"
            value={form.overheadRate}
            onChange={(event) => setForm({ ...form, overheadRate: Number(event.target.value) })}
          />
        </div>
      </div>
      <Button className="mt-3" onClick={() => onSave(form)} disabled={saving}>
        Kaydet
      </Button>
    </div>
  );
}

function SpendCard({
  currency,
  rows,
  adding,
  onAdd,
  onDelete,
}: {
  currency: string;
  rows: BiReportView["spend"];
  adding: boolean;
  onAdd: (values: {
    spendDate: string;
    channel: string;
    amount: number;
    currency: string;
    impressions?: number;
    clicks?: number;
  }) => void;
  onDelete: (id: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [spendDate, setSpendDate] = useState(today);
  const [channel, setChannel] = useState<string>("meta_ads");
  const [amount, setAmount] = useState("");
  const [impressions, setImpressions] = useState("");
  const [clicks, setClicks] = useState("");

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold">Reklam ve pazarlama harcaması</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Girdiğiniz harcamalar net kâr, CAC ve ROAS hesaplarına doğrudan yansır.
      </p>
      <div className="mt-3 grid gap-3 md:grid-cols-6">
        <div className="space-y-1">
          <Label>Tarih</Label>
          <Input type="date" value={spendDate} onChange={(event) => setSpendDate(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Kanal</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEND_CHANNELS.map((item) => (
                <SelectItem key={item} value={item}>
                  {CHANNEL_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Tutar</Label>
          <Input type="number" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Gösterim</Label>
          <Input type="number" value={impressions} onChange={(event) => setImpressions(event.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Tıklama</Label>
          <Input type="number" value={clicks} onChange={(event) => setClicks(event.target.value)} />
        </div>
        <div className="flex items-end">
          <Button
            className="w-full"
            disabled={adding || !amount}
            onClick={() => {
              onAdd({
                spendDate,
                channel,
                amount: Number(amount),
                currency,
                impressions: impressions ? Number(impressions) : 0,
                clicks: clicks ? Number(clicks) : 0,
              });
              setAmount("");
              setImpressions("");
              setClicks("");
            }}
          >
            Ekle
          </Button>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="mt-4 max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1">Tarih</th>
                <th className="py-1">Kanal</th>
                <th className="py-1">Tıklama</th>
                <th className="py-1 text-right">Tutar</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60">
                  <td className="py-1.5">{row.spendDate}</td>
                  <td className="py-1.5">{CHANNEL_LABELS[row.channel] ?? row.channel}</td>
                  <td className="py-1.5">{row.clicks}</td>
                  <td className="py-1.5 text-right">{formatMoney(row.amount, row.currency)}</td>
                  <td className="py-1.5 text-right">
                    <Button variant="ghost" size="icon" onClick={() => onDelete(row.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
