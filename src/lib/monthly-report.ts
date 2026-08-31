/** Aylık işletme raporu: saf hesaplama yardımcıları (veri erişimi içermez). */

export type ReportOrder = {
  id: string;
  order_number: string | null;
  placed_at: string | null;
  created_at: string;
  grand_total: number | string | null;
  subtotal: number | string | null;
  discount_total: number | string | null;
  shipping_total: number | string | null;
  tax_total?: number | string | null;
  status: string | null;
  payment_status: string | null;
  customer_email: string | null;
  discount_code: string | null;
};

export type ReportItem = {
  title: string | null;
  variant_title: string | null;
  quantity: number | string | null;
  line_total: number | string | null;
  product_id: string | null;
};

export type MonthRange = { start: string; end: string; label: string };

const MONTH_NAMES = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

/** "2026-08" biçimindeki ay anahtarını ISO aralığına çevirir. */
export function monthRange(monthKey: string): MonthRange {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label: `${MONTH_NAMES[month - 1] ?? monthRaw} ${year}`,
  };
}

/** Verilen ay anahtarının bir önceki ayını döndürür. */
export function previousMonthKey(monthKey: string): string {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Bugünün ay anahtarı. */
export function currentMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Son N ay için seçim listesi üretir (yeni → eski). */
export function recentMonthKeys(count = 12, now = new Date()): { key: string; label: string }[] {
  const list: { key: string; label: string }[] = [];
  for (let index = 0; index < count; index += 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    list.push({ key, label: monthRange(key).label });
  }
  return list;
}

function num(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0;
}

export type ReportTotals = {
  revenue: number;
  orders: number;
  subtotal: number;
  discounts: number;
  shipping: number;
  averageOrderValue: number;
  paidOrders: number;
  cancelledOrders: number;
  units: number;
  uniqueCustomers: number;
};

/** Ay toplamlarını hesaplar; iptal edilen siparişler ciroya katılmaz. */
export function computeTotals(orders: ReportOrder[], items: ReportItem[]): ReportTotals {
  const valid = orders.filter((order) => (order.status ?? "") !== "cancelled");
  const revenue = valid.reduce((sum, order) => sum + num(order.grand_total), 0);
  const emails = new Set(
    valid.map((order) => (order.customer_email ?? "").toLowerCase()).filter(Boolean),
  );
  return {
    revenue,
    orders: valid.length,
    subtotal: valid.reduce((sum, order) => sum + num(order.subtotal), 0),
    discounts: valid.reduce((sum, order) => sum + num(order.discount_total), 0),
    shipping: valid.reduce((sum, order) => sum + num(order.shipping_total), 0),
    averageOrderValue: valid.length ? revenue / valid.length : 0,
    paidOrders: valid.filter((order) => (order.payment_status ?? "") === "paid").length,
    cancelledOrders: orders.length - valid.length,
    units: items.reduce((sum, item) => sum + num(item.quantity), 0),
    uniqueCustomers: emails.size,
  };
}

/** İki dönem arasında yüzde değişim (önceki 0 ise null). */
export function delta(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export type TopProductLine = {
  title: string;
  units: number;
  revenue: number;
  share: number;
};

/** Ciroya göre en çok satan ürünleri sıralar. */
export function topProducts(items: ReportItem[], limit = 10): TopProductLine[] {
  const map = new Map<string, { title: string; units: number; revenue: number }>();
  for (const item of items) {
    const title = item.title ?? "Ürün";
    const key = item.product_id ? String(item.product_id) : title;
    const current = map.get(key) ?? { title, units: 0, revenue: 0 };
    current.units += num(item.quantity);
    current.revenue += num(item.line_total);
    map.set(key, current);
  }
  const lines = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  const total = lines.reduce((sum, line) => sum + line.revenue, 0);
  return lines.slice(0, limit).map((line) => ({
    ...line,
    share: total ? (line.revenue / total) * 100 : 0,
  }));
}

export type DailyLine = { date: string; revenue: number; orders: number };

/** Ay içindeki günlük ciro serisini üretir (boş günler 0). */
export function dailyBreakdown(orders: ReportOrder[], range: MonthRange): DailyLine[] {
  const start = new Date(range.start);
  const end = new Date(range.end);
  const buckets = new Map<string, DailyLine>();
  for (let cursor = new Date(start); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const key = cursor.toISOString().slice(0, 10);
    buckets.set(key, { date: key, revenue: 0, orders: 0 });
  }
  for (const order of orders) {
    if ((order.status ?? "") === "cancelled") continue;
    const key = (order.placed_at ?? order.created_at).slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += num(order.grand_total);
    bucket.orders += 1;
  }
  return [...buckets.values()];
}

/** En yüksek ciroyu getiren günü döndürür. */
export function bestDay(lines: DailyLine[]): DailyLine | null {
  if (!lines.length) return null;
  return lines.reduce((best, line) => (line.revenue > best.revenue ? line : best), lines[0]);
}

/** Kullanılan kupon kodlarının performansı. */
export function couponUsage(orders: ReportOrder[]) {
  const map = new Map<string, { code: string; orders: number; discount: number }>();
  for (const order of orders) {
    const code = (order.discount_code ?? "").trim();
    if (!code) continue;
    const current = map.get(code) ?? { code, orders: 0, discount: 0 };
    current.orders += 1;
    current.discount += num(order.discount_total);
    map.set(code, current);
  }
  return [...map.values()].sort((a, b) => b.discount - a.discount);
}
