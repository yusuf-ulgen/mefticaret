/**
 * Sipariş karşılama (fulfillment) SLA analizi — saf hesaplama katmanı.
 *
 * Sipariş oluşturma → sevkiyat açma → kargoya verme → teslim adımları arasındaki
 * süreler saat bazında ölçülür; hedef sürelerin aşıldığı siparişler işaretlenir.
 */

export type SlaOrderInput = {
  id: string;
  orderNumber: string;
  placedAt: string;
  status: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  grandTotal: number;
  customerName: string | null;
};

export type SlaShipmentInput = {
  orderId: string;
  createdAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  carrier: string | null;
};

export type SlaTargets = {
  /** Sipariş → sevkiyat oluşturma hedefi (saat) */
  handling: number;
  /** Sevkiyat → kargoya teslim hedefi (saat) */
  dispatch: number;
  /** Kargoya teslim → müşteriye teslim hedefi (saat) */
  delivery: number;
};

export const DEFAULT_SLA_TARGETS: SlaTargets = { handling: 24, dispatch: 24, delivery: 72 };

export type SlaOrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  placedAt: string;
  status: string;
  grandTotal: number;
  carrier: string | null;
  /** Sipariş → sevkiyat (saat) */
  handlingHours: number | null;
  /** Sevkiyat → kargoya verme (saat) */
  dispatchHours: number | null;
  /** Kargoya verme → teslim (saat) */
  deliveryHours: number | null;
  /** Sipariş → teslim toplam (saat) */
  totalHours: number | null;
  /** Henüz sevkiyatı olmayan siparişin bekleme süresi (saat) */
  pendingHours: number | null;
  breached: boolean;
  breachReasons: string[];
};

export type SlaSummary = {
  orders: number;
  shippedOrders: number;
  deliveredOrders: number;
  openOrders: number;
  avgHandling: number | null;
  avgDispatch: number | null;
  avgDelivery: number | null;
  avgTotal: number | null;
  onTimeRate: number;
  breachedCount: number;
  atRiskValue: number;
};

export type SlaCarrierRow = {
  carrier: string;
  shipments: number;
  delivered: number;
  avgDispatch: number | null;
  avgDelivery: number | null;
  onTimeRate: number;
};

export type SlaAnalysis = {
  summary: SlaSummary;
  rows: SlaOrderRow[];
  carriers: SlaCarrierRow[];
  /** Gün bazlı ortalama karşılama süresi trendi */
  trend: { date: string; avgHandling: number; orders: number }[];
};

const HOUR = 1000 * 60 * 60;

const diffHours = (from: string | null, to: string | null): number | null => {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const value = (b - a) / HOUR;
  return value < 0 ? 0 : Math.round(value * 10) / 10;
};

const mean = (values: number[]): number | null =>
  values.length ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10 : null;

