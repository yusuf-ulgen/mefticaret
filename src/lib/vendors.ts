/** Marka / üretici (vendor) bazlı performans analizi. */

export type VendorSaleInput = {
  vendor: string;
  productId: string;
  units: number;
  revenue: number;
  cost: number;
};

export type VendorStockInput = {
  vendor: string;
  productId: string;
  stock: number;
  stockValue: number;
};

export type VendorReturnInput = {
  vendor: string;
  units: number;
  amount: number;
};

export type VendorRow = {
  vendor: string;
  products: number;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  marginRate: number;
  revenueShare: number;
  stockUnits: number;
  stockValue: number;
  returnUnits: number;
  returnAmount: number;
  returnRate: number;
  /** Stok devir katsayısı: satış maliyeti / stok maliyet değeri */
  turnover: number | null;
};

export function buildVendorRows(
  sales: VendorSaleInput[],
  stocks: VendorStockInput[],
  returns: VendorReturnInput[],
): VendorRow[] {
  const map = new Map<
    string,
    {
      products: Set<string>;
      units: number;
      revenue: number;
      cost: number;
      stockUnits: number;
      stockValue: number;
      returnUnits: number;
      returnAmount: number;
    }
  >();

  const ensure = (vendor: string) => {
    const key = vendor.trim() || "Belirtilmemiş";
    const existing = map.get(key);
    if (existing) return existing;
    const created = {
      products: new Set<string>(),
      units: 0,
      revenue: 0,
      cost: 0,
      stockUnits: 0,
      stockValue: 0,
      returnUnits: 0,
      returnAmount: 0,
    };
    map.set(key, created);
    return created;
  };

  for (const sale of sales) {
    const entry = ensure(sale.vendor);
    entry.products.add(sale.productId);
    entry.units += sale.units;
    entry.revenue += sale.revenue;
    entry.cost += sale.cost;
  }
  for (const stock of stocks) {
    const entry = ensure(stock.vendor);
    entry.products.add(stock.productId);
    entry.stockUnits += stock.stock;
    entry.stockValue += stock.stockValue;
  }
  for (const item of returns) {
    const entry = ensure(item.vendor);
    entry.returnUnits += item.units;
    entry.returnAmount += item.amount;
  }

  const totalRevenue = [...map.values()].reduce((sum, entry) => sum + entry.revenue, 0);

  return [...map.entries()]
    .map(([vendor, entry]) => {
      const profit = entry.revenue - entry.cost;
      return {
        vendor,
        products: entry.products.size,
        units: entry.units,
        revenue: entry.revenue,
        cost: entry.cost,
        profit,
        marginRate: entry.revenue > 0 ? (profit / entry.revenue) * 100 : 0,
        revenueShare: totalRevenue > 0 ? (entry.revenue / totalRevenue) * 100 : 0,
        stockUnits: entry.stockUnits,
        stockValue: entry.stockValue,
        returnUnits: entry.returnUnits,
        returnAmount: entry.returnAmount,
        returnRate: entry.units > 0 ? (entry.returnUnits / entry.units) * 100 : 0,
        turnover: entry.stockValue > 0 ? entry.cost / entry.stockValue : null,
      } satisfies VendorRow;
    })
    .sort((a, b) => b.revenue - a.revenue);
}

export type VendorSummary = {
  vendors: number;
  revenue: number;
  profit: number;
  marginRate: number;
  stockValue: number;
  /** En büyük 3 markanın ciro payı */
  topThreeShare: number;
  bestVendor: VendorRow | null;
  worstMarginVendor: VendorRow | null;
  highestReturnVendor: VendorRow | null;
};

export function vendorSummary(rows: VendorRow[]): VendorSummary {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const profit = rows.reduce((sum, row) => sum + row.profit, 0);
  const selling = rows.filter((row) => row.revenue > 0);

  return {
    vendors: rows.length,
    revenue,
    profit,
    marginRate: revenue > 0 ? (profit / revenue) * 100 : 0,
    stockValue: rows.reduce((sum, row) => sum + row.stockValue, 0),
    topThreeShare: rows.slice(0, 3).reduce((sum, row) => sum + row.revenueShare, 0),
    bestVendor: rows[0] ?? null,
    worstMarginVendor:
      [...selling].sort((a, b) => a.marginRate - b.marginRate)[0] ?? null,
    highestReturnVendor:
      [...selling].sort((a, b) => b.returnRate - a.returnRate)[0] ?? null,
  };
}
