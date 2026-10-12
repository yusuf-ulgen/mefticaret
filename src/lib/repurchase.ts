/** Tekrar satın alma analizi: ürün bazlı repeat oranı ve satın alma aralığı (cadence). */

export type RepurchaseLine = {
  orderId: string;
  customerKey: string;
  productId: string;
  productTitle: string;
  quantity: number;
  lineTotal: number;
  placedAt: string;
};

export type RepurchaseSummary = {
  customers: number;
  repeatCustomers: number;
  /** Aynı ürünü en az iki farklı siparişte alan müşteri oranı (%) */
  repurchaseRate: number;
  /** Ortalama tekrar satın alma aralığı (gün) */
  avgIntervalDays: number;
  medianIntervalDays: number;
  totalRevenue: number;
  repeatRevenue: number;
  /** Tekrar alımların ciro payı (%) */
  repeatRevenueShare: number;
};

const DAY = 1000 * 60 * 60 * 24;

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

type PairKey = string;

function groupByCustomerProduct(lines: RepurchaseLine[]) {
  const map = new Map<PairKey, RepurchaseLine[]>();
  for (const line of lines) {
    const key = `${line.customerKey}::${line.productId}`;
    const list = map.get(key) ?? [];
    list.push(line);
    map.set(key, list);
  }
  return map;
}

/** Aynı müşteri-ürün çiftinde farklı siparişlerin tarihleri (artan). */
function orderDates(lines: RepurchaseLine[]) {
  const byOrder = new Map<string, string>();
  for (const line of lines) byOrder.set(line.orderId, line.placedAt);
  return [...byOrder.values()].sort((a, b) => a.localeCompare(b));
}

export function repurchaseSummary(lines: RepurchaseLine[]): RepurchaseSummary {
  const pairs = groupByCustomerProduct(lines);
  const customers = new Set(lines.map((line) => line.customerKey));
  const repeatCustomers = new Set<string>();
  const intervals: number[] = [];
  let repeatRevenue = 0;
  let totalRevenue = 0;

  for (const line of lines) totalRevenue += line.lineTotal;

  for (const [key, pairLines] of pairs) {
    const dates = orderDates(pairLines);
    if (dates.length < 2) continue;
    repeatCustomers.add(key.split("::")[0]!);

    for (let i = 1; i < dates.length; i += 1) {
      const gap = (new Date(dates[i]!).getTime() - new Date(dates[i - 1]!).getTime()) / DAY;
      if (gap > 0) intervals.push(gap);
    }

    const firstOrder = dates[0];
    for (const line of pairLines) {
      if (line.orderId !== undefined && line.placedAt !== firstOrder) repeatRevenue += line.lineTotal;
    }
  }

  return {
    customers: customers.size,
    repeatCustomers: repeatCustomers.size,
    repurchaseRate: customers.size ? (repeatCustomers.size / customers.size) * 100 : 0,
    avgIntervalDays: intervals.length
      ? intervals.reduce((sum, gap) => sum + gap, 0) / intervals.length
      : 0,
    medianIntervalDays: median(intervals),
    totalRevenue,
    repeatRevenue,
    repeatRevenueShare: totalRevenue > 0 ? (repeatRevenue / totalRevenue) * 100 : 0,
  };
}

export type ProductRepurchase = {
  productId: string;
  productTitle: string;
  buyers: number;
  repeatBuyers: number;
  repurchaseRate: number;
  orders: number;
  revenue: number;
  /** Ortalama tekrar alım aralığı (gün) */
  avgIntervalDays: number;
  /** Müşteri başına ortalama sipariş sayısı */
  ordersPerBuyer: number;
};

