/**
 * ABC analizi ve stok devir hızı — saf hesaplama katmanı.
 *
 * ABC: varyantlar dönem cirosuna göre büyükten küçüğe sıralanır; kümülatif
 * ciro payı %80'e kadar olanlar A, %95'e kadar olanlar B, kalanlar C sınıfıdır.
 * Devir hızı: dönem satılan malın maliyeti / ortalama stok maliyeti (yıllıklandırılır).
 */

export type AbcInput = {
  variantId: string;
  productId: string | null;
  title: string;
  sku: string | null;
  stock: number;
  costPrice: number | null;
  soldUnits: number;
  revenue: number;
};

export type AbcClass = "A" | "B" | "C";

export type AbcLine = AbcInput & {
  /** Dönem cirosunun toplam ciroya oranı (0-1) */
  revenueShare: number;
  /** Kümülatif ciro payı (0-1) */
  cumulativeShare: number;
  abcClass: AbcClass;
  /** Elde tutulan stoğun maliyet değeri */
  stockValue: number;
  /** Yıllıklandırılmış stok devir hızı (kez/yıl) */
  turnover: number | null;
  /** Stoğun tükenmesi için tahmini gün sayısı */
  daysOnHand: number | null;
  /** 90+ gün stoğu olan ve satışı düşük kalemler */
  isSlowMoving: boolean;
};

export type AbcSummary = {
  totalRevenue: number;
  totalStockValue: number;
  averageTurnover: number | null;
  classes: { abcClass: AbcClass; count: number; revenue: number; stockValue: number }[];
  slowMovingCount: number;
};

export const ABC_CLASS_LABEL: Record<AbcClass, string> = {
  A: "A · Cironun bel kemiği",
  B: "B · Orta katkı",
  C: "C · Uzun kuyruk",
};

export function buildAbcAnalysis(inputs: AbcInput[], windowDays: number): AbcLine[] {
  const days = Math.max(1, windowDays);
  const totalRevenue = inputs.reduce((sum, item) => sum + Math.max(0, item.revenue), 0);
  const sorted = [...inputs].sort((a, b) => b.revenue - a.revenue);

  let cumulative = 0;
  return sorted.map((input) => {
    const share = totalRevenue > 0 ? Math.max(0, input.revenue) / totalRevenue : 0;
    cumulative += share;
    const abcClass: AbcClass = cumulative <= 0.8 ? "A" : cumulative <= 0.95 ? "B" : "C";

    const cost = input.costPrice ?? 0;
    const stockValue = cost * Math.max(0, input.stock);
    const cogs = cost * Math.max(0, input.soldUnits);
    // Dönem başı stok tahmini: mevcut stok + dönemde satılanın yarısı
    const averageStockValue = stockValue + cogs / 2;
    const turnover =
      averageStockValue > 0 ? (cogs / averageStockValue) * (365 / days) : cogs > 0 ? null : 0;

    const velocity = Math.max(0, input.soldUnits) / days;
    const daysOnHand = velocity > 0 ? Math.round(input.stock / velocity) : input.stock > 0 ? null : 0;

    return {
      ...input,
      revenueShare: share,
      cumulativeShare: Math.min(1, cumulative),
      abcClass,
      stockValue,
      turnover: turnover === null ? null : Number(turnover.toFixed(2)),
      daysOnHand,
      isSlowMoving: input.stock > 0 && (daysOnHand === null || daysOnHand > 90),
    };
  });
}

export function abcSummary(lines: AbcLine[]): AbcSummary {
  const totalRevenue = lines.reduce((sum, line) => sum + Math.max(0, line.revenue), 0);
  const totalStockValue = lines.reduce((sum, line) => sum + line.stockValue, 0);
  const measured = lines.filter((line) => line.turnover !== null && line.stockValue > 0);
  const averageTurnover =
    measured.length > 0
      ? Number(
          (measured.reduce((sum, line) => sum + (line.turnover ?? 0), 0) / measured.length).toFixed(
            2,
          ),
        )
      : null;

  const classes = (["A", "B", "C"] as AbcClass[]).map((abcClass) => {
    const group = lines.filter((line) => line.abcClass === abcClass);
    return {
      abcClass,
      count: group.length,
      revenue: group.reduce((sum, line) => sum + Math.max(0, line.revenue), 0),
      stockValue: group.reduce((sum, line) => sum + line.stockValue, 0),
    };
  });

  return {
    totalRevenue,
    totalStockValue,
    averageTurnover,
    classes,
    slowMovingCount: lines.filter((line) => line.isSlowMoving).length,
  };
}
