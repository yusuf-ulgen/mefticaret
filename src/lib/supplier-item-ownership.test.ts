import { expect, it } from "vitest";
import { supplierOwnsItem, supplierOwnershipWithHistory } from "./supplier-item-ownership";
it("ürün silinse veya yeni katalog eşlemesi değişse de sipariş sahipliği korunur", () => {
  const snapshots = [{ order_item_id: "old-item", supplier_id: "original" }];
  expect(supplierOwnsItem("original", "old-item", snapshots)).toBe(true);
  expect(supplierOwnsItem("new-owner", "old-item", snapshots)).toBe(false);
});
it("B02: recovers legacy lines only from an unambiguous exact commission", () => {
  const items = [{ id: "old-item", order_id: "order-a" }];
  const commission = { order_item_id: "old-item", order_id: "order-a", supplier_id: "supplier-a" };
  expect(supplierOwnershipWithHistory(items, [], [commission, commission])).toEqual([
    { order_item_id: "old-item", supplier_id: "supplier-a" },
  ]);
  expect(
    supplierOwnershipWithHistory(items, [], [{ ...commission, order_id: "other-order" }]),
  ).toEqual([]);
  expect(
    supplierOwnershipWithHistory(
      items,
      [],
      [commission, { ...commission, supplier_id: "supplier-b" }],
    ),
  ).toEqual([]);
  const snapshot = { order_item_id: "old-item", supplier_id: "original-owner" };
  expect(supplierOwnershipWithHistory(items, [snapshot], [commission])).toEqual([snapshot]);
});
it("çok tedarikçili siparişte yalnız kendi kalemleri açılır", () => {
  const snapshots = [
    { order_item_id: "a", supplier_id: "supplier-a" },
    { order_item_id: "b", supplier_id: "supplier-b" },
  ];
  expect(["a", "b"].filter((id) => supplierOwnsItem("supplier-a", id, snapshots))).toEqual(["a"]);
  expect(supplierOwnsItem("supplier-a", "missing", snapshots)).toBe(false);
});
