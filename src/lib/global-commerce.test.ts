import { describe, expect, it } from "vitest";

import {
  bufferedRate,
  calculateLandedCost,
  isRtlLocale,
  localizeForCountry,
  resolveDisplayPrice,
  resolveEuVat,
  resolveUsSalesTax,
} from "./global-commerce";

describe("kur risk marjı", () => {
  it("marjı kura ekler", () => {
    expect(bufferedRate(0.03, 3)).toBeCloseTo(0.0309, 6);
  });
  it("marj yoksa kuru değiştirmez", () => {
    expect(bufferedRate(0.03, 0)).toBeCloseTo(0.03);
  });
  it("marjı %25'te sınırlar ve geçersiz kuru sıfırlar", () => {
    expect(bufferedRate(1, 99)).toBeCloseTo(1.25);
    expect(bufferedRate(0, 5)).toBe(0);
  });
});

describe("ülke bazlı fiyat çözümü", () => {
  const rates = { USD: 0.03, EUR: 0.028 };

  it("ülkeye özel sabit fiyatı kur dönüşümüne tercih eder", () => {
    const result = resolveDisplayPrice({
      basePrice: 1000,
      baseCurrency: "TRY",
      country: "DE",
      rates,
      bufferPercent: 5,
      countryPrices: [{ country_code: "DE", currency: "EUR", price: 24.9 }],
    });
    expect(result).toMatchObject({ amount: 24.9, currency: "EUR", source: "country_price" });
  });

  it("sabit fiyat yoksa marjlı kurdan hesaplar", () => {
    const result = resolveDisplayPrice({
      basePrice: 1000,
      baseCurrency: "TRY",
      country: "US",
      rates,
      bufferPercent: 2,
    });
    expect(result.currency).toBe("USD");
    expect(result.source).toBe("fx");
    expect(result.amount).toBeCloseTo(30.6, 2);
  });

  it("kur bulunamazsa temel fiyatta kalır", () => {
    const result = resolveDisplayPrice({
      basePrice: 1000,
      baseCurrency: "TRY",
      country: "CA",
      rates,
    });
    expect(result).toMatchObject({ amount: 1000, currency: "TRY", source: "base" });
  });
});

describe("ülke algılama", () => {
  it("ülkeyi dil ve para birimine eşler", () => {
    expect(localizeForCountry("de")).toMatchObject({ country: "DE", currency: "EUR", locale: "de" });
  });
  it("Arapça pazarlarda sağdan sola döner", () => {
    expect(localizeForCountry("AE").rtl).toBe(true);
    expect(isRtlLocale("ar-SA")).toBe(true);
    expect(isRtlLocale("en")).toBe(false);
  });
  it("bilinmeyen ülkede varsayılana düşer", () => {
    expect(localizeForCountry("ZZ")).toMatchObject({ country: null, currency: "USD", locale: "en" });
  });
});

describe("AB KDV rejimi", () => {
  it("150 EUR altı ve IOSS açıkken KDV'yi kasada tahsil eder", () => {
    const result = resolveEuVat({
      country: "DE",
      vatRatePercent: 19,
      consignmentValueEur: 80,
      iossEnabled: true,
    });
    expect(result.scheme).toBe("IOSS");
    expect(result.collectAtCheckout).toBe(true);
    expect(result.ratePercent).toBe(19);
  });

  it("150 EUR üstünde ithalat KDV'sini gümrüğe bırakır", () => {
    const result = resolveEuVat({
      country: "FR",
      vatRatePercent: 20,
      consignmentValueEur: 400,
      iossEnabled: true,
    });
    expect(result.scheme).toBe("import_vat_at_border");
    expect(result.collectAtCheckout).toBe(false);
  });

  it("geçerli KDV numarasıyla ters yükleme uygular", () => {
    const result = resolveEuVat({
      country: "NL",
      vatRatePercent: 21,
      consignmentValueEur: 100,
      buyerVatId: "NL123456789B01",
      iossEnabled: true,
    });
    expect(result.scheme).toBe("reverse_charge");
    expect(result.ratePercent).toBe(0);
  });

  it("AB dışı ülkede rejim uygulamaz", () => {
    expect(resolveEuVat({ country: "US", vatRatePercent: 19, consignmentValueEur: 50 }).scheme).toBe(
      "none",
    );
  });
});

describe("ABD eyalet satış vergisi", () => {
  it("yükümlülük olan eyalette oranı uygular", () => {
    expect(
      resolveUsSalesTax({ state: "ca", ratePercent: 7.25, nexusStates: ["CA", "NY"] }),
    ).toMatchObject({ applies: true, ratePercent: 7.25 });
  });
  it("yükümlülük yoksa vergi hesaplamaz", () => {
    expect(
      resolveUsSalesTax({ state: "TX", ratePercent: 6.25, nexusStates: ["CA"] }).applies,
    ).toBe(false);
  });
});

describe("teslim maliyeti (DDP / DDU)", () => {
  it("DDP'de gümrük ve KDV kasada tahsil edilir", () => {
    const result = calculateLandedCost({
      goodsValue: 100,
      shippingCost: 20,
      dutyRatePercent: 5,
      taxRatePercent: 19,
      incoterm: "DDP",
    });
    expect(result.duty).toBeCloseTo(6);
    expect(result.tax).toBeCloseTo(23.94);
    expect(result.total).toBeCloseTo(149.94);
    expect(result.collectedAtCheckout).toBeCloseTo(149.94);
    expect(result.payableOnDelivery).toBeCloseTo(0);
  });

  it("DDU'da vergiler alıcıya kalır", () => {
    const result = calculateLandedCost({
      goodsValue: 100,
      shippingCost: 20,
      dutyRatePercent: 5,
      taxRatePercent: 19,
      incoterm: "DDU",
    });
    expect(result.collectedAtCheckout).toBeCloseTo(120);
    expect(result.payableOnDelivery).toBeCloseTo(29.94);
  });

  it("IOSS'ta KDV DDU'da bile kasada toplanır", () => {
    const result = calculateLandedCost({
      goodsValue: 100,
      shippingCost: 10,
      dutyRatePercent: 0,
      taxRatePercent: 19,
      incoterm: "DDU",
      taxCollectedAtCheckout: true,
    });
    expect(result.collectedAtCheckout).toBeCloseTo(130.9);
    expect(result.payableOnDelivery).toBeCloseTo(0);
  });
});
