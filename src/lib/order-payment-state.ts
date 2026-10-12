/** Tahsilat bekleyen siparişler; iade, hata ve iptal tahsilat bekleme değildir. */
export function isAwaitingPayment(order: { payment_status: string; status: string }) {
  return (
    order.payment_status === "pending" &&
    !["cancelled", "returned", "refunded"].includes(order.status)
  );
}
