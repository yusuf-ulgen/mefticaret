/** Müşteri yaşam boyu değeri (LTV) hesaplamaları: saf fonksiyonlar. */

export type LtvOrder = {
  customer_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  grand_total: number | string | null;
  placed_at: string | null;
  created_at: string;
  status: string | null;
};

export type LtvCustomer = {
  key: string;
  name: string;
  email: string | null;
  orders: number;
  revenue: number;
  averageOrderValue: number;
  firstOrderAt: string;
  lastOrderAt: string;
  /** İlk ve son sipariş arasındaki gün sayısı. */
  lifespanDays: number;
  /** Ortalama sipariş aralığı (gün); tek siparişliler için null. */
  purchaseIntervalDays: number | null;
};

const DAY = 86_400_000;

function num(value: number | string | null | undefined) {
  return Number(value ?? 0) || 0;
}

/** Siparişleri müşteri bazında toplar; iptaller hariç tutulur. */
export function buildLtvCustomers(orders: LtvOrder[]): LtvCustomer[] {
  const map = new Map<
    string,
    { name: string; email: string | null; dates: number[]; revenue: number }
  >();

  for (const order of orders) {
    if ((order.status ?? "") === "cancelled") continue;
    const key =
      (order.customer_id && String(order.customer_id)) ||
      (order.customer_email ?? "").toLowerCase() ||
      null;
    if (!key) continue;
    const at = new Date(order.placed_at ?? order.created_at).getTime();
    if (Number.isNaN(at)) continue;
    const current =
      map.get(key) ??
      {
        name: order.customer_name?.trim() || order.customer_email || "Misafir",
        email: order.customer_email ?? null,
        dates: [] as number[],
        revenue: 0,
      };
    current.dates.push(at);
    current.revenue += num(order.grand_total);
    if (!current.email && order.customer_email) current.email = order.customer_email;
    map.set(key, current);
  }

  const list: LtvCustomer[] = [];
  for (const [key, value] of map) {
    const sorted = [...value.dates].sort((a, b) => a - b);
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const lifespanDays = Math.max(0, Math.round((last - first) / DAY));
    list.push({
      key,
      name: value.name,
      email: value.email,
      orders: sorted.length,
      revenue: value.revenue,
      averageOrderValue: value.revenue / sorted.length,
      firstOrderAt: new Date(first).toISOString(),
      lastOrderAt: new Date(last).toISOString(),
      lifespanDays,
      purchaseIntervalDays: sorted.length > 1 ? lifespanDays / (sorted.length - 1) : null,
    });
  }
  return list.sort((a, b) => b.revenue - a.revenue);
}

export type LtvSummary = {
  customers: number;
  revenue: number;
  averageLtv: number;
  medianLtv: number;
  averageOrderValue: number;
  averageFrequency: number;
  repeatRate: number;
  /** AOV x sipariş frekansı x tahmini ömür (yıl) ile öngörülen değer. */
  predictedLtv: number;
  topShare: number;
};

/** Genel LTV özetini üretir. */
export function ltvSummary(customers: LtvCustomer[], horizonMonths = 12): LtvSummary {
  const count = customers.length;
  if (!count) {
    return {
      customers: 0,
      revenue: 0,
      averageLtv: 0,
      medianLtv: 0,
      averageOrderValue: 0,
      averageFrequency: 0,
      repeatRate: 0,
      predictedLtv: 0,
      topShare: 0,
    };
  }
  const revenue = customers.reduce((sum, customer) => sum + customer.revenue, 0);
  const orders = customers.reduce((sum, customer) => sum + customer.orders, 0);
  const sortedRevenue = customers.map((customer) => customer.revenue).sort((a, b) => a - b);
  const mid = Math.floor(count / 2);
  const medianLtv =
    count % 2 === 0 ? ((sortedRevenue[mid - 1] ?? 0) + (sortedRevenue[mid] ?? 0)) / 2 : sortedRevenue[mid] ?? 0;

  const averageOrderValue = orders ? revenue / orders : 0;
  const averageFrequency = orders / count;
  const repeatCustomers = customers.filter((customer) => customer.orders > 1).length;

  const intervals = customers
    .map((customer) => customer.purchaseIntervalDays)
    .filter((value): value is number => value !== null && value > 0);
  const averageInterval = intervals.length
    ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
    : 0;
  const expectedOrders = averageInterval ? (horizonMonths * 30) / averageInterval : averageFrequency;

  const topCount = Math.max(1, Math.round(count * 0.2));
  const topShareRevenue = customers.slice(0, topCount).reduce((sum, customer) => sum + customer.revenue, 0);

  return {
    customers: count,
    revenue,
    averageLtv: revenue / count,
    medianLtv,
    averageOrderValue,
    averageFrequency,
    repeatRate: (repeatCustomers / count) * 100,
    predictedLtv: averageOrderValue * Math.max(expectedOrders, 1),
    topShare: revenue ? (topShareRevenue / revenue) * 100 : 0,
  };
}

/** Müşterileri harcama dilimlerine ayırır. */
export function ltvBuckets(customers: LtvCustomer[]) {
  const thresholds = [
    { label: "0 – 500", max: 500 },
    { label: "500 – 1.500", max: 1500 },
    { label: "1.500 – 5.000", max: 5000 },
    { label: "5.000 – 15.000", max: 15000 },
    { label: "15.000+", max: Infinity },
  ];
  return thresholds.map((bucket, index) => {
    const min = index === 0 ? 0 : thresholds[index - 1]!.max;
    const rows = customers.filter(
      (customer) => customer.revenue >= min && customer.revenue < bucket.max,
    );
    return {
      label: bucket.label,
      customers: rows.length,
      revenue: rows.reduce((sum, customer) => sum + customer.revenue, 0),
    };
  });
}
