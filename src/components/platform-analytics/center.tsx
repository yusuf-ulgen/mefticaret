import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Download, Filter, Info, Minus, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PERIOD_LABELS, PERIODS } from "@/lib/analytics-v2";
import {
  AGE_BUCKETS,
  allowedCharts,
  METRIC_BY_KEY,
  REPORT_DIMENSION_LABELS,
  REPORT_DIMENSIONS,
  REPORT_METRIC_LABELS,
  REPORT_METRICS,
  safeChange,
  toCsv,
  type CenterInput,
  type ReportChart,
  type ReportDimension,
  type ReportMetric,
} from "@/lib/platform-analytics";
import {
  deleteView,
  getAnalyticsCenter,
  listSavedViews,
  logAnalyticsExport,
  runAnalyticsReport,
  saveView,
} from "@/lib/platform-analytics.functions";
import type { CenterData } from "@/lib/platform-analytics.server";
import { cn } from "@/lib/utils";

type Money = Record<string, number>;
const nf = new Intl.NumberFormat("tr-TR");
const pf = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? "—" : `%${v.toFixed(d)}`);
function fm(v: number, c: string) {
  try {
    return new Intl.NumberFormat("tr-TR", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v);
  } catch {
    return `${nf.format(Math.round(v))} ${c}`;
  }
}
function moneyText(m: Money | undefined, primary: string) {
  const entries = Object.entries(m ?? {}).filter(([, v]) => v !== 0);
  if (!entries.length) return fm(0, primary);
  entries.sort((a, b) => (a[0] === primary ? -1 : b[0] === primary ? 1 : b[1] - a[1]));
  return entries.map(([c, v]) => fm(v, c)).join(" · ");
}
const SELECT = "h-9 rounded-full border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const CHART_GRID = "var(--color-border)";

function download(name: string, csv: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ------------------------------------------------------------------ */

function MetricInfo({ k }: { k: string }) {
  const m = METRIC_BY_KEY[k];
  if (!m) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={`${m.label} tanımı`} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={(e) => e.stopPropagation()}>
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs leading-relaxed">
        <p className="font-semibold text-foreground">{m.label}</p>
        <p className="mt-1 text-muted-foreground">{m.description}</p>
        <dl className="mt-2 space-y-1">
          <div><dt className="inline font-medium">Formül: </dt><dd className="inline font-mono">{m.formula}</dd></div>
          <div><dt className="inline font-medium">Kaynak: </dt><dd className="inline">{m.source}</dd></div>
          <div><dt className="inline font-medium">Tarih alanı: </dt><dd className="inline">{m.dateField} · Europe/Istanbul</dd></div>
          <div><dt className="inline font-medium">Kapsam: </dt><dd className="inline">{m.includes}</dd></div>
          <div><dt className="inline font-medium">Güncelleme: </dt><dd className="inline">{m.refresh}</dd></div>
        </dl>
      </PopoverContent>
    </Popover>
  );
}

function Change({ cur, prev, invert = false }: { cur: number | null; prev: number | null; invert?: boolean }) {
  if (prev === null) return <span className="text-[11px] text-muted-foreground">Karşılaştırma kapalı</span>;
  const ch = safeChange(cur, prev);
  if (ch === null) return <span className="text-[11px] text-muted-foreground">Karşılaştırma yok</span>;
  const good = invert ? ch < 0 : ch > 0;
  const flat = Math.abs(ch) < 0.5;
  const Icon = flat ? Minus : ch > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums", flat ? "bg-muted text-muted-foreground" : good ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
      <Icon className="size-3" aria-hidden />
      {ch > 0 ? "+" : ""}{ch.toFixed(1)}%
      <span className="sr-only">{good ? "olumlu" : "olumsuz"} değişim</span>
    </span>
  );
}

