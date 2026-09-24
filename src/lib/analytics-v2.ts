/** Analitik v2: istemci + sunucu ortak tipler ve dönem yardımcıları (İstanbul saati, UTC+3). */
import { z } from "zod";

export const PERIODS = ["today", "yesterday", "7d", "30d", "90d", "custom"] as const;
export type Period = (typeof PERIODS)[number];
export const PERIOD_LABELS: Record<Period, string> = {
  today: "Bugün",
  yesterday: "Dün",
  "7d": "Son 7 gün",
  "30d": "Son 30 gün",
  "90d": "Son 90 gün",
  custom: "Özel aralık",
};

export const BUCKETS = ["hour", "day", "week", "month"] as const;
export type Bucket = (typeof BUCKETS)[number];
export const BUCKET_LABELS: Record<Bucket, string> = { hour: "Saatlik", day: "Günlük", week: "Haftalık", month: "Aylık" };

export const SECTIONS = ["overview", "series", "sales", "orders", "products", "customers", "traffic", "funnel", "live"] as const;
export type Section = (typeof SECTIONS)[number];

const TZ_OFFSET_MS = 3 * 3_600_000;
const DAY = 86_400_000;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export const periodInputSchema = z.object({
  period: z.enum(PERIODS).default("30d"),
  from: z.string().regex(dateRe).optional(),
  to: z.string().regex(dateRe).optional(),
});
export type PeriodInput = z.infer<typeof periodInputSchema>;

function istanbulDay(ms: number) {
  return new Date(ms + TZ_OFFSET_MS).toISOString().slice(0, 10);
}
function startOfDayUtc(day: string) {
  return Date.parse(`${day}T00:00:00.000Z`) - TZ_OFFSET_MS;
}

export type ResolvedRange = { from: string; to: string; fromDay: string; toDay: string; days: number; bucket: Bucket };

/** Dönemi [from, to) UTC ISO aralığına çevirir; en fazla 366 gün. */
export function resolvePeriod(input: PeriodInput, now = Date.now()): ResolvedRange {
  const today = istanbulDay(now);
  let fromDay = today;
  let toDay = today;
  const back = (n: number) => istanbulDay(startOfDayUtc(today) - n * DAY + TZ_OFFSET_MS);
  if (input.period === "yesterday") fromDay = toDay = back(1);
  else if (input.period === "7d") fromDay = back(6);
  else if (input.period === "30d") fromDay = back(29);
  else if (input.period === "90d") fromDay = back(89);
  else if (input.period === "custom") {
    fromDay = input.from ?? back(6);
    toDay = input.to ?? today;
    if (fromDay > toDay) [fromDay, toDay] = [toDay, fromDay];
  }
  let fromMs = startOfDayUtc(fromDay);
  const toMs = startOfDayUtc(toDay) + DAY;
  if (toMs - fromMs > 366 * DAY) fromMs = toMs - 366 * DAY;
  const days = Math.round((toMs - fromMs) / DAY);
  const bucket: Bucket = days <= 1 ? "hour" : days <= 45 ? "day" : days <= 180 ? "week" : "month";
  return { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString(), fromDay, toDay: istanbulDay(toMs - 1), days, bucket };
}

export type Kpis = { revenue: number; orders: number; aov: number; visitors: number; sessions: number; conversion_rate: number };
export type Overview = { current: Kpis; previous: Kpis };
export type SeriesPoint = { t: string; revenue: number; orders: number; visitors: number; sessions: number; conversion_rate: number };
export type SalesData = {
  breakdown: { gross: number; discount: number; tax: number; shipping: number; total: number; orders: number };
  refunds: number;
  payment_methods: { method: string; amount: number; count: number }[];
  heatmap: { dow: number; hour: number; orders: number; revenue: number }[];
};
export type OrdersData = { total: number; statuses: { status: string; count: number }[]; avg_fulfillment_hours: number | null; refunded_orders: number };
export type ProductsData = {
  top: { product_id: string | null; title: string; quantity: number; revenue: number }[];
  viewed: { product_id: string; title: string; views: number; sessions: number }[];
  abandoned: { product_id: string; title: string; carted_sessions: number; purchased_sessions: number }[];
  low_stock: { variant_id: string; product_id: string; title: string; variant_title: string; stock: number; low_stock_threshold: number }[];
};
export type CustomersData = {
  new: number; returning: number; guest_orders: number; ltv: number; avg_orders_per_customer: number;
  top: { customer_id: string; name: string | null; email: string | null; orders: number; spent: number }[];
  provinces: { province: string; orders: number; revenue: number }[];
};
export type TrafficData = {
  sessions: number;
  channels: { channel: string; sessions: number; purchases: number }[];
  devices: { device: string; sessions: number }[];
  countries: { country: string; sessions: number }[];
  cities: { city: string; sessions: number }[];
  referrers: { host: string; sessions: number }[];
  campaigns: { campaign: string; source: string | null; medium: string | null; sessions: number; purchases: number; revenue: number }[];
};
export type FunnelData = { visitors: number; product_view: number; add_to_cart: number; checkout: number; purchase: number };
export type LiveData = {
  active_visitors: number; carts: number; checkouts: number;
  pages: { path: string; title: string | null; visitors: number }[];
  sessions: { path: string | null; device: string | null; country: string | null; city: string | null; at: string }[];
  recent_orders: { id: string; order_number: string; grand_total: number; currency: string; status: string; payment_status: string; placed_at: string; city: string | null }[];
};

export const CHANNEL_LABELS: Record<string, string> = {
  organic: "Organik", direct: "Direkt", social: "Sosyal", ads: "Reklam", email: "E-posta", referral: "Yönlendirme",
};
export const DEVICE_LABELS: Record<string, string> = { mobile: "Mobil", tablet: "Tablet", desktop: "Masaüstü", bilinmiyor: "Bilinmiyor" };

export function pctChange(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0;
  return ((cur - prev) / prev) * 100;
}

export const REPORT_KEYS = ["daily_sales", "weekly_performance", "monthly_growth", "product_performance", "customer_segments"] as const;
export type ReportKey = (typeof REPORT_KEYS)[number];
export const REPORTS: Record<ReportKey, { label: string; description: string; frequency: "daily" | "weekly" | "monthly"; period: Period }> = {
  daily_sales: { label: "Günlük satış özeti", description: "Dünün ciro, sipariş ve ziyaretçi özeti.", frequency: "daily", period: "yesterday" },
  weekly_performance: { label: "Haftalık performans", description: "Son 7 gün KPI'ları, kanallar ve dönüşüm hunisi.", frequency: "weekly", period: "7d" },
  monthly_growth: { label: "Aylık büyüme", description: "Son 30 gün, önceki 30 güne göre değişim.", frequency: "monthly", period: "30d" },
  product_performance: { label: "Ürün performansı", description: "En çok satan, görüntülenen ve sepette kalan ürünler.", frequency: "weekly", period: "30d" },
  customer_segments: { label: "Müşteri segmentleri", description: "Yeni / geri dönen, en değerli müşteriler, il dağılımı.", frequency: "monthly", period: "30d" },
};
