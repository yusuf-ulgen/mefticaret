import { expect, it } from "vitest";
import { cartQuantity } from "./cart-quantity";
it("never invents one item of stock and caps stocked additions", () => {
  expect(cartQuantity(1, 0)).toBe(0);
  expect(cartQuantity(1, 2)).toBe(1);
  expect(cartQuantity(8, 2)).toBe(2);
  expect(cartQuantity(-1, 2)).toBe(0);
  expect(cartQuantity(NaN, 2)).toBe(0);
  expect(cartQuantity(1.8, 2)).toBe(1);
});
