import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Radio, ShoppingBag, Users, Wallet } from "lucide-react";
import { useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import { BarList, CHART_COLORS, Empty, KpiStrip, Panel, tooltipStyle } from "@/components/analytics/analytics-kit";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BUCKET_LABELS, BUCKETS, CHANNEL_LABELS, DEVICE_LABELS, type Bucket, type CustomersData, type FunnelData, type LiveData,
  type OrdersData, type Overview, type PeriodInput, type ProductsData, type SalesData, type Section, type SeriesPoint, type TrafficData,
} from "@/lib/analytics-v2";
import { getAnalyticsSection } from "@/lib/analytics-v2.functions";
import { formatMoney, formatNumber, ORDER_STATUS_LABELS } from "@/lib/mefti";

export function useSection<T>(storeId: string, section: Section, period: PeriodInput, bucket?: Bucket, refetchMs?: number) {
  const fn = useServerFn(getAnalyticsSection);
  return useQuery({
    queryKey: ["analytics-v2", storeId, section, period, bucket ?? null],
    queryFn: async () => (await fn({ data: { storeId, section, ...period, ...(bucket ? { bucket } : {}) } })) as { value: T; bucket: Bucket },
    staleTime: 60_000,
    ...(refetchMs ? { refetchInterval: refetchMs } : {}),
  });
}

const pct = (n: number) => `%${(n * 100).toFixed(1).replace(".", ",")}`;
const Loading = () => <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-64 w-full" /></div>;

function fmtTick(t: string, bucket: Bucket) {
  const d = new Date(`${t}:00`);
  if (bucket === "hour") return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (bucket === "month") return d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

/** Grafikte kaydırma yerine sekmeli ölçek seçimi. */
function BucketTabs({ value, onChange }: { value: Bucket; onChange: (b: Bucket) => void }) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as Bucket)}>
      <TabsList className="h-9">
        {BUCKETS.map((b) => <TabsTrigger key={b} value={b} className="px-2 text-xs">{BUCKET_LABELS[b]}</TabsTrigger>)}
      </TabsList>
    </Tabs>
  );
}