function Spark({ data, k }: { data: Record<string, number | string | null>[]; k: string }) {
  if (data.length < 2) return null;
  return (
    <div className="h-8 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}><Line type="monotone" dataKey={k} stroke="var(--color-chart-1)" strokeWidth={1.5} dot={false} isAnimationActive={false} /></LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Kpi({ label, metric, value, cur, prev, invert, spark, onOpen, note }: { label: string; metric?: string; value: string; cur?: number | null; prev?: number | null; invert?: boolean; spark?: ReactNode; onOpen?: () => void; note?: string }) {
  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => { if (onOpen && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onOpen(); } }}
      className={cn("surface-card flex min-w-0 flex-col gap-1.5 p-4 transition", onOpen && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
    >
      <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <span className="truncate">{label}</span>{metric ? <MetricInfo k={metric} /> : null}
      </div>
      <p className="truncate font-display text-xl font-semibold tabular-nums sm:text-2xl" title={value}>{value}</p>
      <div className="flex min-h-5 items-center gap-2">{cur !== undefined ? <Change cur={cur ?? null} prev={prev ?? null} invert={invert} /> : null}{note ? <span className="truncate text-[11px] text-muted-foreground">{note}</span> : null}</div>
      {spark}
    </div>
  );
}

function Panel({ title, eyebrow, children, table, action }: { title: string; eyebrow?: string; children: ReactNode; table?: { header: string[]; rows: (string | number)[][] }; action?: ReactNode }) {
  return (
    <section className="surface-card min-w-0 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {eyebrow ? <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p> : null}
          <h2 className="font-display text-base font-semibold sm:text-lg">{title}</h2>
        </div>
        {action}
      </div>
      <div className="mt-4 min-w-0">{children}</div>
      {table && table.rows.length ? (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Veri tablosunu göster</summary>
          <DataTable header={table.header} rows={table.rows} />
        </details>
      ) : null}
    </section>
  );
}

function DataTable({ header, rows }: { header: string[]; rows: (string | number)[][] }) {
  return (
    <div className="mt-2 max-h-96 overflow-auto rounded-lg border border-border">
      <table className="w-full min-w-max text-xs">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur"><tr>{header.map((h, i) => <th key={h} scope="col" className={cn("px-3 py-2 font-semibold", i ? "text-right" : "text-left")}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className={cn("px-3 py-1.5", j ? "text-right tabular-nums" : "text-left")}>{typeof c === "number" ? nf.format(Math.round(c * 100) / 100) : c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function TrendChart({ data, lines, money }: { data: Record<string, any>[]; lines: { key: string; label: string; color: string; dashed?: boolean }[]; money?: string }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
          <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
          <YAxis tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }} width={56} tickFormatter={(v: number) => nf.format(v)} />
          <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 12, fontSize: 12 }} formatter={(v: number) => (money ? fm(v, money) : nf.format(v))} />
          {lines.map((l) => <Line key={l.key} name={l.label} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} strokeDasharray={l.dashed ? "4 4" : undefined} dot={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ana bileşen                                                          */
/* ------------------------------------------------------------------ */

export function PlatformAnalyticsCenter({ onDisable }: { onDisable: () => void }) {
  const [input, setInput] = useState<CenterInput>({ period: "30d", compare: "previous" });
  const [tab, setTab] = useState("overview");
  const fetchCenter = useServerFn(getAnalyticsCenter);
  const q = useQuery({ queryKey: ["platform-analytics-center", input], queryFn: () => fetchCenter({ data: input }) as Promise<CenterData>, staleTime: 60_000 });
  const d = q.data;
  const set = (patch: Partial<CenterInput>) => setInput((c) => ({ ...c, ...patch }));
  const exportLog = useServerFn(logAnalyticsExport);

  const exportOverview = () => {
    if (!d) return;
    const csv = toCsv(["Tarih", `GMV (${d.primary})`, `Net satış (${d.primary})`, "Sipariş", `İade (${d.primary})`, "İptal", `Platform geliri (${d.primary})`, "Yeni mağaza"], d.series.map((s) => [s.date, s.gmv.toFixed(2), s.net.toFixed(2), s.orders, s.refunds.toFixed(2), s.cancelled, s.platformRevenue.toFixed(2), s.newStores]));
    download(`platform-analitik-${d.range.fromDay}_${d.range.toDay}.csv`, csv);
    void exportLog({ data: { name: "overview-series", rows: d.series.length, filters: input as Record<string, unknown> } });
  };

  const filters = d ? <Filters input={input} set={set} data={d} /> : null;

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-primary">Süper yönetici · v2</p>
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Platform Analitik Merkezi</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {d ? <>Son veri güncelleme: <time dateTime={d.fetchedAt}>{new Date(d.fetchedAt).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</time> · İstek anında hesaplanır (2 dk önbellek), gerçek zamanlı değildir.</> : "Yükleniyor…"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void q.refetch()} disabled={q.isFetching} aria-label="Yenile"><RefreshCw className={cn("size-4", q.isFetching && "animate-spin")} /></Button>
            <SavedViews input={input} onApply={setInput} />
            <Button size="sm" variant="outline" onClick={exportOverview} disabled={!d}><Download className="size-4" /> CSV</Button>
            <Button size="sm" variant="ghost" onClick={onDisable} className="text-muted-foreground">Eski ekrana dön</Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="pac-period">Tarih aralığı</label>
          <select id="pac-period" className={SELECT} value={input.period} onChange={(e) => set({ period: e.target.value as CenterInput["period"] })}>
            {PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
          </select>
          {input.period === "custom" ? (
            <>
              <Input type="date" aria-label="Başlangıç" className="h-9 w-auto rounded-full" value={input.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} />
              <Input type="date" aria-label="Bitiş" className="h-9 w-auto rounded-full" value={input.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} />
            </>
          ) : null}
          <label className="sr-only" htmlFor="pac-compare">Karşılaştırma</label>
          <select id="pac-compare" className={SELECT} value={input.compare} onChange={(e) => set({ compare: e.target.value as CenterInput["compare"] })}>
            <option value="previous">Önceki dönemle</option>
            <option value="yoy">Geçen yılın aynı dönemiyle</option>
            <option value="none">Karşılaştırma yok</option>
          </select>
          <div className="hidden flex-wrap gap-2 lg:flex">{filters}</div>
          <Sheet>
            <SheetTrigger asChild><Button size="sm" variant="outline" className="lg:hidden"><Filter className="size-4" /> Filtreler</Button></SheetTrigger>
            <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
              <SheetHeader><SheetTitle>Filtreler</SheetTitle></SheetHeader>
              <div className="mt-4 grid gap-3 [&_select]:w-full">{filters}</div>
            </SheetContent>
          </Sheet>
        </div>
        {d ? <CoverageNotes d={d} /> : null}
      </header>

      {q.isError ? (
        <Empty>{(q.error as Error)?.message?.includes("platform yöneticileri") ? "Bu alan yalnız süper yöneticiler içindir." : "Analitik verisi alınamadı. Yenilemeyi deneyin."}</Empty>
      ) : !d ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="surface-card h-28 animate-pulse" />)}</div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="w-max">
              <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
              <TabsTrigger value="revenue">Gelir ve Abonelikler</TabsTrigger>
              <TabsTrigger value="sellers">Satıcılar</TabsTrigger>
              <TabsTrigger value="commerce">Ticaret</TabsTrigger>
              <TabsTrigger value="usage">Ürün Kullanımı</TabsTrigger>
              <TabsTrigger value="operations">Operasyon</TabsTrigger>
              <TabsTrigger value="reports">Özel Raporlar</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="overview" className="mt-4"><Overview d={d} go={setTab} /></TabsContent>
          <TabsContent value="revenue" className="mt-4"><Revenue d={d} /></TabsContent>
          <TabsContent value="sellers" className="mt-4"><Sellers d={d} /></TabsContent>
          <TabsContent value="commerce" className="mt-4"><Commerce d={d} /></TabsContent>
          <TabsContent value="usage" className="mt-4"><Usage d={d} /></TabsContent>
          <TabsContent value="operations" className="mt-4"><Operations d={d} /></TabsContent>
          <TabsContent value="reports" className="mt-4"><ReportBuilder base={input} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function Filters({ input, set, data }: { input: CenterInput; set: (p: Partial<CenterInput>) => void; data: CenterData }) {
  const f = data.filters;
  return (
    <>
      <select aria-label="Mağaza" className={SELECT} value={input.storeId ?? ""} onChange={(e) => set({ storeId: e.target.value || undefined })} disabled={!f.stores.length}>
        <option value="">Tüm mağazalar</option>
        {f.stores.map((s: { id: string; name: string }) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select aria-label="Plan" className={SELECT} value={input.planId ?? ""} onChange={(e) => set({ planId: e.target.value || undefined })}>
        <option value="">Tüm planlar</option>
        {f.plans.map((p: { id: string; name: string }) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select aria-label="Sektör" className={SELECT} value={input.industry ?? ""} onChange={(e) => set({ industry: e.target.value || undefined })} disabled={!f.industries.length}>
        <option value="">{f.industries.length ? "Tüm sektörler" : "Sektör verisi yok"}</option>
        {f.industries.map((i: string) => <option key={i} value={i}>{i}</option>)}
      </select>
      <select aria-label="Ülke" className={SELECT} disabled title="Mağazalarda ülke alanı tutulmuyor"><option>Ülke: veri yok</option></select>
      <select aria-label="Para birimi" className={SELECT} value={input.currency ?? ""} onChange={(e) => set({ currency: e.target.value || undefined })}>
        <option value="">Tüm para birimleri (ayrı)</option>
        {f.currencies.map((c: string) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select aria-label="Mağaza yaşı" className={SELECT} value={input.age ?? ""} onChange={(e) => set({ age: (e.target.value || undefined) as CenterInput["age"] })}>
        <option value="">Tüm mağaza yaşları</option>
        {AGE_BUCKETS.map((a) => <option key={a} value={a}>{a} gün</option>)}
      </select>
    </>
  );
}

function CoverageNotes({ d }: { d: CenterData }) {
  const c = d.coverage;
  return (
    <div className="flex flex-wrap gap-2 text-[11px]">
      <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground tabular-nums">{d.range.fromDay} → {d.range.toDay} · Europe/Istanbul</span>
      {d.compare ? <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">Karşılaştırma: {d.compare.from.slice(0, 10)} → {d.compare.to.slice(0, 10)}</span> : null}
      {c.partial ? <span className="rounded-full bg-accent px-2.5 py-1 text-accent-foreground">Kısmi dönem: bugün henüz bitmedi</span> : null}
      {c.excludedDemoStores ? <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">{c.excludedDemoStores} demo/test mağaza hariç</span> : null}
      {c.truncated.length ? <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">Eksik kapsam: {c.truncated.join(", ")} sınıra ulaştı</span> : null}
      {c.errors.length ? <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">Okunamayan kaynak: {c.errors.length}</span> : null}
      <Popover>
        <PopoverTrigger asChild><button type="button" className="rounded-full border border-border px-2.5 py-1 text-muted-foreground hover:text-foreground">Desteklenmeyen metrikler</button></PopoverTrigger>
        <PopoverContent className="w-80 text-xs"><ul className="list-disc space-y-1 pl-4">{c.unsupported.map((u: string) => <li key={u}>{u}</li>)}</ul></PopoverContent>
      </Popover>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Overview({ d, go }: { d: CenterData; go: (t: string) => void }) {
  const c = d.kpis.current;
  const p = d.kpis.previous;
  const P = d.primary;
  const s = d.series;
  return (
    <div className="space-y-6">
      {d.insights.length ? (
        <section aria-label="Yönetici özeti" className="grid gap-3 md:grid-cols-2">
          {d.insights.map((i: CenterData["insights"][number]) => (
            <button key={i.title} type="button" onClick={() => go(i.tab)} className={cn("surface-card border-l-4 p-4 text-left transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", i.tone === "positive" ? "border-l-success" : i.tone === "negative" ? "border-l-destructive" : "border-l-primary")}>
              <p className="text-sm font-semibold">{i.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
              <p className="mt-2 text-[10.5px] uppercase tracking-wider text-muted-foreground">Kaynak: {i.source} · {d.range.fromDay} → {d.range.toDay}</p>
            </button>
          ))}
        </section>
      ) : <Empty>Bu dönem için güçlü bir içgörü üretecek kadar örneklem yok.</Empty>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="GMV" metric="gmv" value={moneyText(c.gmv, P)} cur={c.gmv[P] ?? 0} prev={p ? p.gmv[P] ?? 0 : null} spark={<Spark data={s} k="gmv" />} onOpen={() => go("commerce")} />
        <Kpi label="Net satış" metric="net_sales" value={moneyText(c.net, P)} cur={c.net[P] ?? 0} prev={p ? p.net[P] ?? 0 : null} spark={<Spark data={s} k="net" />} onOpen={() => go("commerce")} />
        <Kpi label="Platform geliri" metric="platform_revenue" value={moneyText(c.platformRevenue, P)} cur={c.platformRevenue[P] ?? 0} prev={p ? p.platformRevenue[P] ?? 0 : null} spark={<Spark data={s} k="platformRevenue" />} onOpen={() => go("revenue")} />
        <Kpi label="MRR" metric="mrr" value={moneyText(d.revenue.mrr, P)} note="Anlık durum" onOpen={() => go("revenue")} />
        <Kpi label="Sipariş" metric="orders" value={nf.format(c.orders)} cur={c.orders} prev={p?.orders ?? null} spark={<Spark data={s} k="orders" />} onOpen={() => go("commerce")} />
        <Kpi label="Ort. sipariş tutarı" metric="aov" value={moneyText(c.aov, P)} cur={c.aov[P] ?? null} prev={p ? p.aov[P] ?? null : null} onOpen={() => go("commerce")} />
        <Kpi label="Ödeme başarısızlığı" metric="payment_failure_rate" value={c.payments.total ? pf(c.payments.rate) : "Veri yok"} cur={c.payments.rate} prev={p ? p.payments.rate : null} invert note={c.payments.total ? `${c.payments.failed}/${c.payments.total}` : undefined} onOpen={() => go("operations")} />
        <Kpi label="İade oranı" metric="refund_rate" value={c.gmv[P] ? pf(c.refundRate[P] ?? 0) : "Veri yok"} cur={c.refundRate[P] ?? null} prev={p ? p.refundRate[P] ?? null : null} invert onOpen={() => go("commerce")} />
        <Kpi label="Toplam mağaza" metric="stores_total" value={nf.format(c.storesTotal)} cur={c.storesTotal} prev={p?.storesTotal ?? null} onOpen={() => go("sellers")} />
        <Kpi label="Yeni mağaza" metric="stores_new" value={nf.format(c.storesNew)} cur={c.storesNew} prev={p?.storesNew ?? null} spark={<Spark data={s} k="newStores" />} onOpen={() => go("sellers")} />
        <Kpi label="Satış yapan mağaza" metric="stores_selling" value={nf.format(c.storesSelling)} cur={c.storesSelling} prev={p?.storesSelling ?? null} onOpen={() => go("sellers")} />
        <Kpi label="İlk satışını yapan" metric="stores_first_sale" value={nf.format(c.firstSale)} cur={c.firstSale} prev={p?.firstSale ?? null} onOpen={() => go("sellers")} />
        <Kpi label="Yayında mağaza" metric="stores_published" value={nf.format(d.kpis.published)} note="Anlık" />
        <Kpi label="Denemede" metric="subs_trialing" value={nf.format(d.kpis.trialing)} note="Anlık" onOpen={() => go("revenue")} />
        <Kpi label="Ücretli mağaza" metric="subs_paid" value={nf.format(d.kpis.paidStores)} note="Anlık" onOpen={() => go("revenue")} />
        <Kpi label="Ziyaret → sipariş" value={c.conversion === null ? "Oturum verisi yok" : pf(c.conversion, 2)} note={c.sessions ? `${nf.format(c.sessions)} oturum` : undefined} />
      </div>

      <Panel eyebrow="Trend" title={`GMV ve platform geliri (${P})`} table={{ header: ["Tarih", "GMV", "Önceki GMV", "Platform geliri"], rows: s.map((r) => [r.date, r.gmv, r.prevGmv ?? "—", r.platformRevenue]) }}>
        <TrendChart data={s} money={P} lines={[{ key: "gmv", label: "GMV", color: "var(--color-chart-1)" }, ...(d.compare ? [{ key: "prevGmv", label: "Karşılaştırma GMV", color: "var(--color-muted-foreground)", dashed: true }] : []), { key: "platformRevenue", label: "Platform geliri", color: "var(--color-chart-3)" }]} />
        <p className="mt-2 text-[11px] text-muted-foreground">GMV mağazaların satışıdır; platform geliri yalnız Mefticaret'in tahsil ettiği abonelik ve komisyondur. İkisi toplanmaz.</p>
      </Panel>
    </div>
  );
}

function Revenue({ d }: { d: CenterData }) {
  const r = d.revenue;
  const P = d.primary;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="MRR" metric="mrr" value={moneyText(r.mrr, P)} note="Yıllıklar ÷ 12" />
        <Kpi label="ARR (MRR×12)" metric="arr" value={moneyText(r.arr, P)} note="Tahsilat değildir" />
        <Kpi label="Yeni MRR" value={moneyText(r.newMrr, P)} note="Dönemde başlayıp aktif olan" />
        <Kpi label="Kaybedilen MRR" value={moneyText(r.churnedMrr, P)} note={`${r.canceledCount} iptal`} />
        <Kpi label="Mağaza kaybı oranı" value={pf(r.churnRate)} note="iptal ÷ (aktif + iptal)" />
        <Kpi label="Deneme → ücretli" value={r.trial.ended ? pf(r.trial.rate) : "Biten deneme yok"} note={r.trial.ended ? `${r.trial.converted}/${r.trial.ended}` : undefined} />
        <Kpi label="Tahsil edilen abonelik" value={moneyText(r.invoices.collected, P)} note="Ödenmiş faturalar" />
        <Kpi label="Açık alacak" value={moneyText(r.invoices.open, P)} note={`${r.invoices.openCount} fatura · vadesi geçen ${moneyText(r.invoices.overdue, P)}`} />
      </div>
      <p className="text-[11px] text-muted-foreground">Genişleyen/daralan MRR gösterilmez: plan değişiklik geçmişi tutulmuyor. LTV/CAC/geri ödeme: edinme maliyeti verisi yok. Komisyon geliri (dönem): {moneyText(r.commission, P)}.</p>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel eyebrow="Dağılım" title="Plan bazında mağaza ve MRR" table={{ header: ["Plan", "Mağaza", "MRR"], rows: r.byPlan.map((x: any) => [x.plan, x.stores, moneyText(x.mrr, P)]) }}>
          {r.byPlan.length ? (
            <div className="h-60"><ResponsiveContainer><BarChart data={r.byPlan.map((x: any) => ({ plan: x.plan, stores: x.stores, mrr: x.mrr[P] ?? 0 }))}><CartesianGrid stroke={CHART_GRID} vertical={false} /><XAxis dataKey="plan" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} width={40} /><Tooltip /><Bar name="Mağaza" dataKey="stores" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>
          ) : <Empty>Abonelik kaydı yok.</Empty>}
        </Panel>
        <Panel eyebrow="Kohort" title="Abonelik başlangıç ayına göre elde tutma">
          {r.cohorts.length ? <DataTable header={["Ay", "Başlayan", "Hâlâ aktif", "Elde tutma"]} rows={r.cohorts.map((x: any) => [x.month, x.started, x.active, x.started ? pf((x.active / x.started) * 100, 0) : "—"])} /> : <Empty>Abonelik kaydı yok.</Empty>}
        </Panel>
      </div>
    </div>
  );
}

function Sellers({ d }: { d: CenterData }) {
  const s = d.sellers;
  const top = s.funnel[0]?.count ?? 0;
  return (
    <div className="space-y-6">
      <Panel eyebrow="Onboarding hunisi" title="Dönemde açılan mağazaların ilerleyişi" table={{ header: ["Adım", "Mağaza", "Önceki adıma göre"], rows: s.funnel.map((f: any, i: number) => [f.label, f.count, i ? pf(s.funnel[i - 1].count ? (f.count / s.funnel[i - 1].count) * 100 : null, 0) : "—"]) }}>
        {top ? (
          <ol className="space-y-2">
            {s.funnel.map((f: any, i: number) => {
              const prev = i ? s.funnel[i - 1].count : f.count;
              const w = (f.count / top) * 100;
              return (
                <li key={f.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_7rem]">
                  <span className="truncate">{f.label}</span>
                  <div className="h-6 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/80 transition-all" style={{ width: `${Math.max(w, 2)}%` }} /></div>
                  <span className="text-right text-xs tabular-nums">{f.count}{i ? <span className="ml-1 text-muted-foreground">({prev ? pf((f.count / prev) * 100, 0) : "—"})</span> : null}</span>
                </li>
              );
            })}
          </ol>
        ) : <Empty>Bu dönemde yeni mağaza açılmadı.</Empty>}
        <p className="mt-3 text-[11px] text-muted-foreground">Huni mağaza oluşturmadan başlar; kullanıcı kaydı ayrı olay olarak tutulmuyor. İlk ürüne medyan süre: {s.ttfProductDays === null ? "—" : `${s.ttfProductDays.toFixed(1)} gün`} · ilk siparişe: {s.ttfOrderDays === null ? "—" : `${s.ttfOrderDays.toFixed(1)} gün`}.</p>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel eyebrow="Kohort" title="Mağaza açılış ayına göre"><DataTable header={["Ay", "Mağaza", "Ürün ekledi", "İlk sipariş", "Ücretli"]} rows={s.cohorts.map((c: any) => [c.month, c.stores, c.product, c.firstOrder, c.paid])} /></Panel>
        <Panel eyebrow="Karşılaştırma" title="Sektör · plan · yaş">
          <div className="space-y-4">
            {[["Sektör", s.byIndustry], ["Plan", s.byPlan], ["Mağaza yaşı (gün)", s.byAge]].map(([t, rows]: any) => <div key={t}><p className="text-xs font-semibold">{t}</p><DataTable header={[t, "Mağaza", "Dönemde satış yapan", "Hiç sipariş alan"]} rows={rows.map((r: any) => [r.key, r.stores, r.selling, r.firstOrder])} /></div>)}
          </div>
        </Panel>
      </div>
      <Panel eyebrow="Sağlık puanı (kural tabanlı)" title="Takılan ve aktifliği azalan mağazalar" action={<span className="text-xs text-muted-foreground tabular-nums">Ortalama: {s.healthAvg === null ? "—" : s.healthAvg.toFixed(0)}/100</span>}>
        <p className="mb-2 text-[11px] text-muted-foreground">100'den başlar: ürün yok −25, ödeme yöntemi yok −20, yayında değil −20, gecikmiş abonelik −15, sipariş düşüşü −20, 30 gündür sipariş yok −10. Yapay zekâ değildir.</p>
        {s.stuck.length || s.declining.length ? (
          <DataTable header={["Mağaza", "Plan", "Yaş (gün)", "Puan", "Etkenler"]} rows={[...s.declining, ...s.stuck.filter((x: any) => !x.declining)].map((h: any) => [h.name, h.plan, h.ageDays, h.score, h.factors.map((f: any) => `${f.label} (${f.points})`).join(" · ")])} />
        ) : <Empty>Takılan veya düşüşte mağaza yok.</Empty>}
      </Panel>
    </div>
  );
}

function Commerce({ d }: { d: CenterData }) {
  const P = d.primary;
  const s = d.series;
  return (
    <div className="space-y-6">
      <Panel eyebrow="Trend" title="Sipariş, iade ve iptal" table={{ header: ["Tarih", "Sipariş", "İptal", `İade (${P})`], rows: s.map((r) => [r.date, r.orders, r.cancelled, r.refunds]) }}>
        <TrendChart data={s} lines={[{ key: "orders", label: "Sipariş", color: "var(--color-chart-1)" }, { key: "cancelled", label: "İptal", color: "var(--color-destructive)" }, ...(d.compare ? [{ key: "prevOrders", label: "Karşılaştırma sipariş", color: "var(--color-muted-foreground)", dashed: true }] : [])]} />
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel eyebrow="Ödeme" title="Sağlayıcı bazında başarı">
          {d.commerce.providers.length ? <DataTable header={["Sağlayıcı", "Deneme", "Başarısız", "Başarı"]} rows={d.commerce.providers.map((p: any) => [p.provider, p.total, p.failed, pf(p.successRate)])} /> : <Empty>Bu dönemde ödeme denemesi kaydı yok.</Empty>}
        </Panel>
        <Panel eyebrow="Mağazalar" title={`GMV'ye göre ilk 15 (${P})`}>
          {d.commerce.topStores.length ? <DataTable header={["Mağaza", "Sipariş", "GMV"]} rows={d.commerce.topStores.map((t: any) => [t.name, t.orders, fm(t.gmv, P)])} /> : <Empty>Bu dönemde ödenmiş sipariş yok.</Empty>}
        </Panel>
      </div>
      <p className="text-[11px] text-muted-foreground">Ziyaretçi dönüşümü yalnız oturum verisi olan mağazalarda hesaplanır ({d.coverage.sessionsTracked ? "oturum özeti mevcut" : "oturum verisi yok"}). Kategori kırılımı ilk sürümde yok.</p>
    </div>
  );
}

function Usage({ d }: { d: CenterData }) {
  return (
    <Panel eyebrow="Modüller" title="Bağlantı ile gerçek kullanım arasındaki fark" table={{ header: ["Modül", "Bağlı mağaza", "Kullanan", "Toplam mağaza"], rows: d.modules.map((m: any) => [m.label, m.connected, m.used ?? "veri yok", m.total]) }}>
      <ul className="space-y-4">
        {d.modules.map((m: any) => (
          <li key={m.key}>
            <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{m.label}</span><span className="text-xs tabular-nums text-muted-foreground">Bağlı {m.connected}/{m.total} · {m.used === null ? m.usedLabel : `${m.used} ${m.usedLabel}`}</span></div>
            <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
              <div className="absolute inset-y-0 left-0 rounded-full bg-primary/30" style={{ width: `${m.total ? (m.connected / m.total) * 100 : 0}%` }} />
              {m.used !== null ? <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${m.total ? (m.used / m.total) * 100 : 0}%` }} /> : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-muted-foreground">Blog ve uygulama içi kullanım olayları tutulmadığından geçmiş kullanım gösterilmez. Açık ton: bağlı, koyu ton: gerçekten kullanan.</p>
    </Panel>
  );
}

function Operations({ d }: { d: CenterData }) {
  const o = d.ops;
  const rate = (a: number, b: number) => (b ? pf((a / b) * 100) : "Veri yok");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Kuyruk işleri" value={nf.format(o.jobs.total)} note={`${o.jobs.failed} başarısız · ${o.jobs.queued} bekliyor`} />
        <Kpi label="Kuyruk bekleme (medyan)" value={o.jobs.medianWaitSec === null ? "Veri yok" : `${o.jobs.medianWaitSec.toFixed(1)} sn`} />
        <Kpi label="Webhook başarısı" value={rate(o.webhooks.success, o.webhooks.total)} note={o.webhooks.medianMs === null ? undefined : `medyan ${Math.round(o.webhooks.medianMs)} ms`} />
        <Kpi label="XML senkron başarısı" value={rate(o.xml.success, o.xml.total)} note={`${o.xml.failed} hata · ${o.xml.partial} kısmi`} />
        <Kpi label="API hata oranı (5xx)" value={rate(o.api.errors5xx, o.api.total)} note={o.api.total ? `${o.api.errors4xx} adet 4xx` : undefined} />
        <Kpi label="API yanıt süresi" value={o.api.p50 === null ? "Veri yok" : `p50 ${o.api.p50} ms`} note={o.api.p95 === null ? undefined : `p95 ${o.api.p95} ms`} />
        <Kpi label="Ödeme hataları" value={nf.format(o.paymentErrors)} note="Dönemde başarısız deneme" />
        <Kpi label="Kargo senkron hatası" value={o.shipping.synced ? `${o.shipping.errors}/${o.shipping.synced}` : "Veri yok"} />
        <Kpi label="Alan adı / TLS sorunu" value={nf.format(o.domains.failed + o.domains.sslIssues)} note={`${o.domains.custom} özel alan adı · anlık`} />
      </div>
      <p className="text-[11px] text-muted-foreground">Kuyruk, webhook, XML ve API değerleri seçilen döneme aittir (gecikmeli rapor). Alan adı/TLS anlık durumdur. Uptime ölçüm kaynağı olmadığından gösterilmez.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Özel rapor oluşturucu                                                */
/* ------------------------------------------------------------------ */

function ReportBuilder({ base }: { base: CenterInput }) {
  const [metrics, setMetrics] = useState<ReportMetric[]>(["gmv", "orders"]);
  const [dimension, setDimension] = useState<ReportDimension>("day");
  const [sort, setSort] = useState<"dimension" | "value_desc" | "value_asc">("dimension");
  const [chart, setChart] = useState<ReportChart>("table");
  const [name, setName] = useState("");
  const run = useServerFn(runAnalyticsReport);
  const save = useServerFn(saveView);
  const exportLog = useServerFn(logAnalyticsExport);
  const qc = useQueryClient();
  const config = useMemo(() => ({ ...base, metrics, dimension, sort, limit: 500 }), [base, metrics, dimension, sort]);
  const q = useQuery({ queryKey: ["pac-report", config], queryFn: () => run({ data: config }) as Promise<any>, enabled: metrics.length > 0 });
  const charts = allowedCharts(dimension, metrics.length);
  const activeChart = charts.includes(chart) ? chart : "table";
  const rows: any[] = q.data?.rows ?? [];
  const colors = ["var(--color-chart-1)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

  const toggle = (m: ReportMetric) => setMetrics((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : cur.length < 4 ? [...cur, m] : cur));
  const exportCsv = () => {
    const csv = toCsv([REPORT_DIMENSION_LABELS[dimension], ...metrics.map((m) => REPORT_METRIC_LABELS[m])], rows.map((r) => [r.key, ...metrics.map((m) => Number(r[m]).toFixed(2))]));
    download(`ozel-rapor-${Date.now()}.csv`, csv);
    void exportLog({ data: { name: name || "custom-report", rows: rows.length, filters: config as Record<string, unknown> } });
  };

  return (
    <div className="space-y-4">
      <Panel eyebrow="Kod yazmadan" title="Rapor oluşturucu">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <fieldset>
            <legend className="text-xs font-semibold">Onaylı metrikler (en fazla 4)</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {REPORT_METRICS.map((m) => (
                <button key={m} type="button" aria-pressed={metrics.includes(m)} onClick={() => toggle(m)} className={cn("rounded-full border px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", metrics.includes(m) ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>{REPORT_METRIC_LABELS[m]}</button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-end gap-2">
            <select aria-label="Boyut" className={SELECT} value={dimension} onChange={(e) => setDimension(e.target.value as ReportDimension)}>{REPORT_DIMENSIONS.map((x) => <option key={x} value={x}>Grupla: {REPORT_DIMENSION_LABELS[x]}</option>)}</select>
            <select aria-label="Sıralama" className={SELECT} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="dimension">Boyuta göre</option><option value="value_desc">Değer azalan</option><option value="value_asc">Değer artan</option></select>
            <select aria-label="Görünüm" className={SELECT} value={activeChart} onChange={(e) => setChart(e.target.value as ReportChart)}>{charts.map((c) => <option key={c} value={c}>{{ table: "Tablo", bar: "Sütun", line: "Çizgi", stacked: "Yığılmış sütun" }[c]}</option>)}</select>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">Tarih aralığı ve filtreler üstteki seçimlerden gelir. Huni ve kohort görünümleri Satıcılar/Gelir sekmelerindedir. Ham SQL çalıştırılamaz; sunucu yalnız izin listesindeki metrik ve boyutları kabul eder (en fazla 500 satır).</p>
      </Panel>
      <Panel title={q.isFetching ? "Hesaplanıyor…" : `${rows.length} satır${q.data?.totalRows > rows.length ? ` / ${q.data.totalRows}` : ""}`} action={
        <div className="flex flex-wrap gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rapor adı" className="h-9 w-40 rounded-full" aria-label="Rapor adı" />
          <Button size="sm" variant="outline" disabled={!name.trim()} onClick={async () => { try { await save({ data: { kind: "report", name: name.trim(), config } }); toast.success("Rapor kaydedildi"); void qc.invalidateQueries({ queryKey: ["pac-saved"] }); } catch (e) { toast.error((e as Error).message); } }}><Save className="size-4" /> Kaydet</Button>
          <Button size="sm" variant="outline" disabled={!rows.length} onClick={exportCsv}><Download className="size-4" /> CSV</Button>
        </div>
      }>
        {q.data?.mixedCurrency && metrics.some((m) => ["gmv", "net_sales", "aov", "refunds"].includes(m)) ? <p className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">Birden fazla para birimi var: tutarlar toplanmamalı. Üstten para birimi seçin veya "Para birimi" boyutuyla gruplayın.</p> : null}
        {!metrics.length ? <Empty>En az bir metrik seçin.</Empty> : q.isError ? <Empty>Rapor hesaplanamadı.</Empty> : !rows.length && !q.isFetching ? <Empty>Seçilen dönemde veri yok.</Empty> : activeChart === "table" ? null : (
          <div className="h-72"><ResponsiveContainer>
            {activeChart === "line" ? (
              <LineChart data={rows}><CartesianGrid stroke={CHART_GRID} vertical={false} /><XAxis dataKey="key" tick={{ fontSize: 10 }} minTickGap={20} /><YAxis tick={{ fontSize: 10 }} width={56} /><Tooltip />{metrics.map((m, i) => <Line key={m} name={REPORT_METRIC_LABELS[m]} dataKey={m} stroke={colors[i]} dot={false} strokeWidth={2} />)}</LineChart>
            ) : (
              <BarChart data={rows}><CartesianGrid stroke={CHART_GRID} vertical={false} /><XAxis dataKey="key" tick={{ fontSize: 10 }} minTickGap={20} /><YAxis tick={{ fontSize: 10 }} width={56} /><Tooltip />{metrics.map((m, i) => <Bar key={m} name={REPORT_METRIC_LABELS[m]} dataKey={m} fill={colors[i]} stackId={activeChart === "stacked" ? "s" : undefined} />)}</BarChart>
            )}
          </ResponsiveContainer></div>
        )}
        {rows.length ? <DataTable header={[REPORT_DIMENSION_LABELS[dimension], ...metrics.map((m) => REPORT_METRIC_LABELS[m])]} rows={rows.map((r) => [r.key, ...metrics.map((m) => Number(r[m]))])} /> : null}
      </Panel>
    </div>
  );
}

function SavedViews({ input, onApply }: { input: CenterInput; onApply: (i: CenterInput) => void }) {
  const list = useServerFn(listSavedViews);
  const save = useServerFn(saveView);
  const del = useServerFn(deleteView);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pac-saved"], queryFn: () => list() });
  const [name, setName] = useState("");
  const saveM = useMutation({ mutationFn: () => save({ data: { kind: "view", name: name.trim(), config: input as Record<string, unknown> } }), onSuccess: () => { setName(""); toast.success("Görünüm kaydedildi"); void qc.invalidateQueries({ queryKey: ["pac-saved"] }); }, onError: (e) => toast.error((e as Error).message) });
  return (
    <Popover>
      <PopoverTrigger asChild><Button size="sm" variant="outline"><Save className="size-4" /> Görünümler</Button></PopoverTrigger>
      <PopoverContent className="w-80 space-y-3">
        <div className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bu görünümün adı" aria-label="Görünüm adı" /><Button size="sm" disabled={!name.trim() || saveM.isPending} onClick={() => saveM.mutate()}>Kaydet</Button></div>
        <ul className="max-h-64 space-y-1 overflow-auto text-sm">
          {(q.data ?? []).filter((v) => v.kind === "view").map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-muted">
              <button type="button" className="truncate text-left" onClick={() => onApply({ period: "30d", compare: "previous", ...v.config })}>{v.name}</button>
              <button type="button" aria-label={`${v.name} sil`} onClick={async () => { await del({ data: { id: v.id } }); void qc.invalidateQueries({ queryKey: ["pac-saved"] }); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
            </li>
          ))}
          {!(q.data ?? []).some((v) => v.kind === "view") ? <li className="text-xs text-muted-foreground">Kayıtlı görünüm yok.</li> : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
