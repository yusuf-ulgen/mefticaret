import { describe, expect, it } from "vitest";
import { supplierCatalogQuery } from "./supplier-catalog-query";
import type { supplierSearchCatalog } from "./supplier-workflow.functions";

const search = (() =>
  Promise.resolve({
    products: [],
    total: 0,
    pageSize: 25,
  })) as unknown as typeof supplierSearchCatalog;
describe("unified supplier catalog", () => {
  it("shares default RFQ and catalog results but isolates supplier, page and filters", () => {
    const input = { supplierId: "supplier-a", search: "SKU-1001", page: 0 };
    const base = supplierCatalogQuery(search, input);
    expect(base.queryKey).toEqual(
      supplierCatalogQuery(search, { ...input, category: "", sort: "recent", filter: "all" })
        .queryKey,
    );
    for (const change of [
      { supplierId: "supplier-b" },
      { page: 1 },
      { filter: "hidden" as const },
      { category: "Giyim" },
    ]) {
      expect(base.queryKey).not.toEqual(
        supplierCatalogQuery(search, { ...input, ...change }).queryKey,
      );
    }
  });
  it("does not fetch before supplier access is established", () => {
    expect(supplierCatalogQuery(search, { supplierId: "", search: "", page: 0 }).enabled).toBe(
      false,
    );
  });
});