export function analyzeSla(
  orders: SlaOrderInput[],
  shipments: SlaShipmentInput[],
  targets: SlaTargets = DEFAULT_SLA_TARGETS,
  now: Date = new Date(),
): SlaAnalysis {
  const byOrder = new Map<string, SlaShipmentInput>();
  for (const shipment of shipments) {
    const current = byOrder.get(shipment.orderId);
    if (!current || new Date(shipment.createdAt) < new Date(current.createdAt)) {
      byOrder.set(shipment.orderId, shipment);
    }
  }

  const cancelled = new Set(["cancelled", "refunded"]);
  const rows: SlaOrderRow[] = orders
    .filter((order) => !cancelled.has(order.status))
    .map((order) => {
      const shipment = byOrder.get(order.id) ?? null;
      const handlingHours = shipment ? diffHours(order.placedAt, shipment.createdAt) : null;
      const dispatchHours = shipment ? diffHours(shipment.createdAt, shipment.shippedAt) : null;
      const deliveryHours = shipment ? diffHours(shipment.shippedAt, shipment.deliveredAt) : null;
      const totalHours = shipment ? diffHours(order.placedAt, shipment.deliveredAt) : null;
      const pendingHours = shipment ? null : diffHours(order.placedAt, now.toISOString());

      const breachReasons: string[] = [];
      if (handlingHours !== null && handlingHours > targets.handling) {
        breachReasons.push(`Karşılama ${handlingHours} sa (hedef ${targets.handling} sa)`);
      }
      if (pendingHours !== null && pendingHours > targets.handling) {
        breachReasons.push(`${pendingHours} sa sevkiyat bekliyor`);
      }
      if (dispatchHours !== null && dispatchHours > targets.dispatch) {
        breachReasons.push(`Kargoya verme ${dispatchHours} sa (hedef ${targets.dispatch} sa)`);
      }
      if (deliveryHours !== null && deliveryHours > targets.delivery) {
        breachReasons.push(`Teslim ${deliveryHours} sa (hedef ${targets.delivery} sa)`);
      }

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName ?? "Misafir",
        placedAt: order.placedAt,
        status: order.status,
        grandTotal: order.grandTotal,
        carrier: shipment?.carrier ?? null,
        handlingHours,
        dispatchHours,
        deliveryHours,
        totalHours,
        pendingHours,
        breached: breachReasons.length > 0,
        breachReasons,
      };
    })
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());

  const shippedOrders = rows.filter((row) => row.handlingHours !== null).length;
  const deliveredOrders = rows.filter((row) => row.totalHours !== null).length;
  const breached = rows.filter((row) => row.breached);

  const summary: SlaSummary = {
    orders: rows.length,
    shippedOrders,
    deliveredOrders,
    openOrders: rows.filter((row) => row.pendingHours !== null).length,
    avgHandling: mean(rows.map((r) => r.handlingHours).filter((v): v is number => v !== null)),
    avgDispatch: mean(rows.map((r) => r.dispatchHours).filter((v): v is number => v !== null)),
    avgDelivery: mean(rows.map((r) => r.deliveryHours).filter((v): v is number => v !== null)),
    avgTotal: mean(rows.map((r) => r.totalHours).filter((v): v is number => v !== null)),
    onTimeRate: rows.length ? (rows.length - breached.length) / rows.length : 1,
    breachedCount: breached.length,
    atRiskValue: breached.reduce((sum, row) => sum + row.grandTotal, 0),
  };

  const carrierMap = new Map<string, { dispatch: number[]; delivery: number[]; count: number; delivered: number; onTime: number }>();
  for (const row of rows) {
    if (!row.carrier) continue;
    const entry =
      carrierMap.get(row.carrier) ??
      { dispatch: [], delivery: [], count: 0, delivered: 0, onTime: 0 };
    entry.count += 1;
    if (row.dispatchHours !== null) entry.dispatch.push(row.dispatchHours);
    if (row.deliveryHours !== null) {
      entry.delivery.push(row.deliveryHours);
      entry.delivered += 1;
    }
    if (!row.breached) entry.onTime += 1;
    carrierMap.set(row.carrier, entry);
  }

  const carriers: SlaCarrierRow[] = [...carrierMap.entries()]
    .map(([carrier, entry]) => ({
      carrier,
      shipments: entry.count,
      delivered: entry.delivered,
      avgDispatch: mean(entry.dispatch),
      avgDelivery: mean(entry.delivery),
      onTimeRate: entry.count ? entry.onTime / entry.count : 0,
    }))
    .sort((a, b) => b.shipments - a.shipments);

  const trendMap = new Map<string, { total: number; count: number }>();
  for (const row of rows) {
    if (row.handlingHours === null) continue;
    const date = row.placedAt.slice(0, 10);
    const entry = trendMap.get(date) ?? { total: 0, count: 0 };
    entry.total += row.handlingHours;
    entry.count += 1;
    trendMap.set(date, entry);
  }

  const trend = [...trendMap.entries()]
    .map(([date, entry]) => ({
      date,
      orders: entry.count,
      avgHandling: Math.round((entry.total / entry.count) * 10) / 10,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { summary, rows, carriers, trend };
}
