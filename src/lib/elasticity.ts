/** İndirim derinliği & fiyat esnekliği analizi (saf hesaplama). */

export type ElasticityItemInput = {
  orderId: string;
  productId: string | null;
  variantId: string | null;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  createdAt: string;
};

export type ElasticityVariantInput = {
  id: string;
  productId: string;
  price: number;
  costPrice: number | null;
};

export type DiscountBand = "full" | "light" | "medium" | "deep" | "extreme";

export const BAND_LABELS: Record<DiscountBand, string> = {
  full: "Liste fiyatı (0%)",
  light: "Hafif (0-10%)",
  medium: "Orta (10-25%)",
  deep: "Derin (25-40%)",
  extreme: "Aşırı (40%+)",
};

export function bandOf(depth: number): DiscountBand {
  if (depth <= 0.001) return "full";
  if (depth < 0.1) return "light";
  if (depth < 0.25) return "medium";
  if (depth < 0.4) return "deep";
  return "extreme";
}

export type BandStat = {
  band: DiscountBand;
  label: string;
  units: number;
  revenue: number;
  orders: number;
  margin: number;
  avgDepth: number;
  share: number;
};

export type ProductElasticity = {
  productId: string;
  title: string;
  units: number;
  revenue: number;
  listRevenue: number;
  avgSoldPrice: number;
  listPrice: number;
  avgDepth: number;
  discountCost: number;
  margin: number;
  marginRate: number;
  discountedUnits: number;
  fullPriceUnits: number;
  /** İndirimli birimlerin indirimsiz birimlere göre satış hacmi çarpanı. */
  volumeLift: number | null;
  band: DiscountBand;
};

export type ElasticityAnalysis = {
  bands: BandStat[];
  products: ProductElasticity[];
  summary: {
    units: number;
    revenue: number;
    listRevenue: number;
    discountCost: number;
    avgDepth: number;
    margin: number;
    marginRate: number;
    marginLossProducts: number;
  };
};

export function analyzeElasticity(
  items: ElasticityItemInput[],
  variants: ElasticityVariantInput[],
): ElasticityAnalysis {
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const productList = new Map<string, { price: number; cost: number | null }>();
  for (const variant of variants) {
    const current = productList.get(variant.productId);
    const cost = variant.costPrice ?? null;
    if (!current || variant.price > current.price) {
      productList.set(variant.productId, { price: variant.price, cost });
    } else if (current.cost === null && cost !== null) {
      productList.set(variant.productId, { price: current.price, cost });
    }
  }

  const bandMap = new Map<
    DiscountBand,
    { units: number; revenue: number; orders: Set<string>; margin: number; depthWeight: number }
  >();
  const ensureBand = (band: DiscountBand) => {
    let entry = bandMap.get(band);
    if (!entry) {
      entry = { units: 0, revenue: 0, orders: new Set<string>(), margin: 0, depthWeight: 0 };
      bandMap.set(band, entry);
    }
    return entry;
  };

  const productMap = new Map<
    string,
    {
      title: string;
      units: number;
      revenue: number;
      listRevenue: number;
      cost: number;
      discountedUnits: number;
      fullPriceUnits: number;
      listPrice: number;
      hasCost: boolean;
    }
  >();

  for (const item of items) {
    const quantity = Math.max(0, item.quantity);
    if (!quantity) continue;
    const productKey = item.productId ?? `title:${item.title}`;
    const variant = item.variantId ? variantById.get(item.variantId) : undefined;
    const productRef = item.productId ? productList.get(item.productId) : undefined;
    const listPrice = Math.max(variant?.price ?? 0, productRef?.price ?? 0, item.unitPrice);
    const unitCost = variant?.costPrice ?? productRef?.cost ?? null;
    const revenue = item.lineTotal || item.unitPrice * quantity;
    const listRevenue = listPrice * quantity;
    const depth = listPrice > 0 ? Math.max(0, 1 - item.unitPrice / listPrice) : 0;
    const margin = unitCost === null ? 0 : revenue - unitCost * quantity;

    const band = ensureBand(bandOf(depth));
    band.units += quantity;
    band.revenue += revenue;
    band.orders.add(item.orderId);
    band.margin += margin;
    band.depthWeight += depth * quantity;

    let product = productMap.get(productKey);
    if (!product) {
      product = {
        title: item.title,
        units: 0,
        revenue: 0,
        listRevenue: 0,
        cost: 0,
        discountedUnits: 0,
        fullPriceUnits: 0,
        listPrice: 0,
        hasCost: false,
      };
      productMap.set(productKey, product);
    }
    product.units += quantity;
    product.revenue += revenue;
    product.listRevenue += listRevenue;
    product.listPrice = Math.max(product.listPrice, listPrice);
    if (unitCost !== null) {
      product.cost += unitCost * quantity;
      product.hasCost = true;
    }
    if (depth > 0.001) product.discountedUnits += quantity;
    else product.fullPriceUnits += quantity;
  }

  const totalUnits = [...bandMap.values()].reduce((sum, entry) => sum + entry.units, 0);
  const bandOrder: DiscountBand[] = ["full", "light", "medium", "deep", "extreme"];
  const bands: BandStat[] = bandOrder
    .filter((band) => bandMap.has(band))
    .map((band) => {
      const entry = bandMap.get(band)!;
      return {
        band,
        label: BAND_LABELS[band],
        units: entry.units,
        revenue: entry.revenue,
        orders: entry.orders.size,
        margin: entry.margin,
        avgDepth: entry.units ? entry.depthWeight / entry.units : 0,
        share: totalUnits ? entry.units / totalUnits : 0,
      };
    });

  const products: ProductElasticity[] = [...productMap.entries()]
    .map(([productId, product]) => {
      const avgSoldPrice = product.units ? product.revenue / product.units : 0;
      const avgDepth =
        product.listRevenue > 0 ? Math.max(0, 1 - product.revenue / product.listRevenue) : 0;
      const margin = product.hasCost ? product.revenue - product.cost : 0;
      return {
        productId,
        title: product.title,
        units: product.units,
        revenue: product.revenue,
        listRevenue: product.listRevenue,
        avgSoldPrice,
        listPrice: product.listPrice,
        avgDepth,
        discountCost: Math.max(0, product.listRevenue - product.revenue),
        margin,
        marginRate: product.revenue > 0 && product.hasCost ? margin / product.revenue : 0,
        discountedUnits: product.discountedUnits,
        fullPriceUnits: product.fullPriceUnits,
        volumeLift: product.fullPriceUnits
          ? product.discountedUnits / product.fullPriceUnits
          : null,
        band: bandOf(avgDepth),
      };
    })
    .sort((a, b) => b.discountCost - a.discountCost || b.revenue - a.revenue);

  const revenue = products.reduce((sum, product) => sum + product.revenue, 0);
  const listRevenue = products.reduce((sum, product) => sum + product.listRevenue, 0);
  const margin = products.reduce((sum, product) => sum + product.margin, 0);

  return {
    bands,
    products,
    summary: {
      units: totalUnits,
      revenue,
      listRevenue,
      discountCost: Math.max(0, listRevenue - revenue),
      avgDepth: listRevenue > 0 ? Math.max(0, 1 - revenue / listRevenue) : 0,
      margin,
      marginRate: revenue > 0 ? margin / revenue : 0,
      marginLossProducts: products.filter((product) => product.margin < 0).length,
    },
  };
}
