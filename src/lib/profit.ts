/** Kârlılık hesapları için saf fonksiyonlar (sunucu + istemci ortak, test edilebilir). */

export type ProfitLine = {
  productId: string | null;
  variantId: string | null;
  title: string;
  quantity: number;
  revenue: number;
  unitCost: number | null;
};

export type ProfitRow = {
  key: string;
  productId: string | null;
  title: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  /** Maliyeti tanımlı olmayan satır sayısı (kâr eksik hesaplanır). */
  missingCost: number;
};

export function marginOf(revenue: number, cost: number): number {
  if (revenue <= 0) return 0;
  return (revenue - cost) / revenue;
}

/** Sipariş kalemlerini ürün bazında kâr/zarar satırlarına dönüştürür. */
export function buildProfitRows(lines: ProfitLine[]): ProfitRow[] {
  const map = new Map<string, ProfitRow>();
  for (const line of lines) {
    const key = line.productId ?? `t:${line.title}`;
    const row =
      map.get(key) ??
      ({
        key,
        productId: line.productId,
        title: line.title,
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        margin: 0,
        missingCost: 0,
      } satisfies ProfitRow);
    const qty = Number(line.quantity ?? 0);
    row.quantity += qty;
    row.revenue += Number(line.revenue ?? 0);
    if (line.unitCost == null || !Number.isFinite(line.unitCost)) row.missingCost += 1;
    else row.cost += line.unitCost * qty;
    map.set(key, row);
  }
  const rows = [...map.values()];
  for (const row of rows) {
    row.revenue = Math.round(row.revenue * 100) / 100;
    row.cost = Math.round(row.cost * 100) / 100;
    row.profit = Math.round((row.revenue - row.cost) * 100) / 100;
    row.margin = marginOf(row.revenue, row.cost);
  }
  return rows.sort((a, b) => b.profit - a.profit);
}

export function profitTotals(rows: ProfitRow[]) {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const cost = rows.reduce((sum, row) => sum + row.cost, 0);
  const quantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const missing = rows.reduce((sum, row) => sum + row.missingCost, 0);
  return {
    revenue: Math.round(revenue * 100) / 100,
    cost: Math.round(cost * 100) / 100,
    profit: Math.round((revenue - cost) * 100) / 100,
    margin: marginOf(revenue, cost),
    quantity,
    missing,
  };
}

/** Marj bandına göre renk sınıfı (düşük marj = uyarı). */
export function marginClass(margin: number): string {
  if (margin <= 0) return "bg-destructive/15 text-destructive";
  if (margin < 0.1) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  if (margin < 0.25) return "bg-muted text-foreground";
  if (margin < 0.45) return "bg-primary/15 text-primary";
  return "bg-primary/25 text-primary";
}

/** Hedef marja ulaşmak için gerekli satış fiyatı. */
export function priceForMargin(cost: number, targetMargin: number): number {
  const safeMargin = Math.min(Math.max(targetMargin, 0), 0.95);
  if (cost <= 0) return 0;
  return Math.round((cost / (1 - safeMargin)) * 100) / 100;
}
