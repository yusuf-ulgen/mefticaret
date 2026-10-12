/** Stok tükenme radarı: satış hızına göre kalan gün, tahmini tükenme tarihi ve risk altındaki ciro. */

export type StockoutInput = {
  variantId: string;
  title: string;
  sku: string | null;
  stock: number;
  price: number;
  lowStockThreshold: number;
  /** Son dönemdeki (recentDays) satış adedi */
  recentUnits: number;
  /** Ondan önceki eşit uzunluktaki dönemin satış adedi */
  previousUnits: number;
};

export type StockoutRisk = "out" | "critical" | "warning" | "healthy" | "idle";

export type StockoutRow = StockoutInput & {
  /** Günlük ortalama satış adedi */
  velocity: number;
  /** Satış hızı değişimi (%) */
  trend: number;
  /** Stok kaç gün yeter (null = satış yok) */
  daysOfCover: number | null;
  /** Tahmini tükenme tarihi (ISO gün) */
  stockoutDate: string | null;
  /** Tükenme sonrası 30 günde kaybedilecek tahmini ciro */
  revenueAtRisk: number;
  risk: StockoutRisk;
};

const DAY = 86_400_000;
const HORIZON = 30;

export function buildStockoutRows(
  inputs: StockoutInput[],
  recentDays = 14,
  now = Date.now(),
): StockoutRow[] {
  return inputs
    .map((input) => {
      const velocity = recentDays > 0 ? input.recentUnits / recentDays : 0;
      const trend =
        input.previousUnits > 0
          ? ((input.recentUnits - input.previousUnits) / input.previousUnits) * 100
          : input.recentUnits > 0
            ? 100
            : 0;
      const daysOfCover = velocity > 0 ? input.stock / velocity : null;
      const stockoutDate =
        daysOfCover != null && daysOfCover <= 120
          ? new Date(now + daysOfCover * DAY).toISOString().slice(0, 10)
          : null;
      const uncoveredDays =
        daysOfCover == null ? 0 : Math.max(0, HORIZON - Math.min(HORIZON, daysOfCover));
      const revenueAtRisk = uncoveredDays * velocity * input.price;

      let risk: StockoutRisk;
      if (input.stock <= 0) risk = "out";
      else if (velocity <= 0) risk = "idle";
      else if (daysOfCover != null && daysOfCover <= 7) risk = "critical";
      else if (daysOfCover != null && daysOfCover <= 21) risk = "warning";
      else risk = "healthy";

      return { ...input, velocity, trend, daysOfCover, stockoutDate, revenueAtRisk, risk };
    })
    .sort((a, b) => {
      const order: StockoutRisk[] = ["out", "critical", "warning", "healthy", "idle"];
      const diff = order.indexOf(a.risk) - order.indexOf(b.risk);
      if (diff !== 0) return diff;
      return b.revenueAtRisk - a.revenueAtRisk;
    });
}

export const RISK_LABELS: Record<StockoutRisk, string> = {
  out: "Tükendi",
  critical: "Kritik (≤7 gün)",
  warning: "Uyarı (≤21 gün)",
  healthy: "Güvenli",
  idle: "Hareketsiz",
};

export type StockoutSummary = {
  trackedVariants: number;
  outOfStock: number;
  criticalCount: number;
  warningCount: number;
  /** Tükenmiş + kritik varyantlarda 30 günlük risk altındaki ciro */
  revenueAtRisk: number;
  /** Satış yapan varyantların ortalama stok kapsama günü */
  avgDaysOfCover: number;
  /** Satışı olan ama stoğu biten varyant sayısı */
  urgentRestock: number;
};

export function stockoutSummary(rows: StockoutRow[]): StockoutSummary {
  const covers = rows
    .map((row) => row.daysOfCover)
    .filter((value): value is number => value != null);

  return {
    trackedVariants: rows.length,
    outOfStock: rows.filter((row) => row.stock <= 0).length,
    criticalCount: rows.filter((row) => row.risk === "critical").length,
    warningCount: rows.filter((row) => row.risk === "warning").length,
    revenueAtRisk: rows.reduce((sum, row) => sum + row.revenueAtRisk, 0),
    avgDaysOfCover: covers.length
      ? covers.reduce((sum, value) => sum + value, 0) / covers.length
      : 0,
    urgentRestock: rows.filter((row) => row.stock <= 0 && row.recentUnits > 0).length,
  };
}

export type CoverBucket = { label: string; count: number; revenueAtRisk: number };

const BUCKETS: Array<{ label: string; max: number }> = [
  { label: "Tükendi", max: 0 },
  { label: "1-7 gün", max: 7 },
  { label: "8-21 gün", max: 21 },
  { label: "22-60 gün", max: 60 },
  { label: "60 gün+", max: Number.POSITIVE_INFINITY },
];

/** Stok kapsama günlerine göre dağılım (satış hızı olan varyantlar). */
export function coverDistribution(rows: StockoutRow[]): CoverBucket[] {
  const counts = BUCKETS.map(() => ({ count: 0, revenueAtRisk: 0 }));
  for (const row of rows) {
    if (row.velocity <= 0 && row.stock > 0) continue;
    const cover = row.stock <= 0 ? 0 : (row.daysOfCover ?? Number.POSITIVE_INFINITY);
    const index = BUCKETS.findIndex((bucket) => cover <= bucket.max);
    const slot = index === -1 ? BUCKETS.length - 1 : index;
    counts[slot]!.count += 1;
    counts[slot]!.revenueAtRisk += row.revenueAtRisk;
  }
  return BUCKETS.map((bucket, index) => ({
    label: bucket.label,
    count: counts[index]!.count,
    revenueAtRisk: counts[index]!.revenueAtRisk,
  }));
}
