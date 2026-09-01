/** Tahsilat takibi: ödeme durumu bazlı bekleyen ciro, tahsilat süresi ve yaşlandırma. */

export type ReceivableOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  paymentStatus: string;
  status: string;
  grandTotal: number;
  placedAt: string;
  updatedAt: string;
};

const DAY = 1000 * 60 * 60 * 24;

const PAID = new Set(["paid", "partially_refunded"]);
const OPEN = new Set(["pending", "authorized"]);
const LOST = new Set(["failed", "voided", "refunded"]);

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

export type ReceivableSummary = {
  totalOrders: number;
  paidRevenue: number;
  openRevenue: number;
  lostRevenue: number;
  openCount: number;
  /** Tahsil edilen ciro / (tahsil + bekleyen) oranı (%) */
  collectionRate: number;
  /** Sipariş tarihinden ödeme kaydına kadar ortalama süre (gün) */
  avgCollectionDays: number;
  medianCollectionDays: number;
  /** Başarısız + iptal edilen ödeme oranı (%) */
  failureRate: number;
};

export function receivableSummary(orders: ReceivableOrder[]): ReceivableSummary {
  let paidRevenue = 0;
  let openRevenue = 0;
  let lostRevenue = 0;
  let openCount = 0;
  const durations: number[] = [];

  for (const order of orders) {
    if (PAID.has(order.paymentStatus)) {
      paidRevenue += order.grandTotal;
      const gap = (new Date(order.updatedAt).getTime() - new Date(order.placedAt).getTime()) / DAY;
      if (gap >= 0) durations.push(gap);
    } else if (OPEN.has(order.paymentStatus)) {
      openRevenue += order.grandTotal;
      openCount += 1;
    } else if (LOST.has(order.paymentStatus)) {
      lostRevenue += order.grandTotal;
    }
  }

  const base = paidRevenue + openRevenue;
  const lostOrders = orders.filter((order) => LOST.has(order.paymentStatus)).length;

  return {
    totalOrders: orders.length,
    paidRevenue,
    openRevenue,
    lostRevenue,
    openCount,
    collectionRate: base > 0 ? (paidRevenue / base) * 100 : 0,
    avgCollectionDays: durations.length
      ? durations.reduce((sum, value) => sum + value, 0) / durations.length
      : 0,
    medianCollectionDays: median(durations),
    failureRate: orders.length ? (lostOrders / orders.length) * 100 : 0,
  };
}

export type AgingBucket = {
  label: string;
  count: number;
  amount: number;
  share: number;
};

const BUCKETS: Array<{ label: string; maxDays: number }> = [
  { label: "0-3 gün", maxDays: 3 },
  { label: "4-7 gün", maxDays: 7 },
  { label: "8-14 gün", maxDays: 14 },
  { label: "15-30 gün", maxDays: 30 },
  { label: "30 gün+", maxDays: Number.POSITIVE_INFINITY },
];

/** Bekleyen ödemelerin sipariş tarihine göre yaşlandırması. */
export function receivableAging(orders: ReceivableOrder[], now = Date.now()): AgingBucket[] {
  const counts = BUCKETS.map(() => 0);
  const amounts = BUCKETS.map(() => 0);
  let total = 0;

  for (const order of orders) {
    if (!OPEN.has(order.paymentStatus)) continue;
    const age = (now - new Date(order.placedAt).getTime()) / DAY;
    const index = BUCKETS.findIndex((bucket) => age <= bucket.maxDays);
    const slot = index === -1 ? BUCKETS.length - 1 : index;
    counts[slot]! += 1;
    amounts[slot]! += order.grandTotal;
    total += order.grandTotal;
  }

  return BUCKETS.map((bucket, index) => ({
    label: bucket.label,
    count: counts[index]!,
    amount: amounts[index]!,
    share: total > 0 ? (amounts[index]! / total) * 100 : 0,
  }));
}

export type StatusBreakdown = {
  paymentStatus: string;
  count: number;
  amount: number;
  share: number;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Bekliyor",
  authorized: "Provizyon",
  paid: "Ödendi",
  partially_refunded: "Kısmi iade",
  refunded: "İade edildi",
  failed: "Başarısız",
  voided: "İptal",
};

export function statusLabel(value: string) {
  return STATUS_LABELS[value] ?? value;
}

export function statusBreakdown(orders: ReceivableOrder[]): StatusBreakdown[] {
  const map = new Map<string, { count: number; amount: number }>();
  let total = 0;
  for (const order of orders) {
    const entry = map.get(order.paymentStatus) ?? { count: 0, amount: 0 };
    entry.count += 1;
    entry.amount += order.grandTotal;
    map.set(order.paymentStatus, entry);
    total += order.grandTotal;
  }
  return [...map.entries()]
    .map(([paymentStatus, entry]) => ({
      paymentStatus,
      count: entry.count,
      amount: entry.amount,
      share: total > 0 ? (entry.amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export type OverdueOrder = ReceivableOrder & { ageDays: number };

/** Belirlenen gün eşiğini aşmış, hâlâ ödenmemiş siparişler. */
export function overdueOrders(
  orders: ReceivableOrder[],
  thresholdDays = 3,
  now = Date.now(),
): OverdueOrder[] {
  return orders
    .filter((order) => OPEN.has(order.paymentStatus))
    .map((order) => ({
      ...order,
      ageDays: Math.round((now - new Date(order.placedAt).getTime()) / DAY),
    }))
    .filter((order) => order.ageDays >= thresholdDays)
    .sort((a, b) => b.ageDays - a.ageDays || b.grandTotal - a.grandTotal);
}
