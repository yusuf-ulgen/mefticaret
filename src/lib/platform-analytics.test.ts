import { describe, expect, it } from "vitest";

import { addMoney, ageBucketOf, allowedCharts, compareRange, csvCell, resolveCenterRange, safeChange, toCsv } from "@/lib/platform-analytics";

describe("platform analytics helpers", () => {
  it("önceki dönem sıfır/eksikse yüzde üretmez", () => {
    expect(safeChange(10, 0)).toBeNull();
    expect(safeChange(10, null)).toBeNull();
    expect(safeChange(0, 0)).toBeNull();
    expect(safeChange(15, 10)).toBeCloseTo(50);
  });

  it("para birimlerini toplamaz", () => {
    const m = {};
    addMoney(m, "TRY", 100);
    addMoney(m, "usd", 5);
    addMoney(m, null, 1);
    expect(m).toEqual({ TRY: 101, USD: 5 });
  });

  it("İstanbul gün sınırını kullanır (UTC+3)", () => {
    // 2026-10-03 22:00 UTC = 2026-10-04 01:00 İstanbul
    const { range, partial } = resolveCenterRange({ period: "today", compare: "previous" }, Date.parse("2026-10-03T22:00:00Z"));
    expect(range.fromDay).toBe("2026-10-04");
    expect(range.from).toBe("2026-10-03T21:00:00.000Z");
    expect(partial).toBe(true);
  });

  it("karşılaştırma dönemleri", () => {
    const { range } = resolveCenterRange({ period: "7d", compare: "previous" }, Date.parse("2026-10-03T10:00:00Z"));
    const prev = compareRange(range, "previous")!;
    expect(prev.to).toBe(range.from);
    expect(Date.parse(prev.to) - Date.parse(prev.from)).toBe(Date.parse(range.to) - Date.parse(range.from));
    expect(compareRange(range, "yoy")!.from.slice(0, 4)).toBe("2025");
    expect(compareRange(range, "none")).toBeNull();
  });

  it("CSV formül enjeksiyonunu engeller", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+cmd")).toBe("'+cmd");
    expect(csvCell("-12.5")).toBe("-12.5");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(toCsv(["a"], [["@x"]])).toBe("a\n'@x");
  });

  it("mağaza yaşı ve grafik uygunluğu", () => {
    const now = Date.parse("2026-10-03T00:00:00Z");
    expect(ageBucketOf("2026-09-20T00:00:00Z", now)).toBe("0-30");
    expect(ageBucketOf("2024-01-01T00:00:00Z", now)).toBe("365+");
    expect(allowedCharts("store", 1)).not.toContain("line");
    expect(allowedCharts("day", 2)).toEqual(expect.arrayContaining(["line", "stacked"]));
  });
});
