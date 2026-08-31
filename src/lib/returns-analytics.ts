/**
 * İade analizi — saf hesaplama katmanı.
 *
 * İade oranı = dönem içindeki iade talebi sayısı / dönem sipariş sayısı.
 * Tutar oranı = onaylanan/iade edilen tutar / dönem cirosu.
 */

import type { ReturnReason, ReturnStatus } from "@/lib/returns-queries";
import { RETURN_REASON_LABELS, RETURN_STATUS_LABELS } from "@/lib/returns-queries";

export type ReturnAnalyticsInput = {
  returns: {
    id: string;
    createdAt: string;
    resolvedAt: string | null;
    status: ReturnStatus;
    reason: ReturnReason;
    refundAmount: number;
    items: { title: string; variantTitle: string | null; quantity: number; lineTotal: number }[];
  }[];
  orders: { id: string; placedAt: string; grandTotal: number }[];
};

export type ReturnAnalyticsSummary = {
  returnCount: number;
  orderCount: number;
  returnRate: number;
  refundedAmount: number;
  requestedAmount: number;
  revenue: number;
  refundRate: number;
  averageRefund: number;
  averageResolutionDays: number | null;
  restockedRate: number;
};

export type ReasonBreakdown = {
  reason: ReturnReason;
  label: string;
  count: number;
  amount: number;
  share: number;
};

export type StatusBreakdown = {
  status: ReturnStatus;
  label: string;
  count: number;
  amount: number;
};

export type ReturnedProductLine = {
  title: string;
  quantity: number;
  amount: number;
  returnCount: number;
};

export type ReturnTrendPoint = {
  day: string;
  returns: number;
  amount: number;
};

const REFUNDING_STATUSES: ReturnStatus[] = ["received", "refunded"];

export function returnAnalyticsSummary(input: ReturnAnalyticsInput): ReturnAnalyticsSummary {
  const { returns, orders } = input;
  const revenue = orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0);
  const refundedAmount = returns
    .filter((row) => row.status === "refunded")
    .reduce((sum, row) => sum + Number(row.refundAmount || 0), 0);
  const requestedAmount = returns.reduce((sum, row) => sum + Number(row.refundAmount || 0), 0);

  const resolved = returns.filter((row) => row.resolvedAt);
  const resolutionDays = resolved.map((row) => {
    const start = new Date(row.createdAt).getTime();
    const end = new Date(row.resolvedAt as string).getTime();
    return Math.max(0, (end - start) / 86_400_000);
  });

  return {
    returnCount: returns.length,
    orderCount: orders.length,
    returnRate: orders.length > 0 ? returns.length / orders.length : 0,
    refundedAmount,
    requestedAmount,
    revenue,
    refundRate: revenue > 0 ? refundedAmount / revenue : 0,
    averageRefund: returns.length > 0 ? requestedAmount / returns.length : 0,
    averageResolutionDays:
      resolutionDays.length > 0
        ? resolutionDays.reduce((sum, value) => sum + value, 0) / resolutionDays.length
        : null,
    restockedRate:
      returns.length > 0
        ? returns.filter((row) => REFUNDING_STATUSES.includes(row.status)).length / returns.length
        : 0,
  };
}

export function reasonBreakdown(input: ReturnAnalyticsInput): ReasonBreakdown[] {
  const map = new Map<ReturnReason, { count: number; amount: number }>();
  for (const row of input.returns) {
    const current = map.get(row.reason) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += Number(row.refundAmount || 0);
    map.set(row.reason, current);
  }
  const total = input.returns.length;
  return [...map.entries()]
    .map(([reason, stats]) => ({
      reason,
      label: RETURN_REASON_LABELS[reason] ?? reason,
      count: stats.count,
      amount: stats.amount,
      share: total > 0 ? stats.count / total : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export function statusBreakdown(input: ReturnAnalyticsInput): StatusBreakdown[] {
  const map = new Map<ReturnStatus, { count: number; amount: number }>();
  for (const row of input.returns) {
    const current = map.get(row.status) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += Number(row.refundAmount || 0);
    map.set(row.status, current);
  }
  return [...map.entries()]
    .map(([status, stats]) => ({
      status,
      label: RETURN_STATUS_LABELS[status] ?? status,
      count: stats.count,
      amount: stats.amount,
    }))
    .sort((a, b) => b.count - a.count);
}

export function returnedProducts(input: ReturnAnalyticsInput): ReturnedProductLine[] {
  const map = new Map<string, ReturnedProductLine>();
  for (const row of input.returns) {
    for (const item of row.items) {
      const key = item.variantTitle ? `${item.title} — ${item.variantTitle}` : item.title;
      const current = map.get(key) ?? { title: key, quantity: 0, amount: 0, returnCount: 0 };
      current.quantity += Number(item.quantity || 0);
      current.amount += Number(item.lineTotal || 0);
      current.returnCount += 1;
      map.set(key, current);
    }
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity);
}

export function returnTrend(input: ReturnAnalyticsInput, windowDays: number): ReturnTrendPoint[] {
  const days = Math.max(1, windowDays);
  const buckets = new Map<string, ReturnTrendPoint>();
  for (let index = days - 1; index >= 0; index -= 1) {
    const day = new Date(Date.now() - index * 86_400_000).toISOString().slice(0, 10);
    buckets.set(day, { day, returns: 0, amount: 0 });
  }
  for (const row of input.returns) {
    const day = row.createdAt.slice(0, 10);
    const bucket = buckets.get(day);
    if (!bucket) continue;
    bucket.returns += 1;
    bucket.amount += Number(row.refundAmount || 0);
  }
  return [...buckets.values()];
}
