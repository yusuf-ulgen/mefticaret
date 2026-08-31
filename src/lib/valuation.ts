/**
 * Envanter değerleme — saf hesaplama katmanı.
 *
 * Her varyant için maliyet değeri (stok × alış fiyatı), perakende değeri
 * (stok × satış fiyatı) ve potansiyel brüt kâr hesaplanır. Maliyet fiyatı
 * girilmemiş kalemler "eksik maliyet" olarak işaretlenir; bu kalemler
 * toplam maliyet değerine 0 katkı yapar ve raporda ayrıca uyarılır.
 */

export type ValuationInput = {
  variantId: string;
  productId: string | null;
  title: string;
  sku: string | null;
  vendor: string | null;
  productType: string | null;
  status: string;
  stock: number;
  price: number;
  costPrice: number | null;
};

export type ValuationLine = ValuationInput & {
  /** Stok × maliyet fiyatı */
  costValue: number;
  /** Stok × satış fiyatı */
  retailValue: number;
  /** Perakende - maliyet (yalnızca maliyet biliniyorsa) */
  potentialProfit: number;
  /** Brüt marj oranı (0-1) veya maliyet yoksa null */
  margin: number | null;
  missingCost: boolean;
};

export type ValuationGroup = {
  key: string;
  label: string;
  items: number;
  units: number;
  costValue: number;
  retailValue: number;
  potentialProfit: number;
  /** Toplam maliyet değerindeki pay (0-1) */
  share: number;
};

export type ValuationSummary = {
  skuCount: number;
  units: number;
  costValue: number;
  retailValue: number;
  potentialProfit: number;
  /** Ortalama brüt marj (0-1) veya hesaplanamıyorsa null */
  blendedMargin: number | null;
  missingCostCount: number;
  outOfStockCount: number;
  negativeMarginCount: number;
};

export type ValuationGroupBy = "vendor" | "productType" | "status";

export const GROUP_LABEL: Record<ValuationGroupBy, string> = {
  vendor: "Marka / tedarikçi",
  productType: "Ürün tipi",
  status: "Ürün durumu",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Taslak",
  active: "Yayında",
  archived: "Arşiv",
};

export function buildValuation(inputs: ValuationInput[]): ValuationLine[] {
  return inputs
    .map((input) => {
      const stock = Math.max(0, input.stock);
      const missingCost = input.costPrice == null;
      const costValue = missingCost ? 0 : stock * Number(input.costPrice);
      const retailValue = stock * input.price;
      const potentialProfit = missingCost ? 0 : retailValue - costValue;
      const margin =
        missingCost || retailValue <= 0 ? null : (retailValue - costValue) / retailValue;
      return { ...input, costValue, retailValue, potentialProfit, margin, missingCost };
    })
    .sort((a, b) => b.retailValue - a.retailValue);
}

export function valuationSummary(lines: ValuationLine[]): ValuationSummary {
  const costValue = lines.reduce((sum, line) => sum + line.costValue, 0);
  const retailValue = lines.reduce((sum, line) => sum + line.retailValue, 0);
  const known = lines.filter((line) => !line.missingCost);
  const knownRetail = known.reduce((sum, line) => sum + line.retailValue, 0);
  const knownCost = known.reduce((sum, line) => sum + line.costValue, 0);

  return {
    skuCount: lines.length,
    units: lines.reduce((sum, line) => sum + Math.max(0, line.stock), 0),
    costValue,
    retailValue,
    potentialProfit: knownRetail - knownCost,
    blendedMargin: knownRetail > 0 ? (knownRetail - knownCost) / knownRetail : null,
    missingCostCount: lines.filter((line) => line.missingCost).length,
    outOfStockCount: lines.filter((line) => line.stock <= 0).length,
    negativeMarginCount: lines.filter((line) => line.margin !== null && line.margin < 0).length,
  };
}

export function groupValuation(lines: ValuationLine[], by: ValuationGroupBy): ValuationGroup[] {
  const totalCost = lines.reduce((sum, line) => sum + line.costValue, 0);
  const buckets = new Map<string, ValuationGroup>();

  for (const line of lines) {
    const raw =
      by === "vendor" ? line.vendor : by === "productType" ? line.productType : line.status;
    const key = raw && raw.trim() ? raw.trim() : "__none__";
    const label =
      key === "__none__"
        ? "Belirtilmemiş"
        : by === "status"
          ? (STATUS_LABEL[key] ?? key)
          : key;
    const bucket =
      buckets.get(key) ??
      ({
        key,
        label,
        items: 0,
        units: 0,
        costValue: 0,
        retailValue: 0,
        potentialProfit: 0,
        share: 0,
      } satisfies ValuationGroup);
    bucket.items += 1;
    bucket.units += Math.max(0, line.stock);
    bucket.costValue += line.costValue;
    bucket.retailValue += line.retailValue;
    bucket.potentialProfit += line.potentialProfit;
    buckets.set(key, bucket);
  }

  return [...buckets.values()]
    .map((bucket) => ({
      ...bucket,
      share: totalCost > 0 ? bucket.costValue / totalCost : 0,
    }))
    .sort((a, b) => b.retailValue - a.retailValue);
}
