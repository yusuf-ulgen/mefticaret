/** Stok yaşlandırma (inventory aging): son satış tarihine göre sermaye bağlanma analizi. */

export type AgingInput = {
  productId: string;
  title: string;
  sku: string | null;
  stock: number;
  price: number;
  costPrice: number | null;
  createdAt: string;
  lastSaleAt: string | null;
  units90: number;
};

export type AgingBucketKey = "fresh" | "slow" | "stale" | "dead";

export type AgingRow = AgingInput & {
  /** Son satıştan (veya ürün açılışından) bu yana geçen gün */
  daysSinceSale: number;
  bucket: AgingBucketKey;
  stockValue: number;
  retailValue: number;
  /** Günlük satış hızı (son 90 gün) */
  velocity: number;
  /** Mevcut stoğun tükenme süresi (gün), hız yoksa null */
  coverDays: number | null;
};

export type AgingBucket = {
  key: AgingBucketKey;
  label: string;
  minDays: number;
  maxDays: number | null;
  products: number;
  units: number;
  stockValue: number;
  retailValue: number;
};

export const AGING_BUCKETS: { key: AgingBucketKey; label: string; minDays: number; maxDays: number | null }[] = [
  { key: "fresh", label: "0-30 gün", minDays: 0, maxDays: 30 },
  { key: "slow", label: "31-60 gün", minDays: 31, maxDays: 60 },
  { key: "stale", label: "61-120 gün", minDays: 61, maxDays: 120 },
  { key: "dead", label: "120+ gün", minDays: 121, maxDays: null },
];

const DAY = 24 * 60 * 60 * 1000;

function daysBetween(from: string, now: number): number {
  const value = Date.parse(from);
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.floor((now - value) / DAY));
}

export function buildAging(inputs: AgingInput[], now = Date.now()): AgingRow[] {
  return inputs
    .filter((item) => item.stock > 0)
    .map((item) => {
      const daysSinceSale = daysBetween(item.lastSaleAt ?? item.createdAt, now);
      const bucket =
        AGING_BUCKETS.find(
          (candidate) =>
            daysSinceSale >= candidate.minDays &&
            (candidate.maxDays === null || daysSinceSale <= candidate.maxDays),
        )?.key ?? "dead";
      const unitCost = item.costPrice ?? item.price * 0.6;
      const velocity = item.units90 / 90;
      return {
        ...item,
        daysSinceSale,
        bucket,
        stockValue: unitCost * item.stock,
        retailValue: item.price * item.stock,
        velocity,
        coverDays: velocity > 0 ? item.stock / velocity : null,
      };
    })
    .sort((a, b) => b.daysSinceSale - a.daysSinceSale || b.stockValue - a.stockValue);
}

export function agingBuckets(rows: AgingRow[]): AgingBucket[] {
  return AGING_BUCKETS.map((bucket) => {
    const items = rows.filter((row) => row.bucket === bucket.key);
    return {
      ...bucket,
      products: items.length,
      units: items.reduce((sum, row) => sum + row.stock, 0),
      stockValue: items.reduce((sum, row) => sum + row.stockValue, 0),
      retailValue: items.reduce((sum, row) => sum + row.retailValue, 0),
    };
  });
}

export type AgingSummary = {
  products: number;
  units: number;
  stockValue: number;
  retailValue: number;
  /** 120+ gündür satılmayan stoğun toplam maliyet değeri */
  deadValue: number;
  deadShare: number;
  /** Stok değeri ağırlıklı ortalama yaş */
  averageAgeDays: number;
  neverSold: number;
};

export function agingSummary(rows: AgingRow[]): AgingSummary {
  const stockValue = rows.reduce((sum, row) => sum + row.stockValue, 0);
  const deadValue = rows
    .filter((row) => row.bucket === "dead")
    .reduce((sum, row) => sum + row.stockValue, 0);
  const weighted = rows.reduce((sum, row) => sum + row.daysSinceSale * row.stockValue, 0);

  return {
    products: rows.length,
    units: rows.reduce((sum, row) => sum + row.stock, 0),
    stockValue,
    retailValue: rows.reduce((sum, row) => sum + row.retailValue, 0),
    deadValue,
    deadShare: stockValue > 0 ? (deadValue / stockValue) * 100 : 0,
    averageAgeDays: stockValue > 0 ? weighted / stockValue : 0,
    neverSold: rows.filter((row) => row.lastSaleAt === null).length,
  };
}

/** Tasfiye önerisi: yaşa göre kademeli indirim oranı ve tahmini nakit girişi. */
export function liquidationPlan(rows: AgingRow[]) {
  return rows
    .filter((row) => row.bucket === "stale" || row.bucket === "dead")
    .map((row) => {
      const discount = row.bucket === "dead" ? (row.daysSinceSale > 240 ? 0.5 : 0.35) : 0.2;
      const cashIn = row.retailValue * (1 - discount);
      return {
        ...row,
        discount,
        cashIn,
        marginAfter: cashIn - row.stockValue,
      };
    })
    .sort((a, b) => b.stockValue - a.stockValue);
}
