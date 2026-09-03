import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartNoAxesColumn,
  Filter,
  PackageSearch,
  Search,
  ShoppingBag,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatNumber, formatPercent } from "@/lib/mefti";
import { statisticsQuery, type StatsRow } from "@/lib/statistics-queries";
import { storeQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/statistics")({
  head: () => ({
    meta: [
      { title: "İstatistikler — Mefticaret" },
      {
        name: "description",
        content:
          "Trafik, satış, ürün, dönüşüm, müşteri ve arama raporları tek panelde. Ek entegrasyon gerekmez.",
      },
      { property: "og:title", content: "İstatistikler — Mefticaret" },
      {
        property: "og:description",
        content: "Veriye dayalı kararlar için mağazanızın tüm raporları tek ekranda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StatisticsPage,
});

const TABS = [
  { id: "traffic", label: "Analytics", icon: ChartNoAxesColumn },
  { id: "sales", label: "Satış raporları", icon: ShoppingBag },
  { id: "products", label: "Ürün analizi", icon: PackageSearch },
  { id: "conversion", label: "Dönüşüm raporları", icon: Filter },
  { id: "customers", label: "Müşteri istatistikleri", icon: Users },
  { id: "search", label: "Arama raporu", icon: Search },
] as const;

const PERIODS = [
  { days: 1, label: "Bugün" },
  { days: 7, label: "7 gün" },
  { days: 30, label: "30 gün" },
  { days: 90, label: "90 gün" },
  { days: 365, label: "1 yıl" },
];

function StatisticsPage() {
  const { storeId } = Route.useParams();
  const [days, setDays] = useState(30);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("traffic");
  const { data: store } = useQuery(storeQuery(storeId));
  const { data, isLoading } = useQuery(statisticsQuery(storeId, days));
  const currency = store?.currency ?? "TRY";

  return (
    <AppShell
      storeId={storeId}
      title="İstatistikler"
      description="Veriye dayalı kararlar, tek panelden. Trafik, satış, ürün, dönüşüm, müşteri ve arama raporları."
      actions={
        <div className="flex flex-wrap gap-1 rounded-full border border-border bg-card p-1">
          {PERIODS.map((period) => (
            <button
              key={period.days}
              type="button"
              onClick={() => setDays(period.days)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                days === period.days
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      }
    >
      <nav className="flex flex-wrap gap-2" aria-label="Rapor sekmeleri">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
              tab === item.id
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <item.icon className="size-4" />
            {item.label}
          </button>
        ))}
      </nav>

      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          {tab === "traffic" ? (
            <section className="space-y-6">
              <Intro
                title="Ek entegrasyon yok, veriler hazır"
                text="Google Analytics kurmadan tekil ziyaretçi, oturum, sayfa görüntüleme, hemen çıkma oranı, trafik kaynakları ve en çok ziyaret edilen sayfalar."
                chips={["Anlık ziyaretçi", "Trafik kaynakları", "Sayfa performansı"]}
              />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Kpi label="Tekil ziyaretçi" value={formatNumber(data.traffic.visitors)} delta={data.traffic.visitorsDelta} />
                <Kpi label="Toplam oturum" value={formatNumber(data.traffic.sessions)} delta={data.traffic.sessionsDelta} />
                <Kpi label="Sayfa görüntüleme" value={formatNumber(data.traffic.pageViews)} delta={data.traffic.pageViewsDelta} />
                <Kpi label="Sayfa / ziyaret" value={data.traffic.pagesPerSession.toFixed(2)} />
                <Kpi label="Hemen çıkma" value={formatPercent(data.traffic.bounceRate)} delta={data.traffic.bounceDelta} invert />
                <Kpi label="Ort. süre" value={`${Math.round(data.traffic.avgDuration)} sn`} />
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <BarList title="Trafik kaynakları" rows={data.traffic.sources.slice(0, 8)} />
                <BarList title="Sayfa performansı" rows={data.traffic.topPages} />
                <BarList title="Cihaz dağılımı" rows={data.traffic.devices.slice(0, 6)} />
              </div>
              <Trend title="Ziyaretçi trendi" series={data.series} pick={(row) => row.visitors} />
            </section>
          ) : null}

          {tab === "sales" ? (
            <section className="space-y-6">
              <Intro
                title="9 kritik KPI, tek ekranda"
                text="Toplam ciro, sipariş sayısı, ortalama sepet, iptal oranı, satılan ürün, yeni müşteri, kupon kullanımı, kargo geliri ve toplam indirim — önceki dönem karşılaştırmalı."
                chips={["Dönem karşılaştırma", "Satış trendi", "Sipariş durumu"]}
              />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Kpi label="Toplam ciro" value={formatMoney(data.sales.revenue, currency)} delta={data.sales.revenueDelta} />
                <Kpi label="Sipariş sayısı" value={formatNumber(data.sales.orders)} delta={data.sales.ordersDelta} />
                <Kpi label="Ort. sepet" value={formatMoney(data.sales.aov, currency)} delta={data.sales.aovDelta} />
                <Kpi label="İptal oranı" value={formatPercent(data.sales.cancelRate)} invert />
                <Kpi label="Satılan ürün" value={formatNumber(data.sales.soldUnits)} delta={data.sales.soldUnitsDelta} />
                <Kpi label="Yeni müşteri" value={formatNumber(data.sales.newCustomers)} delta={data.sales.newCustomersDelta} />
                <Kpi label="Kupon kullanımı" value={formatNumber(data.sales.couponUsage)} />
                <Kpi label="Kargo geliri" value={formatMoney(data.sales.shippingRevenue, currency)} delta={data.sales.shippingRevenueDelta} />
                <Kpi label="Toplam indirim" value={formatMoney(data.sales.totalDiscount, currency)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Trend title="Satış trendi" series={data.series} pick={(row) => row.revenue} money currency={currency} />
                </div>
                <BarList title="Sipariş durumu dağılımı" rows={data.sales.statusBreakdown.slice(0, 8)} />
              </div>
            </section>
          ) : null}

          {tab === "products" ? (
            <section className="space-y-6">
              <Intro
                title="Stok, fiyat, kategori — her açıdan analiz"
                text="Aktif ürün, satılan adet, stoksuz ürün, düşük stok uyarısı, fiyat dağılımı ve en çok satan ürünler ile katalog sağlığını tek bakışta görün."
                chips={["6 KPI kartı", "Fiyat dağılımı", "Top satanlar"]}
              />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Kpi label="Aktif ürün" value={formatNumber(data.productStats.activeProducts)} />
                <Kpi label="Satılan adet" value={formatNumber(data.productStats.soldUnits)} delta={data.productStats.soldUnitsDelta} />
                <Kpi label="Farklı ürün satışı" value={formatNumber(data.productStats.distinctSold)} />
                <Kpi label="Stoksuz ürün" value={formatNumber(data.productStats.outOfStock)} invert />
                <Kpi label="Düşük stok (≤5)" value={formatNumber(data.productStats.lowStock)} invert />
                <Kpi label="Ort. satış fiyatı" value={formatMoney(data.productStats.avgSalePrice, currency)} />
              </div>
              <div className="surface-card p-6">
                <h3 className="font-display text-sm font-semibold">Stok sağlığı</h3>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">{formatNumber(data.productStats.healthy)} Sağlıklı</Badge>
                  <Badge variant="secondary">{formatNumber(data.productStats.lowStock)} Kritik</Badge>
                  <Badge variant="secondary">{formatNumber(data.productStats.outOfStock)} Tükendi</Badge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Toplam {formatNumber(data.productStats.totalSku)} SKU ·{" "}
                  {formatNumber(data.productStats.totalStock)} adet stok
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <BarList title="Fiyat dağılımı" rows={data.productStats.priceBuckets} />
                <BarList
                  title="En çok satan ürünler"
                  rows={data.productStats.topProducts.map((product) => ({
                    key: product.title,
                    count: product.quantity,
                  }))}
                />
                <BarList
                  title="En yüksek stok"
                  rows={data.productStats.stockLeaders.map((row) => ({ key: row.title, count: row.stock }))}
                />
              </div>
            </section>
          ) : null}

          {tab === "conversion" ? (
            <section className="space-y-6">
              <Intro
                title="Ziyaretçiden müşteriye, her adımı izleyin"
                text="Dönüşüm hunisi ile ziyaretçiden satın almaya kadar her adımdaki kayıpları görün; hangi adımda kaç kişi düşüyor?"
                chips={["Dönüşüm hunisi", "Adım kayıpları", "Trend grafiği"]}
              />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Tekil ziyaretçi" value={formatNumber(data.conversion.visitors)} delta={data.conversion.visitorsDelta} />
                <Kpi label="Dönüşüm oranı" value={formatPercent(data.conversion.conversionRate)} delta={data.conversion.conversionDelta} />
                <Kpi label="Sepete ekleme" value={formatNumber(data.conversion.addToCart)} />
                <Kpi label="Hemen çıkma" value={formatPercent(data.conversion.bounceRate)} invert />
              </div>
              <div className="surface-card p-6">
                <h3 className="font-display text-sm font-semibold">Dönüşüm hunisi</h3>
                <ul className="mt-4 space-y-4">
                  {data.conversion.funnel.map((step, index) => {
                    const top = data.conversion.funnel[0]?.value ?? 0;
                    const previous = index > 0 ? (data.conversion.funnel[index - 1]?.value ?? 0) : null;
                    const dropRate = previous && previous > 0 ? ((previous - step.value) / previous) * 100 : 0;
                    return (
                      <li key={step.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{step.label}</span>
                          <span className="text-muted-foreground">
                            {formatNumber(step.value)} ({top > 0 ? formatPercent((step.value / top) * 100) : "%0"})
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full brand-gradient"
                            style={{ width: `${top > 0 ? Math.max(2, (step.value / top) * 100) : 0}%` }}
                          />
                        </div>
                        {previous !== null ? (
                          <p className="text-xs text-muted-foreground">
                            ↓ {formatNumber(Math.max(0, previous - step.value))} düşüş ({formatPercent(dropRate)})
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <Trend title="Sipariş trendi" series={data.series} pick={(row) => row.orders} />
            </section>
          ) : null}

          {tab === "customers" ? (
            <section className="space-y-6">
              <Intro
                title="Müşterilerinizi tanıyın"
                text="Toplam müşteri, yeni kayıt trendi, tekrar satın alma oranı, müşteri tipi dağılımı, ortalama müşteri değeri (LTV) ve en değerli müşteriler."
                chips={["Müşteri tipi dağılımı", "Kayıt trendi", "LTV"]}
              />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Kpi label="Toplam müşteri" value={formatNumber(data.customerStats.total)} />
                <Kpi label="Yeni müşteri" value={formatNumber(data.customerStats.newCustomers)} delta={data.customerStats.newCustomersDelta} />
                <Kpi label="Sipariş veren" value={formatNumber(data.customerStats.ordering)} delta={data.customerStats.orderingDelta} />
                <Kpi label="Tekrar satın alma" value={formatPercent(data.customerStats.repeatRate)} />
                <Kpi label="Misafir sipariş" value={formatNumber(data.customerStats.guestOrders)} />
                <Kpi label="Ort. müşteri değeri" value={formatMoney(data.customerStats.avgLtv, currency)} />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="surface-card p-6">
                  <h3 className="font-display text-sm font-semibold">Müşteri tipi dağılımı (ciro)</h3>
                  <ul className="mt-4 space-y-3 text-sm">
                    {(() => {
                      const total = data.customerStats.mix.reduce((sum, row) => sum + row.count, 0);
                      return data.customerStats.mix.map((row) => (
                        <li key={row.key} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span>{row.key}</span>
                            <span className="text-muted-foreground">
                              {total > 0 ? formatPercent((row.count / total) * 100) : "%0"} ·{" "}
                              {formatMoney(row.count, currency)}
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${total > 0 ? (row.count / total) * 100 : 0}%` }}
                            />
                          </div>
                        </li>
                      ));
                    })()}
                  </ul>
                </div>
                <div className="surface-card p-6">
                  <h3 className="font-display text-sm font-semibold">En değerli müşteriler</h3>
                  <ul className="mt-4 divide-y divide-border text-sm">
                    {data.customerStats.topCustomers.length === 0 ? (
                      <li className="py-3 text-muted-foreground">Henüz müşteri verisi yok.</li>
                    ) : (
                      data.customerStats.topCustomers.map((customer, index) => (
                        <li key={customer.id} className="flex items-center justify-between gap-3 py-3">
                          <span className="text-muted-foreground">#{index + 1}</span>
                          <span className="flex-1 truncate">{customer.orders} sipariş</span>
                          <span className="font-medium">{formatMoney(customer.spent, currency)}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </section>
          ) : null}

          {tab === "search" ? (
            <section className="space-y-6">
              <Intro
                title="Müşteriler ne arıyor, ne bulamıyor?"
                text="Mağazanızda yapılan her aramayı izleyin: en çok aranan terimler, sonuçsuz aramalar (ürün ekleme fırsatı!), tıklama oranı ve saatlik dağılım."
                chips={["Sonuçsuz aramalar", "Günlük trend", "Saatlik dağılım"]}
              />
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi label="Toplam arama" value={formatNumber(data.searchStats.total)} />
                <Kpi label="Benzersiz terim" value={formatNumber(data.searchStats.uniqueTerms)} />
                <Kpi
                  label="Sonuçsuz arama"
                  value={formatNumber(data.searchStats.noResult)}
                  hint={`Oran: ${formatPercent(data.searchStats.noResultRate)}`}
                  invert
                />
                <Kpi
                  label="Ürüne tıklama"
                  value={formatNumber(data.searchStats.clicks)}
                  hint={`CTR: ${formatPercent(data.searchStats.ctr)}`}
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="surface-card p-6">
                  <h3 className="font-display text-sm font-semibold">En çok aranan terimler (Top 10)</h3>
                  <ul className="mt-4 divide-y divide-border text-sm">
                    {data.searchStats.topTerms.length === 0 ? (
                      <li className="py-3 text-muted-foreground">Bu dönemde arama kaydı yok.</li>
                    ) : (
                      data.searchStats.topTerms.map((term, index) => (
                        <li key={term.term} className="flex items-center justify-between gap-3 py-3">
                          <span className="text-muted-foreground">{index + 1}</span>
                          <span className="flex-1 truncate">{term.term}</span>
                          <span className="text-xs text-muted-foreground">{term.count} arama</span>
                          <Badge variant={term.results > 0 ? "secondary" : "destructive"}>
                            {term.results > 0 ? `${term.results} sonuç` : "sonuç yok"}
                          </Badge>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="surface-card p-6">
                  <h3 className="font-display text-sm font-semibold">
                    Sonuçsuz aramalar ({data.searchStats.noResultTerms.length})
                  </h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {data.searchStats.noResultTerms.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Harika — tüm aramalar sonuç döndürdü.</p>
                    ) : (
                      data.searchStats.noResultTerms.map((term) => (
                        <Badge key={term.term} variant="outline">
                          {term.term}
                        </Badge>
                      ))
                    )}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Bu terimler aratıldı ama sonuç bulunamadı — katalogunuza eklemek için fırsat.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Trend title="Günlük arama trendi" series={data.series} pick={(row) => row.searches} />
                <BarList title="Saatlik dağılım" rows={data.searchStats.hourly.filter((row) => row.count > 0)} />
              </div>
            </section>
          ) : null}
        </>
      )}
    </AppShell>
  );
}

function Intro({ title, text, chips }: { title: string; text: string; chips: string[] }) {
  return (
    <div className="surface-card p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{text}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <Badge key={chip} variant="secondary">
            {chip}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  delta,
  hint,
  invert,
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  invert?: boolean;
}) {
  const positive = (delta ?? 0) >= 0;
  const good = invert ? !positive : positive;
  return (
    <div className="surface-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tracking-tight">{value}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta === undefined ? null : (
          <span className={good ? "flex items-center gap-1 text-emerald-600" : "flex items-center gap-1 text-destructive"}>
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}

function BarList({ title, rows }: { title: string; rows: StatsRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="surface-card p-6">
      <h3 className="font-display text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Bu dönemde veri yok.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.key} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{row.key}</span>
                <span className="text-muted-foreground">{formatNumber(row.count)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type SeriesRow = { date: string; revenue: number; orders: number; visitors: number; searches: number };

function Trend({
  title,
  series,
  pick,
  money,
  currency = "TRY",
}: {
  title: string;
  series: SeriesRow[];
  pick: (row: SeriesRow) => number;
  money?: boolean;
  currency?: string;
}) {
  const max = Math.max(1, ...series.map(pick));
  return (
    <div className="surface-card p-6">
      <h3 className="font-display text-sm font-semibold">{title}</h3>
      <div className="mt-6 flex h-40 items-end gap-1">
        {series.map((row) => {
          const value = pick(row);
          return (
            <div
              key={row.date}
              className="flex-1 rounded-t brand-gradient"
              style={{ height: `${Math.max(3, (value / max) * 100)}%` }}
              title={`${row.date}: ${money ? formatMoney(value, currency) : formatNumber(value)}`}
            />
          );
        })}
      </div>
    </div>
  );
}
