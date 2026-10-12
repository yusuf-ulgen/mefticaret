import { expect, it } from "vitest";
import { supplierOwnsItem } from "./supplier-item-ownership";
it("ürün silinse veya yeni katalog eşlemesi değişse de sipariş sahipliği korunur", () => {
  const snapshots = [{ order_item_id: "old-item", supplier_id: "original" }];
  expect(supplierOwnsItem("original", "old-item", snapshots)).toBe(true);
  expect(supplierOwnsItem("new-owner", "old-item", snapshots)).toBe(false);
});
it("çok tedarikçili siparişte yalnız kendi kalemleri açılır", () => {
  const snapshots = [
    { order_item_id: "a", supplier_id: "supplier-a" },
    { order_item_id: "b", supplier_id: "supplier-b" },
  ];
  expect(["a", "b"].filter((id) => supplierOwnsItem("supplier-a", id, snapshots))).toEqual(["a"]);
  expect(supplierOwnsItem("supplier-a", "missing", snapshots)).toBe(false);
});
