import { expect, it } from "vitest";
import { loadSupplierDeskOrders } from "./supplier-desk.server";

type Row = Record<string, unknown>;
function database(fail?: string, ambiguous = false) {
  const tables: Record<string, Row[]> = {
    dropship_orders: [
      { id: "desk-a", supplier_id: "supplier-a", order_id: "order-a", created_at: "2026-10-14" },
    ],
    orders: [{ id: "order-a", order_number: "LEGACY", currency: "TRY" }],
    order_items: [
      {
        id: "item-a",
        order_id: "order-a",
        product_id: "product-a",
        variant_id: "variant-a",
        quantity: 2,
        unit_price: 50,
        line_total: 100,
      },
    ],
    supplier_commission_entries: [
      {
        order_id: "order-a",
        order_item_id: "item-a",
        supplier_id: "supplier-a",
        gross_amount: 100,
        commission_amount: 10,
        net_amount: 90,
      },
      ...(ambiguous
        ? [{ order_id: "order-a", order_item_id: "item-a", supplier_id: "supplier-b" }]
        : []),
    ],
    products: [{ id: "product-a" }],
    product_variants: [{ id: "variant-a" }],
    order_item_suppliers: [],
    product_images: [{ id: "image-a", product_id: "product-a", url: "https://img.test/a.jpg" }],
  };
  return {
    from: (table: string) => {
      let data = tables[table] ?? [];
      let from = 0;
      let to = Infinity;
      const query = {
        select: () => query,
        order: () => query,
        in: (key: string, values: unknown[]) => {
          data = data.filter((row) => values.includes(row[key]));
          return query;
        },
        range: (start: number, end: number) => {
          from = start;
          to = end;
          return query;
        },
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data: table === fail ? null : data.slice(from, to + 1),
            error: table === fail ? { message: `${table} unavailable` } : null,
          }).then(resolve),
      };
      return query;
    },
  };
}
it.each([
  "dropship_orders",
  "orders",
  "order_items",
  "supplier_commission_entries",
  "products",
  "product_variants",
  "order_item_suppliers",
  "product_images",
])("N07: %s query failure is not a successful empty order", async (table) => {
  await expect(loadSupplierDeskOrders(database(table), ["supplier-a"])).rejects.toThrow(
    `${table} unavailable`,
  );
});
it("B02: the real order reader restores a legacy line from exact commission evidence", async () => {
  const orders = await loadSupplierDeskOrders(database(), ["supplier-a"]);
  expect(orders[0]).toMatchObject({
    itemsTotal: 100,
    relationIssue: false,
    commissionTotal: 10,
    netTotal: 90,
  });
  expect(orders[0]!.items.map((item) => item.id)).toEqual(["item-a"]);
});
it("B02: contradictory legacy ownership stays unknown and is not exposed", async () => {
  const orders = await loadSupplierDeskOrders(database(undefined, true), ["supplier-a"]);
  expect(orders[0]).toMatchObject({ items: [], itemsTotal: null, relationIssue: true });
});
