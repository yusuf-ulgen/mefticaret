/** Fiyat / maliyet / hacim senaryo simülatörü (what-if analizi). */

export type SimulatorProductInput = {
  productId: string;
  title: string;
  units: number;
  revenue: number;
  cost: number;
};

export type SimulatorAssumptions = {
  /** Fiyat değişimi, ör. 0.05 = +5% */
  priceDelta: number;
  /** Maliyet değişimi, ör. 0.03 = +3% */
  costDelta: number;
  /** Talep esnekliği (negatif): fiyat %1 artınca hacim %|e| düşer */
  elasticity: number;
  /** Kargo/işlem gibi sipariş başına sabit gider */
  fixedCostPerOrder: number;
  /** Dönem sipariş sayısı (sabit gider için) */
  orders: number;
};

export type SimulatorRow = {
  productId: string;
  title: string;
  baseUnits: number;
  baseRevenue: number;
  baseProfit: number;
  newUnits: number;
  newRevenue: number;
  newProfit: number;
  profitDelta: number;
  revenueDelta: number;
};

export type SimulatorResult = {
  rows: SimulatorRow[];
  base: { units: number; revenue: number; cost: number; profit: number; marginRate: number };
  scenario: { units: number; revenue: number; cost: number; profit: number; marginRate: number };
  delta: { revenue: number; profit: number; units: number; marginPoints: number };
  breakEvenVolumeChange: number | null;
};

export function simulate(
  products: SimulatorProductInput[],
  assumptions: SimulatorAssumptions,
): SimulatorResult {
  const volumeFactor = Math.max(0, 1 + assumptions.elasticity * assumptions.priceDelta);
  const priceFactor = 1 + assumptions.priceDelta;
  const costFactor = 1 + assumptions.costDelta;

  const rows: SimulatorRow[] = products.map((product) => {
    const unitPrice = product.units > 0 ? product.revenue / product.units : 0;
    const unitCost = product.units > 0 ? product.cost / product.units : 0;
    const baseProfit = product.revenue - product.cost;

    const newUnits = product.units * volumeFactor;
    const newRevenue = newUnits * unitPrice * priceFactor;
    const newCost = newUnits * unitCost * costFactor;
    const newProfit = newRevenue - newCost;

    return {
      productId: product.productId,
      title: product.title,
      baseUnits: product.units,
      baseRevenue: product.revenue,
      baseProfit,
      newUnits,
      newRevenue,
      newProfit,
      profitDelta: newProfit - baseProfit,
      revenueDelta: newRevenue - product.revenue,
    };
  });

  const fixedBase = assumptions.fixedCostPerOrder * assumptions.orders;
  const fixedScenario = assumptions.fixedCostPerOrder * assumptions.orders * volumeFactor;

  const baseUnits = rows.reduce((sum, row) => sum + row.baseUnits, 0);
  const baseRevenue = rows.reduce((sum, row) => sum + row.baseRevenue, 0);
  const baseCost = products.reduce((sum, product) => sum + product.cost, 0) + fixedBase;
  const baseProfit = baseRevenue - baseCost;

  const scenarioUnits = rows.reduce((sum, row) => sum + row.newUnits, 0);
  const scenarioRevenue = rows.reduce((sum, row) => sum + row.newRevenue, 0);
  const scenarioCost =
    rows.reduce((sum, row) => sum + (row.newRevenue - row.newProfit), 0) + fixedScenario;
  const scenarioProfit = scenarioRevenue - scenarioCost;

  const baseMargin = baseRevenue > 0 ? baseProfit / baseRevenue : 0;
  const scenarioMargin = scenarioRevenue > 0 ? scenarioProfit / scenarioRevenue : 0;

  // Fiyat değişiminin kârı korumak için gereken minimum hacim değişimi
  let breakEvenVolumeChange: number | null = null;
  if (baseProfit !== 0 && scenarioUnits > 0) {
    const unitProfitScenario = scenarioProfit / scenarioUnits;
    if (unitProfitScenario > 0) {
      breakEvenVolumeChange = baseProfit / unitProfitScenario / (baseUnits || 1) - 1;
    }
  }

  rows.sort((a, b) => b.profitDelta - a.profitDelta);

  return {
    rows,
    base: {
      units: baseUnits,
      revenue: baseRevenue,
      cost: baseCost,
      profit: baseProfit,
      marginRate: baseMargin,
    },
    scenario: {
      units: scenarioUnits,
      revenue: scenarioRevenue,
      cost: scenarioCost,
      profit: scenarioProfit,
      marginRate: scenarioMargin,
    },
    delta: {
      revenue: scenarioRevenue - baseRevenue,
      profit: scenarioProfit - baseProfit,
      units: scenarioUnits - baseUnits,
      marginPoints: (scenarioMargin - baseMargin) * 100,
    },
    breakEvenVolumeChange,
  };
}
