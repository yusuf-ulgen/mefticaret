/** Kargo ekonomisi: ücretsiz kargo eşiği optimizasyonu ve kargo maliyet karşılama analizi. */

export type ShippingOrderInput = {
  orderId: string;
  subtotal: number;
  shippingCharged: number;
  discountTotal: number;
  grandTotal: number;
  createdAt: string;
};

export type ShippingSummary = {
  orders: number;
  revenue: number;
  shippingRevenue: number;
  shippingCost: number;
  shippingMargin: number;
  /** Kargo bedeli alınmayan sipariş oranı (%) */
  freeShareRate: number;
  averageOrderValue: number;
  /** Kargo giderinin ciroya oranı (%) */
  shippingCostRate: number;
};

export function shippingSummary(
  orders: ShippingOrderInput[],
  unitCost: number,
): ShippingSummary {
  const revenue = orders.reduce((sum, order) => sum + order.grandTotal, 0);
  const shippingRevenue = orders.reduce((sum, order) => sum + order.shippingCharged, 0);
  const shippingCost = orders.length * unitCost;
  const freeOrders = orders.filter((order) => order.shippingCharged <= 0).length;

  return {
    orders: orders.length,
    revenue,
    shippingRevenue,
    shippingCost,
    shippingMargin: shippingRevenue - shippingCost,
    freeShareRate: orders.length > 0 ? (freeOrders / orders.length) * 100 : 0,
    averageOrderValue: orders.length > 0 ? revenue / orders.length : 0,
    shippingCostRate: revenue > 0 ? (shippingCost / revenue) * 100 : 0,
  };
}

export type ThresholdScenario = {
  threshold: number;
  /** Eşiği zaten geçen sipariş sayısı */
  qualifying: number;
  qualifyingRate: number;
  /** Eşiğe yakın olup (0.75x-1x) yukarı çekilebilecek sipariş sayısı */
  nudgeable: number;
  /** Ücretsiz kargo verilen siparişlerin kargo gideri */
  freeShippingCost: number;
  /** Eşik altı siparişlerden tahsil edilen kargo geliri */
  collectedShipping: number;
  /** Nudge edilen siparişlerin sepetini eşiğe çıkarmanın getirdiği ek ciro */
  upliftRevenue: number;
  netImpact: number;
};

/** Eşik senaryolarını sepet dağılımı üzerinden değerlendirir. */
export function thresholdScenarios(
  orders: ShippingOrderInput[],
  unitCost: number,
  shippingPrice: number,
  /** Eşiğe yakın siparişlerin yukarı çekilme olasılığı (0-1) */
  nudgeRate = 0.35,
  thresholds?: number[],
): ThresholdScenario[] {
  const values = orders.map((order) => order.subtotal).sort((a, b) => a - b);
  if (values.length === 0) return [];

  const candidates =
    thresholds ??
    (() => {
      const median = values[Math.floor(values.length / 2)] ?? 0;
      const steps = [0.8, 1, 1.2, 1.5, 1.8, 2.2];
      return steps
        .map((factor) => Math.round((median * factor) / 50) * 50)
        .filter((value, index, list) => value > 0 && list.indexOf(value) === index);
    })();

  return candidates.map((threshold) => {
    const qualifying = orders.filter((order) => order.subtotal >= threshold);
    const nudgeableOrders = orders.filter(
      (order) => order.subtotal < threshold && order.subtotal >= threshold * 0.75,
    );
    const nudgeable = nudgeableOrders.length * nudgeRate;
    const uplift = nudgeableOrders.reduce(
      (sum, order) => sum + (threshold - order.subtotal) * nudgeRate,
      0,
    );
    const belowCount = orders.length - qualifying.length - nudgeable;
    const freeShippingCost = (qualifying.length + nudgeable) * unitCost;
    const collectedShipping = Math.max(0, belowCount) * shippingPrice;

    return {
      threshold,
      qualifying: qualifying.length,
      qualifyingRate: (qualifying.length / orders.length) * 100,
      nudgeable,
      freeShippingCost,
      collectedShipping,
      upliftRevenue: uplift,
      netImpact: uplift + collectedShipping - freeShippingCost,
    };
  });
}

export type BasketBand = {
  label: string;
  min: number;
  max: number | null;
  orders: number;
  revenue: number;
  share: number;
};

export function basketBands(orders: ShippingOrderInput[]): BasketBand[] {
  const values = orders.map((order) => order.subtotal);
  const max = Math.max(0, ...values);
  const step = Math.max(50, Math.ceil(max / 6 / 50) * 50);
  const bands: BasketBand[] = [];

  for (let index = 0; index < 6; index += 1) {
    const min = index * step;
    const upper = index === 5 ? null : min + step;
    const items = orders.filter(
      (order) => order.subtotal >= min && (upper === null || order.subtotal < upper),
    );
    bands.push({
      label: upper === null ? `${min}+` : `${min}-${upper}`,
      min,
      max: upper,
      orders: items.length,
      revenue: items.reduce((sum, order) => sum + order.subtotal, 0),
      share: orders.length > 0 ? (items.length / orders.length) * 100 : 0,
    });
  }

  return bands;
}
