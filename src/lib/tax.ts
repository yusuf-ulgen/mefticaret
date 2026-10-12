/** KDV / vergi raporu için saf hesaplama fonksiyonları. */

export type TaxOrder = {
  placedAt: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
};

export type TaxPeriodRow = {
  period: string;
  orders: number;
  netSales: number;
  shipping: number;
  taxableBase: number;
  tax: number;
  gross: number;
};

/** İptal/iade edilmiş siparişler vergi matrahından çıkarılır. */
export function isTaxable(order: TaxOrder): boolean {
  if (order.status === "cancelled") return false;
  if (order.paymentStatus === "refunded" || order.paymentStatus === "failed") return false;
  return true;
}

/**
 * Siparişte vergi tutarı kayıtlı değilse ayar bazlı orandan türetir.
 * Fiyatlar vergi dahilse brütten ayrıştırılır, değilse matrah üzerine eklenir.
 */
export function deriveTax(order: TaxOrder, rate: number, includedInPrices: boolean): number {
  const stored = Number(order.taxTotal ?? 0);
  if (stored > 0) return Math.round(stored * 100) / 100;
  if (rate <= 0) return 0;
  const base = Math.max(0, order.subtotal - order.discountTotal) + Math.max(0, order.shippingTotal);
  const tax = includedInPrices ? base - base / (1 + rate) : base * rate;
  return Math.round(tax * 100) / 100;
}

export function periodKey(iso: string, granularity: "month" | "quarter"): string {
  const date = new Date(iso);
  const year = date.getUTCFullYear();
  if (granularity === "month") return `${year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${year}-Ç${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

export function buildTaxPeriods(
  orders: TaxOrder[],
  options: { rate: number; includedInPrices: boolean; granularity: "month" | "quarter" },
): TaxPeriodRow[] {
  const map = new Map<string, TaxPeriodRow>();
  for (const order of orders) {
    if (!isTaxable(order)) continue;
    const key = periodKey(order.placedAt, options.granularity);
    const row =
      map.get(key) ??
      ({
        period: key,
        orders: 0,
        netSales: 0,
        shipping: 0,
        taxableBase: 0,
        tax: 0,
        gross: 0,
      } satisfies TaxPeriodRow);
    const tax = deriveTax(order, options.rate, options.includedInPrices);
    const net = Math.max(0, order.subtotal - order.discountTotal);
    row.orders += 1;
    row.netSales += net;
    row.shipping += Math.max(0, order.shippingTotal);
    row.tax += tax;
    row.gross += Number(order.grandTotal ?? 0);
    row.taxableBase += options.includedInPrices
      ? Math.max(0, net + Math.max(0, order.shippingTotal) - tax)
      : net + Math.max(0, order.shippingTotal);
    map.set(key, row);
  }
  const rows = [...map.values()].map((row) => ({
    ...row,
    netSales: Math.round(row.netSales * 100) / 100,
    shipping: Math.round(row.shipping * 100) / 100,
    taxableBase: Math.round(row.taxableBase * 100) / 100,
    tax: Math.round(row.tax * 100) / 100,
    gross: Math.round(row.gross * 100) / 100,
  }));
  return rows.sort((a, b) => (a.period < b.period ? 1 : -1));
}

export function taxTotals(rows: TaxPeriodRow[]) {
  return rows.reduce(
    (acc, row) => ({
      orders: acc.orders + row.orders,
      taxableBase: Math.round((acc.taxableBase + row.taxableBase) * 100) / 100,
      tax: Math.round((acc.tax + row.tax) * 100) / 100,
      gross: Math.round((acc.gross + row.gross) * 100) / 100,
    }),
    { orders: 0, taxableBase: 0, tax: 0, gross: 0 },
  );
}
