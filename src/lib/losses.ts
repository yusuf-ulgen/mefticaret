/**
 * İptal & kayıp analizi — saf hesaplama katmanı.
 *
 * İptal edilen, geri ödenen ve ödemesi başarısız olan siparişlerden doğan
 * ciro kaybı; kayıp oranı, sebep kırılımı (durum bazlı), aylık trend ve
 * en çok kayıp yaşanan ürünler hesaplanır.
 */

export type LossOrderInput = {
  id: string;
  orderNumber: string;
  placedAt: string;
  status: string;
  paymentStatus: string;
  grandTotal: number;
  customerName: string | null;
  discountCode: string | null;
};

export type LossItemInput = {
  orderId: string;
  productId: string | null;
  title: string;
  quantity: number;
  lineTotal: number;
};

export type LossKind = "cancelled" | "refunded" | "payment_failed" | "payment_pending";

export const LOSS_LABELS: Record<LossKind, string> = {
  cancelled: "İptal edildi",
  refunded: "Geri ödendi",
  payment_failed: "Ödeme başarısız",
  payment_pending: "Ödeme bekliyor (bayat)",
};

export type LossRow = {
  id: string;
  orderNumber: string;
  placedAt: string;
  customerName: string;
  amount: number;
  kind: LossKind;
  discountCode: string | null;
};

export type LossSummary = {
  totalOrders: number;
  totalRevenue: number;
  lostOrders: number;
  lostRevenue: number;
  /** Kayıp ciro / (kayıp + gerçekleşen) */
  lossRate: number;
  orderLossRate: number;
  avgLostOrderValue: number;
  recoverableRevenue: number;
};

export type LossAnalysis = {
  summary: LossSummary;
  rows: LossRow[];
  byKind: { kind: LossKind; label: string; orders: number; amount: number; share: number }[];
  byMonth: { month: string; lostAmount: number; wonAmount: number; lostOrders: number; lossRate: number }[];
  topProducts: { productId: string; title: string; units: number; amount: number; orders: number }[];
};

/** Bayat kabul edilen ödeme bekleyen sipariş yaşı (saat). */
export const STALE_PENDING_HOURS = 72;

const classify = (order: LossOrderInput, now: number): LossKind | null => {
  if (order.status === "cancelled") return "cancelled";
  if (order.status === "refunded" || order.paymentStatus === "refunded") return "refunded";
  if (order.paymentStatus === "failed") return "payment_failed";
  if (order.paymentStatus === "pending") {
    const age = (now - new Date(order.placedAt).getTime()) / (1000 * 60 * 60);
    if (age > STALE_PENDING_HOURS) return "payment_pending";
  }
  return null;
};

export function analyzeLosses(
  orders: LossOrderInput[],
  items: LossItemInput[] = [],
  now: Date = new Date(),
): LossAnalysis {
  const nowMs = now.getTime();
  const rows: LossRow[] = [];
  let wonRevenue = 0;
  let wonOrders = 0;

  const monthMap = new Map<string, { lostAmount: number; wonAmount: number; lostOrders: number }>();
  const bump = (month: string) =>
    monthMap.get(month) ?? { lostAmount: 0, wonAmount: 0, lostOrders: 0 };

  for (const order of orders) {
    const month = order.placedAt.slice(0, 7);
    const entry = bump(month);
    const kind = classify(order, nowMs);

    if (kind) {
      rows.push({
        id: order.id,
        orderNumber: order.orderNumber,
        placedAt: order.placedAt,
        customerName: order.customerName ?? "Misafir",
        amount: order.grandTotal,
        kind,
        discountCode: order.discountCode,
      });
      entry.lostAmount += order.grandTotal;
      entry.lostOrders += 1;
    } else {
      wonRevenue += order.grandTotal;
      wonOrders += 1;
      entry.wonAmount += order.grandTotal;
    }
    monthMap.set(month, entry);
  }

  rows.sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());

  const lostRevenue = rows.reduce((sum, row) => sum + row.amount, 0);
  const kindMap = new Map<LossKind, { orders: number; amount: number }>();
  for (const row of rows) {
    const entry = kindMap.get(row.kind) ?? { orders: 0, amount: 0 };
    entry.orders += 1;
    entry.amount += row.amount;
    kindMap.set(row.kind, entry);
  }

  const byKind = (Object.keys(LOSS_LABELS) as LossKind[])
    .map((kind) => {
      const entry = kindMap.get(kind) ?? { orders: 0, amount: 0 };
      return {
        kind,
        label: LOSS_LABELS[kind],
        orders: entry.orders,
        amount: entry.amount,
        share: lostRevenue > 0 ? entry.amount / lostRevenue : 0,
      };
    })
    .filter((entry) => entry.orders > 0)
    .sort((a, b) => b.amount - a.amount);

  const lostIds = new Set(rows.map((row) => row.id));
  const productMap = new Map<string, { title: string; units: number; amount: number; orders: Set<string> }>();
  for (const item of items) {
    if (!lostIds.has(item.orderId)) continue;
    const key = item.productId ?? item.title;
    const entry =
      productMap.get(key) ?? { title: item.title, units: 0, amount: 0, orders: new Set<string>() };
    entry.units += item.quantity;
    entry.amount += item.lineTotal;
    entry.orders.add(item.orderId);
    productMap.set(key, entry);
  }

  const topProducts = [...productMap.entries()]
    .map(([productId, entry]) => ({
      productId,
      title: entry.title,
      units: entry.units,
      amount: entry.amount,
      orders: entry.orders.size,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 20);

  const byMonth = [...monthMap.entries()]
    .map(([month, entry]) => ({
      month,
      lostAmount: entry.lostAmount,
      wonAmount: entry.wonAmount,
      lostOrders: entry.lostOrders,
      lossRate:
        entry.lostAmount + entry.wonAmount > 0
          ? entry.lostAmount / (entry.lostAmount + entry.wonAmount)
          : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const recoverable = rows
    .filter((row) => row.kind === "payment_failed" || row.kind === "payment_pending")
    .reduce((sum, row) => sum + row.amount, 0);

  const summary: LossSummary = {
    totalOrders: orders.length,
    totalRevenue: wonRevenue,
    lostOrders: rows.length,
    lostRevenue,
    lossRate: lostRevenue + wonRevenue > 0 ? lostRevenue / (lostRevenue + wonRevenue) : 0,
    orderLossRate: orders.length ? rows.length / orders.length : 0,
    avgLostOrderValue: rows.length ? lostRevenue / rows.length : 0,
    recoverableRevenue: recoverable,
  };

  void wonOrders;
  return { summary, rows, byKind, byMonth, topProducts };
}
