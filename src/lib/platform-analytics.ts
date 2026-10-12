/**
 * Platform Analitik Merkezi (v2) — istemci + sunucu ortak tanımlar.
 * Metrik sözlüğü, filtre şeması, rapor oluşturucu izin listesi ve güvenli CSV.
 * Saat dilimi: Europe/Istanbul (UTC+3); dönemler [from, to) aralığıdır.
 */
import { z } from "zod";

import { PERIODS, resolvePeriod, type ResolvedRange } from "@/lib/analytics-v2";

export const FLAG_KEY = "v2_superadmin_analytics";
export const AGE_BUCKETS = ["0-30", "31-90", "91-365", "365+"] as const;
export const COMPARE_MODES = ["previous", "yoy", "none"] as const;
export type CompareMode = (typeof COMPARE_MODES)[number];

export const centerInputSchema = z.object({
  period: z.enum(PERIODS).default("30d"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  compare: z.enum(COMPARE_MODES).default("previous"),
  storeId: z.guid().optional(),
  planId: z.guid().optional(),
  industry: z.string().max(80).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  age: z.enum(AGE_BUCKETS).optional(),
});
export type CenterInput = z.infer<typeof centerInputSchema>;

const DAY = 86_400_000;

/** Karşılaştırma dönemi: önceki eşit uzunluk veya geçen yılın aynı dönemi. */
export function compareRange(r: ResolvedRange, mode: CompareMode): { from: string; to: string } | null {
  if (mode === "none") return null;
  const from = Date.parse(r.from);
  const to = Date.parse(r.to);
  if (mode === "previous") return { from: new Date(from - (to - from)).toISOString(), to: r.from };
  const shift = (iso: number) => {
    const d = new Date(iso);
    d.setUTCFullYear(d.getUTCFullYear() - 1);
    return d.toISOString();
  };
  return { from: shift(from), to: shift(to) };
}

export function resolveCenterRange(input: CenterInput, now = Date.now()) {
  const range = resolvePeriod(input, now);
  const partial = Date.parse(range.to) > now; // dönem henüz bitmedi
  return { range, compare: compareRange(range, input.compare), partial };
}

/** Önceki değer 0 veya eksikse yüzde üretmez. */
export function safeChange(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export function ageBucketOf(createdAt: string, now = Date.now()): (typeof AGE_BUCKETS)[number] {
  const days = (now - Date.parse(createdAt)) / DAY;
  if (days <= 30) return "0-30";
  if (days <= 90) return "31-90";
  if (days <= 365) return "91-365";
  return "365+";
}

/** Para birimlerini toplamadan ayrı tutar. */
export type MoneyByCurrency = Record<string, number>;
export function addMoney(target: MoneyByCurrency, currency: string | null | undefined, amount: number) {
  const c = (currency || "TRY").toUpperCase();
  target[c] = (target[c] ?? 0) + amount;
}

/** CSV formül enjeksiyonu korumalı hücre. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
}

/* ------------------------------------------------------------------ */
/* Metrik sözlüğü                                                       */
/* ------------------------------------------------------------------ */

export type MetricDef = {
  key: string;
  label: string;
  description: string;
  formula: string;
  source: string;
  dateField: string;
  includes: string;
  refresh: string;
};

const TZ = "Europe/Istanbul (UTC+3)";
const REFRESH = "İstek anında hesaplanır; sunucuda 2 dk önbellek";
const PAID_SCOPE = "payment_status ∈ {paid, partially_refunded, refunded} ve status ≠ cancelled";

export const METRICS: MetricDef[] = [
  { key: "stores_total", label: "Toplam mağaza", description: "Dönem sonuna kadar oluşturulmuş mağazalar.", formula: "count(stores) created_at < dönem sonu", source: "stores", dateField: "stores.created_at", includes: "Demo ve test mağazaları (is_demo/is_test) hariç; arşivlenenler dahil.", refresh: REFRESH },
  { key: "stores_new", label: "Yeni mağaza", description: "Dönem içinde oluşturulan mağazalar.", formula: "count(stores) created_at ∈ dönem", source: "stores", dateField: "stores.created_at", includes: "Demo/test hariç.", refresh: REFRESH },
  { key: "stores_selling", label: "Satış yapan aktif mağaza", description: "Dönem içinde en az bir ödenmiş siparişi olan mağaza. Giriş yapma aktivitesi bu metriğe dahil değildir.", formula: "count(distinct orders.store_id) ödenmiş kapsam", source: "orders", dateField: "coalesce(placed_at, created_at)", includes: PAID_SCOPE, refresh: REFRESH },
  { key: "stores_published", label: "Yayında mağaza", description: "Durumu active ve yayın tarihi olan mağaza.", formula: "count(stores) status = active ∧ published_at ≠ null", source: "stores", dateField: "anlık durum", includes: "Demo/test hariç.", refresh: REFRESH },
  { key: "stores_first_sale", label: "İlk satışını yapan", description: "İlk ödenmiş siparişi bu dönemde olan mağaza.", formula: "min(sipariş tarihi) ∈ dönem", source: "orders (platform_store_milestones)", dateField: "coalesce(placed_at, created_at)", includes: PAID_SCOPE.replace(" ve status ≠ cancelled", ""), refresh: REFRESH },
  { key: "subs_trialing", label: "Denemedeki mağaza", description: "Aboneliği trialing durumunda olan mağaza.", formula: "count(subscriptions) status = trialing", source: "subscriptions", dateField: "anlık durum", includes: "Demo/test mağazaları hariç.", refresh: REFRESH },
  { key: "subs_paid", label: "Ücretli mağaza", description: "Tutarı > 0 olan active/past_due abonelik.", formula: "count(subscriptions) status ∈ {active, past_due} ∧ amount > 0", source: "subscriptions", dateField: "anlık durum", includes: "Ücretsiz plan ve deneme hariç.", refresh: REFRESH },
  { key: "gmv", label: "GMV (brüt satış hacmi)", description: "Mağazaların ödenmiş siparişlerinin toplam tutarı. Platform geliri DEĞİLDİR.", formula: "Σ orders.grand_total", source: "orders", dateField: "coalesce(placed_at, created_at)", includes: `${PAID_SCOPE}. Vergi ve kargo DAHİL, indirim düşülmüş (grand_total). İadeler düşülmez. Para birimleri ayrı.`, refresh: REFRESH },
  { key: "net_sales", label: "Net satış", description: "GMV'den vergi, kargo ve dönem içinde tamamlanan iadeler düşülür.", formula: "GMV − Σ tax_total − Σ shipping_total − Σ iade(refunded)", source: "orders, return_requests", dateField: "sipariş tarihi; iade için resolved_at/updated_at", includes: "İptaller GMV'ye zaten girmez. İadeler gerçekleştiği dönemde düşülür (geç gelen iade geçmiş dönemi değiştirmez).", refresh: REFRESH },
  { key: "orders", label: "Sipariş", description: "Ödenmiş kapsamdaki sipariş sayısı.", formula: "count(orders)", source: "orders", dateField: "coalesce(placed_at, created_at)", includes: PAID_SCOPE, refresh: REFRESH },
  { key: "aov", label: "Ortalama sipariş tutarı", description: "GMV / sipariş, para birimi bazında.", formula: "GMV ÷ sipariş", source: "orders", dateField: "coalesce(placed_at, created_at)", includes: "Vergi ve kargo dahil.", refresh: REFRESH },
  { key: "platform_revenue", label: "Platform geliri", description: "Mefticaret'in kendi geliri: tahsil edilmiş abonelik faturaları + komisyon kayıtları.", formula: "Σ invoices.total (status = paid, paid_at ∈ dönem) + Σ ledger platform_fee (posted)", source: "invoices, ledger_entries", dateField: "invoices.paid_at; ledger_entries.occurred_at", includes: "Tahmini/açık faturalar hariç. Mağaza satışları hariç.", refresh: REFRESH },
  { key: "mrr", label: "MRR", description: "Aktif ücretli aboneliklerin aylık tekrarlayan tutarı.", formula: "Σ amount (aylık) + Σ amount ÷ 12 (yıllık)", source: "subscriptions", dateField: "anlık durum (dönem sonu)", includes: "status ∈ {active, past_due}; deneme, tek seferlik ücretler ve işlem cirosu hariç.", refresh: REFRESH },
  { key: "arr", label: "ARR (MRR × 12)", description: "MRR tabanlı yıllıklandırma; tahsil edilmiş gelir değildir.", formula: "MRR × 12", source: "subscriptions", dateField: "anlık durum", includes: "MRR ile aynı.", refresh: REFRESH },
  { key: "payment_failure_rate", label: "Ödeme başarısızlığı", description: "Başarısız ödeme denemelerinin oranı.", formula: "count(payments status = failed) ÷ count(payments)", source: "payments", dateField: "payments.created_at", includes: "Tüm sağlayıcılar.", refresh: REFRESH },
  { key: "refund_rate", label: "İade oranı", description: "Dönemde iade edilen tutarın GMV'ye oranı (para birimi bazında).", formula: "Σ iade ÷ GMV", source: "return_requests, orders", dateField: "iade: updated_at", includes: "Yalnız refunded durumundaki iade talepleri.", refresh: REFRESH },
];
export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<string, MetricDef>;

/* ------------------------------------------------------------------ */
/* Özel rapor oluşturucu izin listesi                                   */
/* ------------------------------------------------------------------ */

export const REPORT_METRICS = ["gmv", "orders", "aov", "net_sales", "stores_new", "stores_selling", "refunds", "payments_failed"] as const;
export const REPORT_DIMENSIONS = ["day", "week", "month", "store", "plan", "industry", "currency", "age"] as const;
export const REPORT_CHARTS = ["line", "bar", "stacked", "table"] as const;
export type ReportMetric = (typeof REPORT_METRICS)[number];
export type ReportDimension = (typeof REPORT_DIMENSIONS)[number];
export type ReportChart = (typeof REPORT_CHARTS)[number];
export const REPORT_METRIC_LABELS: Record<ReportMetric, string> = {
  gmv: "GMV", orders: "Sipariş", aov: "Ort. sipariş tutarı", net_sales: "Net satış", stores_new: "Yeni mağaza",
  stores_selling: "Satış yapan mağaza", refunds: "İade tutarı", payments_failed: "Başarısız ödeme",
};
export const REPORT_DIMENSION_LABELS: Record<ReportDimension, string> = {
  day: "Gün", week: "Hafta", month: "Ay", store: "Mağaza", plan: "Plan", industry: "Sektör", currency: "Para birimi", age: "Mağaza yaşı",
};
export const TIME_DIMENSIONS: ReportDimension[] = ["day", "week", "month"];
/** Grafik türü yalnız veriye uygunsa: çizgi yalnız zaman boyutunda, yığılmış yalnız çok metrikli. */
export function allowedCharts(dimension: ReportDimension, metricCount: number): ReportChart[] {
  const out: ReportChart[] = ["table", "bar"];
  if (TIME_DIMENSIONS.includes(dimension)) out.push("line");
  if (metricCount > 1) out.push("stacked");
  return out;
}

export const reportInputSchema = centerInputSchema.extend({
  metrics: z.array(z.enum(REPORT_METRICS)).min(1).max(4),
  dimension: z.enum(REPORT_DIMENSIONS),
  sort: z.enum(["dimension", "value_desc", "value_asc"]).default("dimension"),
  limit: z.number().int().min(1).max(500).default(100),
});
export type ReportInput = z.infer<typeof reportInputSchema>;
