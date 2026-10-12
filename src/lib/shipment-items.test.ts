import { expect, it } from "vitest";
import { physicalShipmentItems } from "./shipment-items";
const physical = { id: "physical", title: "Kupa", quantity: 2, is_digital: false };
const digital = { id: "digital", title: "PDF", quantity: 1, is_digital: true };
it("dijital siparişi reddeder, karmada fiziksel kalemi seçer", () => {
  expect(() => physicalShipmentItems([digital])).toThrow();
  expect(physicalShipmentItems([digital, physical])).toEqual([
    { orderItemId: "physical", quantity: 2 },
  ]);
});
it("başka sipariş, dijital kalem, fazla adet ve mükerrer kalemi reddeder", () => {
  for (const lines of [
    [{ orderItemId: "other", quantity: 1 }],
    [{ orderItemId: "digital", quantity: 1 }],
    [{ orderItemId: "physical", quantity: 3 }],
    [
      { orderItemId: "physical", quantity: 1 },
      { orderItemId: "physical", quantity: 1 },
    ],
  ]) {
    expect(() => physicalShipmentItems([digital, physical], lines)).toThrow();
  }
});
