/** Ürün yaşam döngüsü analizi: yeni, büyüyen, olgun, düşen ve ölü ürünler. */

export type LifecycleProductInput = {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  stock: number;
};

export type LifecycleSaleInput = {
  productId: string | null;
  quantity: number;
  lineTotal: number;
  createdAt: string;
};

export type LifecyclePhase = "new" | "growing" | "mature" | "declining" | "dead";

export const PHASE_LABELS: Record<LifecyclePhase, string> = {
  new: "Yeni",
  growing: "Büyüyen",
  mature: "Olgun",
  declining: "Düşen",
  dead: "Ölü stok",
};

export const PHASE_HINTS: Record<LifecyclePhase, string> = {
  new: "İlk 30 gününde: görünürlük ve ilk yorumlar önemli.",
  growing: "Son 30 gün önceki döneme göre büyüyor: stok ve reklam artırılabilir.",
  mature: "İstikrarlı satış: fiyat ve marj optimizasyonu uygun.",
  declining: "Satış hızı düşüyor: kampanya veya paket teklif düşünülebilir.",
  dead: "90 gündür satış yok: tasfiye veya arşivleme değerlendirilmeli.",
};

export type LifecycleRow = {
  productId: string;
  title: string;
  status: string;
  ageDays: number;
  units30: number;
  unitsPrev30: number;
  units90: number;
  revenue90: number;
  growth: number | null;
  velocity: number;
  stock: number;
  daysOfStock: number | null;
  lastSoldAt: string | null;
  daysSinceLastSale: number | null;
  phase: LifecyclePhase;
};

export type LifecycleAnalysis = {
  rows: LifecycleRow[];
  byPhase: Array<{
    phase: LifecyclePhase;
    label: string;
    products: number;
    revenue90: number;
    units30: number;
    stock: number;
    share: number;
  }>;
  summary: {
    products: number;
    revenue90: number;
    deadStockValueUnits: number;
    newProducts: number;
    decliningRevenue: number;
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function analyzeLifecycle(
  products: LifecycleProductInput[],
  sales: LifecycleSaleInput[],
  now = new Date(),
): LifecycleAnalysis {
  const nowMs = now.getTime();
  const stats = new Map<
    string,
    {
      units30: number;
      unitsPrev30: number;
      units90: number;
      revenue90: number;
      lastSoldAt: string | null;
    }
  >();

  for (const sale of sales) {
    if (!sale.productId) continue;
    const quantity = Math.max(0, sale.quantity);
    const ageDays = (nowMs - new Date(sale.createdAt).getTime()) / DAY_MS;
    let entry = stats.get(sale.productId);
    if (!entry) {
      entry = { units30: 0, unitsPrev30: 0, units90: 0, revenue90: 0, lastSoldAt: null };
      stats.set(sale.productId, entry);
    }
    if (ageDays <= 30) entry.units30 += quantity;
    else if (ageDays <= 60) entry.unitsPrev30 += quantity;
    if (ageDays <= 90) {
      entry.units90 += quantity;
      entry.revenue90 += sale.lineTotal;
    }
    if (!entry.lastSoldAt || sale.createdAt > entry.lastSoldAt) entry.lastSoldAt = sale.createdAt;
  }

  const rows: LifecycleRow[] = products.map((product) => {
    const entry = stats.get(product.id);
    const units30 = entry?.units30 ?? 0;
    const unitsPrev30 = entry?.unitsPrev30 ?? 0;
    const units90 = entry?.units90 ?? 0;
    const ageDays = Math.max(0, Math.round((nowMs - new Date(product.createdAt).getTime()) / DAY_MS));
    const growth = unitsPrev30 > 0 ? units30 / unitsPrev30 - 1 : units30 > 0 ? null : 0;
    const velocity = units30 / 30;
    const lastSoldAt = entry?.lastSoldAt ?? null;
    const daysSinceLastSale = lastSoldAt
      ? Math.floor((nowMs - new Date(lastSoldAt).getTime()) / DAY_MS)
      : null;

    let phase: LifecyclePhase;
    if (ageDays <= 30) phase = "new";
    else if (units90 === 0) phase = "dead";
    else if (growth !== null && growth >= 0.2) phase = "growing";
    else if (growth !== null && growth <= -0.25) phase = "declining";
    else if (units30 === 0) phase = "declining";
    else phase = "mature";

    return {
      productId: product.id,
      title: product.title,
      status: product.status,
      ageDays,
      units30,
      unitsPrev30,
      units90,
      revenue90: entry?.revenue90 ?? 0,
      growth,
      velocity,
      stock: product.stock,
      daysOfStock: velocity > 0 ? product.stock / velocity : null,
      lastSoldAt,
      daysSinceLastSale,
      phase,
    };
  });

  rows.sort((a, b) => b.revenue90 - a.revenue90 || b.units30 - a.units30);

  const phaseOrder: LifecyclePhase[] = ["new", "growing", "mature", "declining", "dead"];
  const byPhase = phaseOrder
    .map((phase) => {
      const bucket = rows.filter((row) => row.phase === phase);
      return {
        phase,
        label: PHASE_LABELS[phase],
        products: bucket.length,
        revenue90: bucket.reduce((sum, row) => sum + row.revenue90, 0),
        units30: bucket.reduce((sum, row) => sum + row.units30, 0),
        stock: bucket.reduce((sum, row) => sum + row.stock, 0),
        share: rows.length ? bucket.length / rows.length : 0,
      };
    })
    .filter((entry) => entry.products > 0);

  return {
    rows,
    byPhase,
    summary: {
      products: rows.length,
      revenue90: rows.reduce((sum, row) => sum + row.revenue90, 0),
      deadStockValueUnits: rows
        .filter((row) => row.phase === "dead")
        .reduce((sum, row) => sum + row.stock, 0),
      newProducts: rows.filter((row) => row.phase === "new").length,
      decliningRevenue: rows
        .filter((row) => row.phase === "declining")
        .reduce((sum, row) => sum + row.revenue90, 0),
    },
  };
}