export function LiveBadge({ storeId }: { storeId: string }) {
  const q = useSection<LiveData>(storeId, "live", { period: "today" }, undefined, 30_000);
  const n = q.data?.value.active_visitors ?? 0;
  return (
    <Link to="/store/$storeId/live" params={{ storeId }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm">
      <span className="relative flex size-2.5"><span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive opacity-60" /><span className="relative inline-flex size-2.5 rounded-full bg-destructive" /></span>
      Şu an <strong className="tabular-nums">{formatNumber(n)}</strong> kişi sitede
    </Link>
  );
}

export function OverviewSection({ storeId, period, currency }: { storeId: string; period: PeriodInput; currency: string }) {
  const ov = useSection<Overview>(storeId, "overview", period);
  const [bucket, setBucket] = useState<Bucket | undefined>();
  const series = useSection<SeriesPoint[]>(storeId, "series", period, bucket);
  if (ov.isLoading || !ov.data) return <Loading />;
  const { current: c, previous: p } = ov.data.value;
  const b = series.data?.bucket ?? "day";
  const points = series.data?.value ?? [];
  return (
    <div className="space-y-4">
      <KpiStrip items={[
        { label: "Toplam Satış", value: formatMoney(c.revenue, currency), cur: c.revenue, prev: p.revenue, icon: <Wallet className="size-3.5" /> },
        { label: "Sipariş Sayısı", value: formatNumber(c.orders), cur: c.orders, prev: p.orders, icon: <ShoppingBag className="size-3.5" /> },
        { label: "Ortalama Sipariş", value: formatMoney(c.aov, currency), cur: c.aov, prev: p.aov },
        { label: "Ziyaretçi", value: formatNumber(c.visitors), cur: c.visitors, prev: p.visitors, icon: <Users className="size-3.5" /> },
      ]} />
      <Panel title="Satış ve ziyaretçi" action={<BucketTabs value={b} onChange={setBucket} />}>
        {series.isLoading ? <Skeleton className="h-64" /> : (
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={points} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--brand)" stopOpacity={0.3} /><stop offset="100%" stopColor="var(--brand)" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="t" tickFormatter={(t) => fmtTick(t, b)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={24} />
                <YAxis yAxisId="l" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={48} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={32} />
                <Tooltip {...tooltipStyle} labelFormatter={(t) => fmtTick(String(t), b)}
                  formatter={(v: number, n: string) => (n === "Satış" ? formatMoney(v, currency) : formatNumber(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area yAxisId="l" type="monotone" dataKey="revenue" name="Satış" stroke="var(--brand)" fill="url(#rev)" strokeWidth={2} />
                <Area yAxisId="r" type="monotone" dataKey="visitors" name="Ziyaretçi" stroke="var(--chart-2)" fill="transparent" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Sipariş sayısı">
          <div className="h-52"><ResponsiveContainer>
            <BarChart data={points}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="t" tickFormatter={(t) => fmtTick(t, b)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={24} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={32} />
              <Tooltip {...tooltipStyle} labelFormatter={(t) => fmtTick(String(t), b)} />
              <Bar dataKey="orders" name="Sipariş" fill="var(--brand)" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer></div>
        </Panel>
        <Panel title={`Ziyaretçi ve dönüşüm (${pct(c.conversion_rate)})`}>
          <div className="h-52"><ResponsiveContainer>
            <LineChart data={points}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="t" tickFormatter={(t) => fmtTick(t, b)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={24} />
              <YAxis yAxisId="l" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={32} />
              <YAxis yAxisId="r" orientation="right" tickFormatter={(v) => pct(v)} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={44} />
              <Tooltip {...tooltipStyle} labelFormatter={(t) => fmtTick(String(t), b)} formatter={(v: number, n: string) => (n === "Dönüşüm" ? pct(v) : formatNumber(v))} />
              <Line yAxisId="l" dataKey="sessions" name="Oturum" stroke="var(--chart-2)" dot={false} strokeWidth={2} />
              <Line yAxisId="r" dataKey="conversion_rate" name="Dönüşüm" stroke="var(--brand)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer></div>
        </Panel>
      </div>
    </div>
  );
}

const DOW = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const METHOD_LABELS: Record<string, string> = { card: "Kredi kartı", credit_card: "Kredi kartı", bank_transfer: "Havale/EFT", cod: "Kapıda ödeme", qnbpay: "QNBpay", store_credit: "Mağaza kredisi" };

export function SalesSection({ storeId, period, currency }: { storeId: string; period: PeriodInput; currency: string }) {
  const q = useSection<SalesData>(storeId, "sales", period);
  const ov = useSection<Overview>(storeId, "overview", period);
  if (q.isLoading || !q.data) return <Loading />;
  const s = q.data.value;
  const m = (n: number) => formatMoney(n, currency);
  const heat = new Map(s.heatmap.map((h) => [`${h.dow}-${h.hour}`, h.orders]));
  const maxHeat = Math.max(1, ...s.heatmap.map((h) => h.orders));
  const rows: [string, number, boolean?][] = [
    ["Brüt satış (ürünler)", s.breakdown.gross], ["İndirimler", -s.breakdown.discount], ["Kargo", s.breakdown.shipping],
    ["Vergi (KDV)", s.breakdown.tax], ["Toplam satış", s.breakdown.total, true], ["İadeler", -s.refunds], ["Net satış", s.breakdown.total - s.refunds, true],
  ];
  const cur = ov.data?.value.current; const prev = ov.data?.value.previous;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Satış dökümü">
        <ul className="divide-y divide-border text-sm">
          {rows.map(([l, v, strong]) => (
            <li key={l} className={`flex justify-between py-2 ${strong ? "font-semibold" : ""}`}><span>{l}</span><span className="tabular-nums">{m(v)}</span></li>
          ))}
        </ul>
      </Panel>
      <Panel title="Ödeme yöntemleri">
        {s.payment_methods.length === 0 ? <Empty /> : (
          <div className="h-56"><ResponsiveContainer>
            <PieChart>
              <Pie data={s.payment_methods.map((p) => ({ name: METHOD_LABELS[p.method] ?? p.method, value: Number(p.amount) }))} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {s.payment_methods.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v: number) => m(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer></div>
        )}
      </Panel>
      {cur && prev ? (
        <Panel title="Önceki dönemle karşılaştırma">
          <ul className="divide-y divide-border text-sm">
            {([["Satış", cur.revenue, prev.revenue, true], ["Sipariş", cur.orders, prev.orders, false], ["Ortalama sipariş", cur.aov, prev.aov, true]] as const).map(([l, a, b2, money]) => (
              <li key={l} className="flex justify-between gap-2 py-2"><span>{l}</span>
                <span className="tabular-nums">{money ? m(a) : formatNumber(a)} <span className="text-muted-foreground">/ {money ? m(b2) : formatNumber(b2)}</span></span></li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <Panel title="En çok satış yapılan saatler">
        {s.heatmap.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[520px] gap-0.5" style={{ gridTemplateColumns: "32px repeat(24, 1fr)" }}>
              <span />
              {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center text-[9px] text-muted-foreground">{h % 3 === 0 ? h : ""}</span>)}
              {DOW.map((d, di) => (
                <FragmentRow key={d} label={d}>
                  {Array.from({ length: 24 }, (_, h) => {
                    const v = heat.get(`${di + 1}-${h}`) ?? 0;
                    return <span key={h} title={`${d} ${h}:00 · ${v} sipariş`} className="aspect-square rounded-sm bg-brand" style={{ opacity: v ? 0.15 + (v / maxHeat) * 0.85 : 0.05 }} />;
                  })}
                </FragmentRow>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
function FragmentRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <><span className="text-[10px] leading-4 text-muted-foreground">{label}</span>{children}</>;
}

const STATUS_GROUPS: { key: string; label: string; statuses: string[] }[] = [
  { key: "pending", label: "Beklemede", statuses: ["pending", "awaiting_payment"] },
  { key: "confirmed", label: "Onaylandı", statuses: ["paid", "processing", "packed"] },
  { key: "shipped", label: "Kargoda", statuses: ["shipped"] },
  { key: "delivered", label: "Teslim", statuses: ["delivered"] },
  { key: "cancelled", label: "İptal", statuses: ["cancelled"] },
  { key: "returned", label: "İade", statuses: ["returned", "refunded"] },
];

export function OrdersSection({ storeId, period }: { storeId: string; period: PeriodInput }) {
  const q = useSection<OrdersData>(storeId, "orders", period);
  if (q.isLoading || !q.data) return <Loading />;
  const o = q.data.value;
  const by = new Map(o.statuses.map((s) => [s.status, s.count]));
  const groups = STATUS_GROUPS.map((g) => ({ name: g.label, value: g.statuses.reduce((a, s) => a + (by.get(s) ?? 0), 0) }));
  const hours = o.avg_fulfillment_hours;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Panel title={`Sipariş durumu (${formatNumber(o.total)} sipariş)`}>
        {o.total === 0 ? <Empty /> : (
          <div className="h-60"><ResponsiveContainer>
            <BarChart data={groups} layout="vertical" margin={{ left: 8 }}>
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12, fill: "var(--foreground)" }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="value" name="Sipariş" radius={[0, 4, 4, 0]}>{groups.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer></div>
        )}
      </Panel>
      <div className="grid gap-4">
        <Panel title="Ortalama kargoya verme süresi">
          <p className="text-3xl font-semibold tabular-nums">{hours == null ? "—" : hours >= 48 ? `${(hours / 24).toFixed(1)} gün` : `${hours} saat`}</p>
          <p className="text-xs text-muted-foreground">Sipariş anından ilk kargo çıkışına kadar</p>
        </Panel>
        <Panel title="İade oranı">
          <p className="text-3xl font-semibold tabular-nums">{o.total ? pct(o.refunded_orders / o.total) : "—"}</p>
          <p className="text-xs text-muted-foreground">{formatNumber(o.refunded_orders)} siparişte iade yapıldı</p>
        </Panel>
      </div>
    </div>
  );
}

export function ProductsSection({ storeId, period, currency }: { storeId: string; period: PeriodInput; currency: string }) {
  const q = useSection<ProductsData>(storeId, "products", period);
  if (q.isLoading || !q.data) return <Loading />;
  const p = q.data.value;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="En çok satan ürünler" className="lg:col-span-2">
        {p.top.length === 0 ? <Empty /> : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="hidden h-64 lg:block"><ResponsiveContainer>
              <BarChart data={p.top.map((t) => ({ name: t.title.slice(0, 18), revenue: Number(t.revenue) }))}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={52} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => formatMoney(v, currency)} />
                <Bar dataKey="revenue" name="Ciro" fill="var(--brand)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div>
            <BarList rows={p.top.map((t) => ({ label: t.title, value: Number(t.revenue), hint: `${t.quantity} adet` }))} format={(n) => formatMoney(n, currency)} />
          </div>
        )}
      </Panel>
      <Panel title="En çok görüntülenen ürünler">
        <BarList rows={p.viewed.map((v) => ({ label: v.title, value: v.views, hint: `${v.sessions} oturum` }))} />
      </Panel>
      <Panel title="Sepete eklenip satın alınmayanlar">
        {p.abandoned.length === 0 ? <Empty /> : (
          <ul className="divide-y divide-border text-sm">
            {p.abandoned.map((a) => {
              const lost = a.carted_sessions - a.purchased_sessions;
              return (
                <li key={a.product_id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate">{a.title}</span>
                  <span className="shrink-0 text-muted-foreground">{lost}/{a.carted_sessions} sepette kaldı</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <Panel title="Stoğu tükenmek üzere" className="lg:col-span-2">
        {p.low_stock.length === 0 ? <Empty text="Stok uyarısı yok." /> : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {p.low_stock.map((l) => (
              <li key={l.variant_id}>
                <Link to="/store/$storeId/products/$productId" params={{ storeId, productId: l.product_id }} className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{l.title}{l.variant_title && l.variant_title !== "Default" ? ` · ${l.variant_title}` : ""}</span>
                  <Badge variant={l.stock <= 0 ? "destructive" : "outline"}>{l.stock <= 0 ? "Tükendi" : `${l.stock} adet`}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function CustomersSection({ storeId, period, currency }: { storeId: string; period: PeriodInput; currency: string }) {
  const q = useSection<CustomersData>(storeId, "customers", period);
  if (q.isLoading || !q.data) return <Loading />;
  const c = q.data.value;
  const split = [{ name: "Yeni", value: c.new }, { name: "Geri dönen", value: c.returning }, { name: "Misafir sipariş", value: c.guest_orders }];
  const total = split.reduce((a, b) => a + b.value, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Yeni ve geri dönen müşteriler">
        {total === 0 ? <Empty /> : (
          <div className="h-56"><ResponsiveContainer>
            <PieChart>
              <Pie data={split} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {split.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
              </Pie>
              <Tooltip {...tooltipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer></div>
        )}
      </Panel>
      <Panel title="Müşteri yaşam değeri">
        <p className="text-3xl font-semibold tabular-nums">{formatMoney(c.ltv, currency)}</p>
        <p className="text-xs text-muted-foreground">Sipariş vermiş müşterinin ortalama toplam harcaması · ortalama {String(c.avg_orders_per_customer).replace(".", ",")} sipariş</p>
      </Panel>
      <Panel title="En çok harcayan 10 müşteri">
        {c.top.length === 0 ? <Empty /> : (
          <ul className="divide-y divide-border text-sm">
            {c.top.map((t, i) => (
              <li key={t.customer_id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate"><span className="mr-2 text-muted-foreground">{i + 1}.</span>{t.name || t.email || "Müşteri"}</span>
                <span className="shrink-0 tabular-nums">{formatMoney(Number(t.spent), currency)} <span className="text-muted-foreground">· {t.orders}</span></span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="İllere göre siparişler">
        <BarList rows={c.provinces.slice(0, 15).map((p) => ({ label: p.province, value: p.orders, hint: formatMoney(Number(p.revenue), currency) }))} />
      </Panel>
    </div>
  );
}

export function TrafficSection({ storeId, period, currency }: { storeId: string; period: PeriodInput; currency: string }) {
  const q = useSection<TrafficData>(storeId, "traffic", period);
  if (q.isLoading || !q.data) return <Loading />;
  const t = q.data.value;
  const channels = [...t.channels].sort((a, b) => b.sessions - a.sessions);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={`Trafik kanalları (${formatNumber(t.sessions)} oturum)`}>
        <BarList rows={channels.map((c) => ({ label: CHANNEL_LABELS[c.channel] ?? c.channel, value: c.sessions, hint: `${c.purchases} satış` }))} />
      </Panel>
      <Panel title="Cihaz tipi">
        {t.devices.length === 0 ? <Empty /> : (
          <div className="h-56"><ResponsiveContainer>
            <PieChart>
              <Pie data={t.devices.map((d) => ({ name: DEVICE_LABELS[d.device] ?? d.device, value: d.sessions }))} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {t.devices.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip {...tooltipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer></div>
        )}
      </Panel>
      <Panel title="Ülkeler"><BarList rows={t.countries.map((c) => ({ label: c.country, value: c.sessions }))} /></Panel>
      <Panel title="Şehirler"><BarList rows={t.cities.map((c) => ({ label: c.city, value: c.sessions }))} /></Panel>
      <Panel title="Yönlendiren siteler"><BarList rows={t.referrers.map((r) => ({ label: r.host, value: r.sessions }))} /></Panel>
      <Panel title="Kampanya (UTM) performansı">
        {t.campaigns.length === 0 ? <Empty text="UTM etiketli ziyaret yok." /> : (
          <ul className="divide-y divide-border text-sm">
            {t.campaigns.map((c, i) => (
              <li key={i} className="py-2">
                <div className="flex justify-between gap-2"><span className="truncate font-medium">{c.campaign}</span><span className="tabular-nums">{formatMoney(Number(c.revenue), currency)}</span></div>
                <p className="text-xs text-muted-foreground">{c.source ?? "—"} / {c.medium ?? "—"} · {c.sessions} oturum · {c.purchases} satış · dönüşüm {c.sessions ? pct(c.purchases / c.sessions) : "—"}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function FunnelSection({ storeId, period }: { storeId: string; period: PeriodInput }) {
  const q = useSection<FunnelData>(storeId, "funnel", period);
  if (q.isLoading || !q.data) return <Loading />;
  const f = q.data.value;
  const steps = [
    { label: "Ziyaretçi", value: f.visitors, icon: Users },
    { label: "Ürün görüntüleme", value: f.product_view, icon: Eye },
    { label: "Sepete ekleme", value: f.add_to_cart, icon: ShoppingBag },
    { label: "Ödemeye geçiş", value: f.checkout, icon: Wallet },
    { label: "Satın alma", value: f.purchase, icon: Radio },
  ];
  const base = Math.max(f.visitors, 1);
  return (
    <Panel title="Dönüşüm hunisi (oturum bazında)">
      {f.visitors === 0 ? <Empty /> : (
        <ol className="space-y-3">
          {steps.map((s, i) => {
            const prev = i === 0 ? s.value : steps[i - 1]!.value;
            const w = (s.value / base) * 100;
            return (
              <li key={s.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><s.icon className="size-4 text-muted-foreground" />{s.label}</span>
                  <span className="tabular-nums"><strong>{formatNumber(s.value)}</strong> <span className="text-muted-foreground">%{w.toFixed(0)}</span></span>
                </div>
                <div className="mt-1 h-8 rounded-md bg-muted"><div className="h-full rounded-md bg-brand transition-all" style={{ width: `${Math.max(w, 1)}%`, opacity: 1 - i * 0.12 }} /></div>
                {i > 0 ? <p className="mt-1 text-xs text-muted-foreground">Önceki adımdan geçiş: %{prev ? ((s.value / prev) * 100).toFixed(0) : 0}</p> : null}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
