import { describe, expect, it } from "vitest";

import {
  applyMarkup,
  applyRounding,
  changePercent,
  convertPrice,
  currencyDecimals,
  formatMarketPrice,
  isRateStale,
  marginPercent,
} from "./pricing-engine";

describe("pricing engine — marj", () => {
  it("yüzde marj uygular", () => {
    expect(applyMarkup(100, "percent", 5)).toBeCloseTo(105);
  });
  it("sabit marj uygular", () => {
    expect(applyMarkup(100, "fixed", 2.5)).toBeCloseTo(102.5);
  });
  it("marj yoksa değeri korur", () => {
    expect(applyMarkup(100, "none", 99)).toBe(100);
  });
});

describe("pricing engine — yuvarlama", () => {
  it("psikolojik ,99 fiyat üretir", () => {
    expect(applyRounding(46.37, "psych_99")).toBe(45.99);
    expect(applyRounding(46.99, "psych_99")).toBe(46.99);
  });
  it("0,05 adımına yuvarlar", () => {
    expect(applyRounding(10.11, "nearest_0_05")).toBe(10.1);
  });
  it("tam sayıya yuvarlar", () => {
    expect(applyRounding(10.6, "nearest_1")).toBe(11);
  });
  it("negatif değeri sıfırlar", () => {
    expect(applyRounding(-5, "none")).toBe(0);
  });
  it("sıfır ondalıklı para biriminde psikolojik fiyat tam sayıdır", () => {
    expect(applyRounding(1500, "psych_99", 0)).toBe(1499);
  });
});

describe("pricing engine — çevrim", () => {
  it("kur, marj ve yuvarlamayı sırayla uygular", () => {
    const result = convertPrice({
      baseAmount: 1000,
      rate: 0.028,
      markupType: "percent",
      markupValue: 3,
      rounding: "psych_99",
      decimals: 2,
    });
    // 1000 * 0.028 = 28 → +%3 = 28.84 → ,99 → 28.99? (28.84 tabanı 28 → 28.99 > 28.84)
    expect(result.rawAmount).toBeCloseTo(28);
    expect(result.amount).toBe(27.99);
  });
  it("kur yoksa sıfır döner", () => {
    expect(convertPrice({ baseAmount: 100, rate: 0, markupType: "none", markupValue: 0, rounding: "none", decimals: 2 }).amount).toBe(0);
  });
});

describe("pricing engine — koruma ve biçim", () => {
  it("marj yüzdesini hesaplar", () => {
    expect(marginPercent(200, 100)).toBeCloseTo(50);
    expect(marginPercent(0, 100)).toBeNull();
  });
  it("değişim yüzdesini hesaplar", () => {
    expect(changePercent(100, 120)).toBeCloseTo(20);
  });
  it("eski kuru tespit eder", () => {
    expect(isRateStale(null, 24)).toBe(true);
    expect(isRateStale(new Date().toISOString(), 24)).toBe(false);
  });
  it("JPY ondalıksızdır", () => {
    expect(currencyDecimals("JPY")).toBe(0);
    expect(currencyDecimals("try")).toBe(2);
  });
  it("sembol konumuna göre biçimlendirir", () => {
    expect(formatMarketPrice(1000, "TRY", { symbol: "₺", symbolPosition: "after" })).toContain("₺");
  });
});
