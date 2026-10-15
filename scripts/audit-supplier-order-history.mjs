// Read-only diagnosis: never infer a historical owner from the order header or SKU.
import postgres from "postgres";
import fs from "node:fs/promises";

const connection = process.env["SUPPLIER_AUDIT_DATABASE_URL"];
if (!connection) throw new Error("Set SUPPLIER_AUDIT_DATABASE_URL for the database to inspect.");
const orders = process.argv.flatMap((arg, index, args) => arg === "--order" ? [args[index + 1]] : []);
if (!orders.length || orders.some((value) => !value || value.startsWith("--")))
  throw new Error("Pass --order <order-number> for each order to inspect.");
const outputIndex = process.argv.indexOf("--output");
const output = outputIndex < 0 ? null : process.argv[outputIndex + 1];
const sql = postgres(connection, { max: 1, onnotice: () => {} });
try {
  const report = await sql.begin("read only", async (tx) => {
    const headers = await tx`
      SELECT o.id, o.order_number, o.store_id,
        (SELECT count(*)::int FROM order_items i WHERE i.order_id=o.id) AS item_count,
        (SELECT count(DISTINCT d.supplier_id)::int FROM dropship_orders d WHERE d.order_id=o.id) AS supplier_count
      FROM orders o WHERE o.order_number IN ${tx(orders)} ORDER BY o.order_number`;
    const lines = headers.length ? await tx`
      SELECT i.id AS item_id, i.order_id, i.store_id,
        ARRAY(SELECT x.supplier_id::text FROM order_item_suppliers x WHERE x.order_item_id=i.id ORDER BY x.supplier_id) AS snapshot_owners,
        ARRAY(SELECT DISTINCT c.supplier_id::text FROM supplier_commission_entries c WHERE c.order_item_id=i.id AND c.order_id=i.order_id ORDER BY c.supplier_id::text) AS commission_owners,
        ARRAY(SELECT DISTINCT l.supplier_id::text FROM store_supplier_imports l WHERE l.product_id=i.product_id AND l.store_id=i.store_id ORDER BY l.supplier_id::text) AS current_import_owners,
        ARRAY(SELECT DISTINCT p.supplier_id::text FROM supplier_products p WHERE
          (i.variant_id IS NOT NULL AND p.variant_id=i.variant_id) OR
          (i.variant_id IS NULL AND i.product_id IS NOT NULL AND p.product_id=i.product_id) ORDER BY p.supplier_id::text) AS current_catalog_owners
      FROM order_items i WHERE i.order_id IN ${tx(headers.map((row) => row.id))} ORDER BY i.order_id,i.id` : [];
    return {
      generatedAt: new Date().toISOString(), readOnly: true, requestedOrders: orders,
      missingOrders: orders.filter((number) => !headers.some((row) => row.order_number === number)),
      orders: headers,
      lines: lines.map((line) => ({ ...line, decision: line.snapshot_owners.length ? "snapshot_exists"
        : line.commission_owners.length === 1 ? "exact_commission_recovery_available"
        : line.commission_owners.length > 1 ? "conflicting_commissions_manual_review"
        : "historical_evidence_required" })),
      note: "Current catalog/import relationships are diagnostic only. They do not prove historical ownership. No writes performed.",
    };
  });
  const json = JSON.stringify(report, null, 2) + "\n";
  if (output) await fs.writeFile(output, json);
  console.log(json);
} finally {
  await sql.end();
}
