type PlanPrices = { price_monthly: number | string | null; price_yearly: number | string | null };
export function planPrice(plan: PlanPrices, interval: "monthly" | "yearly"): number | null {
  const raw = interval === "yearly" ? plan.price_yearly : plan.price_monthly;
  if (raw === null || String(raw).trim() === "") return null;
  const value = Number(raw);
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    (interval === "yearly" && value === 0 && Number(plan.price_monthly) > 0)
  )
    return null;
  return Math.round(value * 100) / 100;
}
export function yearlyPlanSummary(plan: PlanPrices) {
  const monthly = planPrice(plan, "monthly");
  const yearly = planPrice(plan, "yearly");
  if (yearly === null || yearly <= 0) return null;
  const comparison = monthly !== null && monthly > 0 ? monthly * 12 : null;
  return {
    monthlyEquivalent: yearly / 12,
    savingsPercent:
      comparison !== null && comparison > yearly
        ? Math.round((1 - yearly / comparison) * 1000) / 10
        : null,
  };
}
