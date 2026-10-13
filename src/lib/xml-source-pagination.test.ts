import { expect, it } from "vitest";
import { parseSourceText } from "./xml-integrator";
it("continues XML, CSV and JSON sources past the first batch", () => {
  const rows = Array.from({ length: 205 }, (_, i) => ({ sku: `SKU-${i}`, title: `Ürün ${i}` }));
  const xml = `<products>${rows.map((row) => `<product><sku>${row.sku}</sku><title>${row.title}</title></product>`).join("")}</products>`;
  const csv = `sku,title\n${rows.map((row) => `${row.sku},${row.title}`).join("\n")}`;
  for (const [content, format] of [[xml, "xml"], [csv, "csv"], [JSON.stringify(rows), "json"]] as const) {
    const first = parseSourceText(content, format, { limit: 200 });
    const second = parseSourceText(content, format, { limit: 200, offset: 200 });
    expect(first.rows).toHaveLength(200);
    expect(second.totalRows).toBe(205);
    expect(second.rows).toHaveLength(5);
    expect(second.rows[0]?.["sku"]).toBe("SKU-200");
  }
});
