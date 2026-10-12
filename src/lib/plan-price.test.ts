import { expect, it } from "vitest";
import { planPrice, yearlyPlanSummary } from "./plan-price";
it("fiyatı işletme kaydından alır; 10 aylık fiyat uydurmaz", () => {
  const plan = { price_monthly: 190000, price_yearly: 250000 };
  expect(planPrice(plan, "yearly")).toBe(250000);
  expect(yearlyPlanSummary(plan)?.monthlyEquivalent).toBeCloseTo(250000 / 12);
  expect(yearlyPlanSummary(plan)?.savingsPercent).toBe(89);
});
it("eksik veya geçersiz ücretli yıllık fiyatı ücretsiz saymaz", () => {
  expect(planPrice({ price_monthly: 100, price_yearly: 0 }, "yearly")).toBeNull();
  expect(planPrice({ price_monthly: 100, price_yearly: null }, "yearly")).toBeNull();
  expect(planPrice({ price_monthly: 100, price_yearly: -1 }, "yearly")).toBeNull();
  expect(planPrice({ price_monthly: 0, price_yearly: 0 }, "yearly")).toBe(0);
});
it("tasarruf yoksa avantaj iddiası çıkarmaz", () => {
  expect(yearlyPlanSummary({ price_monthly: 100, price_yearly: 1300 })?.savingsPercent).toBeNull();
});
