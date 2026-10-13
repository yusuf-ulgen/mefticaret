import { expect, it } from "vitest";
import { receiptReading } from "./receipt-review";
it("eşleşen tutar yalnız inceleme bekler", () => {
  expect(receiptReading({ amount: 100, is_receipt: true }, 100).status).toBe("pending_review");
});
it("eksik dekont bilgisi, bozuk miktar ve farkı açıkça ayırır", () => {
  for (const parsed of [
    { amount: 100 },
    { amount: 100, is_receipt: false },
    { amount: NaN, is_receipt: true },
    null,
  ])
    expect(receiptReading(parsed, 100).status).toBe("unreadable");
  expect(receiptReading({ amount: 99, is_receipt: true }, 100).status).toBe("mismatch");
});
