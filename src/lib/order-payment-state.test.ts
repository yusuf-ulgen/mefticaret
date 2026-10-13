import { describe, expect, it } from "vitest";
import { isAwaitingPayment } from "./order-payment-state";

describe("tahsilat bekleyen sipariş", () => {
  it("üç bekleyen ve bir iadede yalnız üç sipariş sayar", () => {
    const orders = [
      ...Array.from({ length: 3 }, () => ({ status: "pending", payment_status: "pending" })),
      { status: "refunded", payment_status: "refunded" },
    ];
    expect(orders.filter(isAwaitingPayment)).toHaveLength(3);
  });
  it.each(["paid", "partially_refunded", "refunded", "failed"])(
    "%s tahsilat beklemez",
    (payment_status) => {
      expect(isAwaitingPayment({ status: "pending", payment_status })).toBe(false);
    },
  );
  it.each(["cancelled", "returned", "refunded"])("%s siparişi tahsilat beklemez", (status) => {
    expect(isAwaitingPayment({ status, payment_status: "pending" })).toBe(false);
  });
});
