/**
 * Kargo & teslimat performansı — saf hesaplama katmanı.
 *
 * Teslim süresi = delivered_at - shipped_at (gün).
 * Sevk süresi = shipped_at - sipariş tarihi (gün).
 */

export type ShipmentRow = {
  id: string;
  carrier: string;
  status: string;
  createdAt: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  orderPlacedAt: string | null;
};

export type CarrierPerformance = {
  carrier: string;
  shipments: number;
  delivered: number;
  returned: number;
  inTransit: number;
  deliveryRate: number;
  returnRate: number;
  avgDispatchDays: number | null;
  avgDeliveryDays: number | null;
};

export type LogisticsSummary = {
  total: number;
  delivered: number;
  inTransit: number;
  pending: number;
  returned: number;
  deliveryRate: number;
  avgDispatchDays: number | null;
  avgDeliveryDays: number | null;
  slowShipments: number;
};

const DAY = 86_400_000;

function diffDays(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const value = (new Date(to).getTime() - new Date(from).getTime()) / DAY;
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function dispatchDays(row: ShipmentRow): number | null {
  return diffDays(row.orderPlacedAt ?? row.createdAt, row.shippedAt);
}

export function deliveryDays(row: ShipmentRow): number | null {
  return diffDays(row.shippedAt ?? row.createdAt, row.deliveredAt);
}

/** 7 günden uzun süredir yolda olan, teslim edilmemiş sevkiyat sayısı. */
export function isSlow(row: ShipmentRow, thresholdDays = 7): boolean {
  if (row.status === "delivered" || row.status === "cancelled") return false;
  const reference = row.shippedAt ?? row.createdAt;
  return (Date.now() - new Date(reference).getTime()) / DAY > thresholdDays;
}

export function logisticsSummary(rows: ShipmentRow[], slowThreshold = 7): LogisticsSummary {
  const delivered = rows.filter((row) => row.status === "delivered");
  return {
    total: rows.length,
    delivered: delivered.length,
    inTransit: rows.filter((row) => row.status === "in_transit").length,
    pending: rows.filter((row) => row.status === "pending").length,
    returned: rows.filter((row) => row.status === "returned").length,
    deliveryRate: rows.length > 0 ? delivered.length / rows.length : 0,
    avgDispatchDays: mean(rows.map(dispatchDays).filter((v): v is number => v != null)),
    avgDeliveryDays: mean(delivered.map(deliveryDays).filter((v): v is number => v != null)),
    slowShipments: rows.filter((row) => isSlow(row, slowThreshold)).length,
  };
}

export function carrierPerformance(rows: ShipmentRow[]): CarrierPerformance[] {
  const groups = new Map<string, ShipmentRow[]>();
  for (const row of rows) {
    const key = row.carrier || "Belirtilmemiş";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()]
    .map(([carrier, list]) => {
      const delivered = list.filter((row) => row.status === "delivered");
      const returned = list.filter((row) => row.status === "returned");
      return {
        carrier,
        shipments: list.length,
        delivered: delivered.length,
        returned: returned.length,
        inTransit: list.filter((row) => row.status === "in_transit").length,
        deliveryRate: list.length > 0 ? delivered.length / list.length : 0,
        returnRate: list.length > 0 ? returned.length / list.length : 0,
        avgDispatchDays: mean(list.map(dispatchDays).filter((v): v is number => v != null)),
        avgDeliveryDays: mean(delivered.map(deliveryDays).filter((v): v is number => v != null)),
      };
    })
    .sort((a, b) => b.shipments - a.shipments);
}
