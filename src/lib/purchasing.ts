/**
 * Satın alma (purchasing) saf hesaplama yardımcıları.
 */

export type PurchaseOrderStatus = "draft" | "ordered" | "received" | "cancelled";

export const PURCHASE_STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  draft: "Taslak",
  ordered: "Sipariş edildi",
  received: "Teslim alındı",
  cancelled: "İptal",
};

export function purchaseOrderTotal(
  items: { quantity: number; unit_cost: number }[],
): number {
  return items.reduce((sum, item) => sum + item.quantity * Number(item.unit_cost ?? 0), 0);
}

export function purchaseOrderReceivedRatio(
  items: { quantity: number; received_quantity: number }[],
): number {
  const ordered = items.reduce((sum, item) => sum + item.quantity, 0);
  if (ordered <= 0) return 0;
  const received = items.reduce(
    (sum, item) => sum + Math.min(item.received_quantity, item.quantity),
    0,
  );
  return Math.round((received / ordered) * 100);
}

/** Yeni satın alma siparişi için okunabilir kod üretir: SA-20260831-4821 */
export function nextPurchaseOrderCode(date = new Date()): string {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `SA-${stamp}-${suffix}`;
}