export function productRepurchase(lines: RepurchaseLine[]): ProductRepurchase[] {
  const byProduct = new Map<string, RepurchaseLine[]>();
  for (const line of lines) {
    const list = byProduct.get(line.productId) ?? [];
    list.push(line);
    byProduct.set(line.productId, list);
  }

  const rows: ProductRepurchase[] = [];

  for (const [productId, productLines] of byProduct) {
    const byCustomer = new Map<string, RepurchaseLine[]>();
    for (const line of productLines) {
      const list = byCustomer.get(line.customerKey) ?? [];
      list.push(line);
      byCustomer.set(line.customerKey, list);
    }

    let repeatBuyers = 0;
    const intervals: number[] = [];
    const orders = new Set(productLines.map((line) => line.orderId));

    for (const customerLines of byCustomer.values()) {
      const dates = orderDates(customerLines);
      if (dates.length < 2) continue;
      repeatBuyers += 1;
      for (let i = 1; i < dates.length; i += 1) {
        const gap = (new Date(dates[i]!).getTime() - new Date(dates[i - 1]!).getTime()) / DAY;
        if (gap > 0) intervals.push(gap);
      }
    }

    rows.push({
      productId,
      productTitle: productLines[0]!.productTitle,
      buyers: byCustomer.size,
      repeatBuyers,
      repurchaseRate: byCustomer.size ? (repeatBuyers / byCustomer.size) * 100 : 0,
      orders: orders.size,
      revenue: productLines.reduce((sum, line) => sum + line.lineTotal, 0),
      avgIntervalDays: intervals.length
        ? intervals.reduce((sum, gap) => sum + gap, 0) / intervals.length
        : 0,
      ordersPerBuyer: byCustomer.size ? orders.size / byCustomer.size : 0,
    });
  }

  return rows.sort((a, b) => b.revenue - a.revenue);
}

export type IntervalBand = {
  label: string;
  count: number;
  share: number;
};

const INTERVAL_BANDS: Array<{ label: string; maxDays: number }> = [
  { label: "0-14 gün", maxDays: 14 },
  { label: "15-30 gün", maxDays: 30 },
  { label: "31-60 gün", maxDays: 60 },
  { label: "61-120 gün", maxDays: 120 },
  { label: "120 gün+", maxDays: Number.POSITIVE_INFINITY },
];

export function intervalBands(lines: RepurchaseLine[]): IntervalBand[] {
  const pairs = groupByCustomerProduct(lines);
  const counts = INTERVAL_BANDS.map(() => 0);
  let total = 0;

  for (const pairLines of pairs.values()) {
    const dates = orderDates(pairLines);
    for (let i = 1; i < dates.length; i += 1) {
      const gap = (new Date(dates[i]!).getTime() - new Date(dates[i - 1]!).getTime()) / DAY;
      if (gap <= 0) continue;
      const index = INTERVAL_BANDS.findIndex((band) => gap <= band.maxDays);
      counts[index === -1 ? INTERVAL_BANDS.length - 1 : index]! += 1;
      total += 1;
    }
  }

  return INTERVAL_BANDS.map((band, index) => ({
    label: band.label,
    count: counts[index]!,
    share: total > 0 ? (counts[index]! / total) * 100 : 0,
  }));
}

export type ReminderCandidate = {
  productId: string;
  productTitle: string;
  customerKey: string;
  lastPurchaseAt: string;
  daysSincePurchase: number;
  expectedIntervalDays: number;
  /** Beklenen aralığın ne kadar üzerinde (gün) */
  overdueDays: number;
};

/**
 * Ürünün ortalama tekrar alım aralığını geçmiş ama tekrar sipariş vermemiş
 * müşteri-ürün çiftlerini döner: hatırlatma kampanyası hedef listesi.
 */
export function reminderCandidates(
  lines: RepurchaseLine[],
  now = Date.now(),
): ReminderCandidate[] {
  const products = new Map(productRepurchase(lines).map((row) => [row.productId, row]));
  const pairs = groupByCustomerProduct(lines);
  const candidates: ReminderCandidate[] = [];

  for (const [key, pairLines] of pairs) {
    const product = products.get(pairLines[0]!.productId);
    if (!product || product.avgIntervalDays <= 0) continue;

    const dates = orderDates(pairLines);
    const last = dates[dates.length - 1]!;
    const daysSince = (now - new Date(last).getTime()) / DAY;
    const overdue = daysSince - product.avgIntervalDays;
    if (overdue <= 0) continue;

    candidates.push({
      productId: product.productId,
      productTitle: product.productTitle,
      customerKey: key.split("::")[0]!,
      lastPurchaseAt: last,
      daysSincePurchase: Math.round(daysSince),
      expectedIntervalDays: Math.round(product.avgIntervalDays),
      overdueDays: Math.round(overdue),
    });
  }

  return candidates.sort((a, b) => b.overdueDays - a.overdueDays);
}
