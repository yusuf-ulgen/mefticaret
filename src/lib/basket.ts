/**
 * Sepet analizi (market basket) — saf hesaplama katmanı.
 *
 * Sipariş kalemlerinden ürün çiftleri çıkarılır; birlikte görülme sayısı (support),
 * "A alındıysa B de alınır" güveni (confidence) ve rastgeleliğe göre kaç kat daha
 * sık birlikte alındığını gösteren lift metriği hesaplanır.
 */

export type BasketItemInput = {
  orderId: string;
  productId: string;
  title: string;
  quantity: number;
  lineTotal: number;
};

export type BasketPair = {
  key: string;
  aId: string;
  bId: string;
  aTitle: string;
  bTitle: string;
  /** Çiftin birlikte göründüğü sipariş sayısı */
  support: number;
  /** support / toplam sipariş */
  supportRate: number;
  /** A alan siparişlerde B oranı */
  confidenceAB: number;
  /** B alan siparişlerde A oranı */
  confidenceBA: number;
  /** Beklenene göre kat sayısı (>1 anlamlı birliktelik) */
  lift: number;
  /** Bu çiftin bulunduğu siparişlerin toplam cirosu */
  revenue: number;
};

export type BasketProduct = {
  productId: string;
  title: string;
  orders: number;
  units: number;
  revenue: number;
  /** Yalnız başına (tek kalemli siparişte) satılma oranı */
  soloRate: number;
  /** Birlikte alındığı farklı ürün sayısı */
  partners: number;
};

export type BasketSummary = {
  orders: number;
  multiItemOrders: number;
  attachRate: number;
  avgItemsPerOrder: number;
  avgOrderValue: number;
  pairCount: number;
};

export type BasketAnalysis = {
  summary: BasketSummary;
  pairs: BasketPair[];
  products: BasketProduct[];
};

export function analyzeBaskets(items: BasketItemInput[]): BasketAnalysis {
  const orders = new Map<string, { products: Map<string, { units: number; revenue: number }> }>();

  for (const item of items) {
    if (!item.productId) continue;
    const order = orders.get(item.orderId) ?? { products: new Map() };
    const current = order.products.get(item.productId) ?? { units: 0, revenue: 0 };
    current.units += Math.max(0, item.quantity);
    current.revenue += item.lineTotal;
    order.products.set(item.productId, current);
    orders.set(item.orderId, order);
  }

  const titles = new Map<string, string>();
  for (const item of items) {
    if (item.productId && !titles.has(item.productId)) titles.set(item.productId, item.title);
  }

  const totalOrders = orders.size;
  const productStats = new Map<
    string,
    { orders: number; units: number; revenue: number; solo: number; partners: Set<string> }
  >();
  const pairStats = new Map<string, { support: number; revenue: number; a: string; b: string }>();

  let multiItemOrders = 0;
  let totalLines = 0;
  let totalRevenue = 0;

  for (const order of orders.values()) {
    const ids = [...order.products.keys()];
    totalLines += ids.length;
    const orderRevenue = [...order.products.values()].reduce((sum, row) => sum + row.revenue, 0);
    totalRevenue += orderRevenue;
    if (ids.length > 1) multiItemOrders += 1;

    for (const id of ids) {
      const row = order.products.get(id)!;
      const stat =
        productStats.get(id) ??
        { orders: 0, units: 0, revenue: 0, solo: 0, partners: new Set<string>() };
      stat.orders += 1;
      stat.units += row.units;
      stat.revenue += row.revenue;
      if (ids.length === 1) stat.solo += 1;
      for (const other of ids) if (other !== id) stat.partners.add(other);
      productStats.set(id, stat);
    }

    const sorted = [...ids].sort();
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i]!;
        const b = sorted[j]!;
        const key = `${a}__${b}`;
        const pair = pairStats.get(key) ?? { support: 0, revenue: 0, a, b };
        pair.support += 1;
        pair.revenue += orderRevenue;
        pairStats.set(key, pair);
      }
    }
  }

  const pairs: BasketPair[] = [...pairStats.entries()]
    .map(([key, pair]) => {
      const aOrders = productStats.get(pair.a)?.orders ?? 0;
      const bOrders = productStats.get(pair.b)?.orders ?? 0;
      const supportRate = totalOrders > 0 ? pair.support / totalOrders : 0;
      const pA = totalOrders > 0 ? aOrders / totalOrders : 0;
      const pB = totalOrders > 0 ? bOrders / totalOrders : 0;
      return {
        key,
        aId: pair.a,
        bId: pair.b,
        aTitle: titles.get(pair.a) ?? pair.a,
        bTitle: titles.get(pair.b) ?? pair.b,
        support: pair.support,
        supportRate,
        confidenceAB: aOrders > 0 ? pair.support / aOrders : 0,
        confidenceBA: bOrders > 0 ? pair.support / bOrders : 0,
        lift: pA > 0 && pB > 0 ? supportRate / (pA * pB) : 0,
        revenue: pair.revenue,
      } satisfies BasketPair;
    })
    .sort((x, y) => y.support - x.support || y.lift - x.lift);

  const products: BasketProduct[] = [...productStats.entries()]
    .map(([productId, stat]) => ({
      productId,
      title: titles.get(productId) ?? productId,
      orders: stat.orders,
      units: stat.units,
      revenue: stat.revenue,
      soloRate: stat.orders > 0 ? stat.solo / stat.orders : 0,
      partners: stat.partners.size,
    }))
    .sort((x, y) => y.revenue - x.revenue);

  return {
    summary: {
      orders: totalOrders,
      multiItemOrders,
      attachRate: totalOrders > 0 ? multiItemOrders / totalOrders : 0,
      avgItemsPerOrder: totalOrders > 0 ? totalLines / totalOrders : 0,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      pairCount: pairs.length,
    },
    pairs,
    products,
  };
}

/** Seçili ürünle birlikte en sık alınan ürünler (öneri listesi). */
export function recommendationsFor(
  analysis: BasketAnalysis,
  productId: string,
  limit = 8,
): { productId: string; title: string; support: number; confidence: number; lift: number }[] {
  return analysis.pairs
    .filter((pair) => pair.aId === productId || pair.bId === productId)
    .map((pair) => {
      const isA = pair.aId === productId;
      return {
        productId: isA ? pair.bId : pair.aId,
        title: isA ? pair.bTitle : pair.aTitle,
        support: pair.support,
        confidence: isA ? pair.confidenceAB : pair.confidenceBA,
        lift: pair.lift,
      };
    })
    .sort((a, b) => b.confidence - a.confidence || b.support - a.support)
    .slice(0, limit);
}
