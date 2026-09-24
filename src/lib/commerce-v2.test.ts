import { describe, expect, it } from "vitest";

import {
  buildVariants,
  matchesCollection,
  matchesSegmentQuery,
  parseCollectionRules,
  parseSegmentQuery,
  toGrams,
} from "./commerce-v2";

describe("buildVariants", () => {
  it("seçeneklerin kartezyen çarpımını üretir ve mevcutları korur", () => {
    const opts = [
      { name: "Renk", values: ["Kırmızı", "Mavi"] },
      { name: "Beden", values: ["S", "M"] },
    ];
    const first = buildVariants(opts, [], { price: 150, compare_at_price: null, cost_price: null });
    expect(first).toHaveLength(4);
    expect(first[0]?.title).toBe("Kırmızı / S");
    const edited = first.map((v, i) => (i === 0 ? { ...v, stock: 10 } : v));
    const again = buildVariants([...opts, { name: "Malzeme", values: [] }], edited, { price: 1, compare_at_price: null, cost_price: null });
    expect(again[0]?.stock).toBe(10);
  });
  it("seçenek yoksa tek varsayılan varyant", () => {
    expect(buildVariants([], [], { price: 5, compare_at_price: null, cost_price: null })).toHaveLength(1);
  });
});

describe("collection rules", () => {
  const p = { title: "Kırmızı Tişört", tags: ["yaz"], base_price: 200, product_type: "Giyim", vendor: "Mef", stock: 3 };
  it("all / any", () => {
    const rules = parseCollectionRules({ match: "all", conditions: [
      { field: "tag", op: "eq", value: "YAZ" },
      { field: "price", op: "gt", value: "100" },
    ] });
    expect(matchesCollection(p, rules)).toBe(true);
    expect(matchesCollection(p, { ...rules, conditions: [...rules.conditions, { field: "stock", op: "gt", value: "10" }] })).toBe(false);
    expect(matchesCollection(p, { match: "any", conditions: [{ field: "stock", op: "gt", value: "10" }, { field: "vendor", op: "eq", value: "mef" }] })).toBe(true);
  });
  it("geçersiz kuralları eler", () => {
    expect(parseCollectionRules({ conditions: [{ field: "x", op: "eq", value: "1" }] }).conditions).toHaveLength(0);
  });
});

describe("segment query", () => {
  const now = Date.parse("2026-09-24T00:00:00Z");
  const c = { total_spent: 1500, orders_count: 3, cities: ["İstanbul"], tags: ["vip"], last_order_at: "2026-09-10T00:00:00Z", accepts_marketing: true };
  it("örnek kurallar", () => {
    const q = parseSegmentQuery({ match: "all", rules: [
      { field: "total_spent", op: "gt", value: "1000" },
      { field: "orders_count", op: "gte", value: "3" },
      { field: "city", op: "eq", value: "istanbul" },
      { field: "tag", op: "contains", value: "VIP" },
      { field: "last_order_days", op: "lt", value: "30" },
      { field: "accepts_marketing", op: "eq", value: "true" },
    ] });
    expect(q.rules).toHaveLength(6);
    expect(matchesSegmentQuery(c, q, now)).toBe(true);
    expect(matchesSegmentQuery({ ...c, accepts_marketing: false }, q, now)).toBe(false);
  });
});

it("toGrams", () => {
  expect(toGrams(1.5, "kg")).toBe(1500);
  expect(toGrams(null, "g")).toBeNull();
});
