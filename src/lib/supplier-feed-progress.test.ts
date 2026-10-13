import { beforeEach, describe, expect, it, vi } from "vitest";
import { runSupplierFeed } from "./supplier-workflow.server";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), parse: vi.fn(), sync: vi.fn(), auto: vi.fn() }));
vi.mock("@/lib/xml-integrator.server", () => ({ fetchSource: mocks.fetch }));
vi.mock("@/lib/xml-integrator", () => ({
  parseSourceText: mocks.parse,
  suggestMapping: () => ({ sku: "sku", title: "title", stock: "stock" }),
  readMapped: (row: Record<string, string>, key: string) => row[key] ?? "",
}));
vi.mock("@/lib/supplier-catalog.server", () => ({
  propagateToImporters: mocks.sync,
  runAutoImports: mocks.auto,
}));

function memoryDb(status: string | null = null) {
  const rows: Record<string, unknown>[] = [];
  const feed: Record<string, unknown> = { id: "feed", last_status: status, stats: {} };
  const from = (table: string) => {
    let op = "read";
    let patch: Record<string, unknown> = {};
    let inserted: Record<string, unknown>[] = [];
    let id: unknown;
    let claimed = false;
    let fromIndex = 0;
    let toIndex = Infinity;
    const execute = () => {
      if (table === "supplier_xml_feeds") {
        if (claimed && feed["last_status"] === "running") return { data: null, error: null };
        if (op === "update") Object.assign(feed, patch);
        return { data: { ...feed }, error: null };
      }
      if (op === "insert")
        inserted.forEach((r) => rows.push({ ...r, id: `product-${rows.length}` }));
      if (op === "update")
        rows.filter((r) => r["id"] === id).forEach((r) => Object.assign(r, patch));
      return {
        data: op === "read" ? rows.slice(fromIndex, toIndex + 1).map((r) => ({ ...r })) : [],
        error: null,
      };
    };
    const query = {
      select: () => query,
      order: () => query,
      eq: (key: string, value: unknown) => {
        if (key === "id") id = value;
        return query;
      },
      or: () => {
        claimed = true;
        return query;
      },
      range: (a: number, b: number) => {
        fromIndex = a;
        toIndex = b;
        return query;
      },
      update: (value: Record<string, unknown>) => {
        op = "update";
        patch = value;
        return query;
      },
      insert: (value: Record<string, unknown>[]) => {
        op = "insert";
        inserted = value;
        return query;
      },
      maybeSingle: async () => execute(),
      then: (resolve: (value: ReturnType<typeof execute>) => unknown) =>
        Promise.resolve(execute()).then(resolve),
    };
    return query;
  };
  return { db: { from }, rows, feed };
}
const feed = {
  id: "feed",
  supplier_id: "supplier",
  store_id: "store",
  source_url: "https://example.com/feed.xml",
  field_mapping: {},
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockResolvedValue({ content: "fixture", format: "xml" });
  mocks.parse.mockReturnValue({
    columns: ["sku", "title"],
    rows: [{ sku: "SKU-1", title: "Ürün", stock: "3" }],
    totalRows: 1,
  });
  mocks.sync.mockResolvedValue(0);
  mocks.auto.mockResolvedValue([{ imported: 200, remaining: 15 }]);
});
describe("supplier feed progress and repeat runs", () => {
  it("continues unchanged source at its recorded cursor", async () => {
    mocks.parse.mockImplementation((_content: string, _format: string, options: { offset: number }) => ({ columns: ["sku", "title"], totalRows: 2, rows: [{ sku: `SKU-${options.offset}`, title: "Ürün", stock: "3" }] }));
    const m = memoryDb();
    const first = await runSupplierFeed(m.db, feed, "TRY");
    expect(first.nextOffset).toBe(1);
    expect(first.remaining).toBe(1);
    const second = await runSupplierFeed(m.db, feed, "TRY");
    expect(mocks.parse.mock.calls[1]?.[2]).toMatchObject({ offset: 1 });
    expect(second.remaining).toBe(0);
    expect(second.created).toBe(2);
    expect(m.rows).toHaveLength(2);
  });
  it("updates existing SKU on repeat and reports remaining auto imports", async () => {
    const m = memoryDb();
    const first = await runSupplierFeed(m.db, feed, "TRY");
    const second = await runSupplierFeed(m.db, feed, "TRY");
    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);
    expect(m.rows).toHaveLength(1);
    expect(second.autoRemaining).toBe(15);
    expect(m.feed["last_status"]).toBe("success");
  });
  it("reports propagation failures as partial rather than a successful sync", async () => {
    mocks.sync.mockRejectedValue(new Error("Database unavailable"));
    const m = memoryDb();
    const result = await runSupplierFeed(m.db, feed, "TRY");
    expect(result.syncError).toBe("Database unavailable");
    expect(m.feed["last_status"]).toBe("partial");
    expect(result.lastSuccessAt).toBeNull();
  });
  it("does not start a second run or overwrite an active run", async () => {
    const m = memoryDb("running");
    await expect(runSupplierFeed(m.db, feed, "TRY")).rejects.toThrow("zaten çalışıyor");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(m.feed["last_status"]).toBe("running");
  });
});
