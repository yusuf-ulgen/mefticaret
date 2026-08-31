/** Kampanya (kupon) performans hesaplama motoru — saf fonksiyonlar. */

export type CampaignOrder = {
  id: string;
  placedAt: string;
  grandTotal: number;
  discountTotal: number;
  subtotal: number;
  discountCode: string | null;
  customerKey: string | null;
};

export type CampaignDiscount = {
  id: string;
  code: string;
  title: string | null;
  type: string;
  value: number;
  isActive: boolean;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string;
  endsAt: string | null;
};

export type CampaignInput = {
  orders: CampaignOrder[];
  discounts: CampaignDiscount[];
};

export type CampaignRow = {
  code: string;
  title: string | null;
  type: string;
  value: number;
  isActive: boolean;
  orders: number;
  revenue: number;
  discountGiven: number;
  aov: number;
  discountRate: number;
  newCustomers: number;
  repeatCustomers: number;
  usageLimit: number | null;
  usedCount: number;
  endsAt: string | null;
};

const norm = (code: string | null) => (code ? code.trim().toUpperCase() : null);

/** Kupon başına sipariş, ciro, verilen indirim ve müşteri kırılımı. */
export function campaignRows(input: CampaignInput): CampaignRow[] {
  const firstOrderByCustomer = new Map<string, string>();
  for (const order of [...input.orders].sort((a, b) => a.placedAt.localeCompare(b.placedAt))) {
    if (!order.customerKey) continue;
    if (!firstOrderByCustomer.has(order.customerKey)) {
      firstOrderByCustomer.set(order.customerKey, order.id);
    }
  }

  const map = new Map<string, CampaignRow>();
  const meta = new Map(input.discounts.map((d) => [norm(d.code) ?? d.code, d]));

  for (const order of input.orders) {
    const code = norm(order.discountCode);
    if (!code) continue;
    const info = meta.get(code);
    const row =
      map.get(code) ??
      ({
        code,
        title: info?.title ?? null,
        type: info?.type ?? "unknown",
        value: info?.value ?? 0,
        isActive: info?.isActive ?? false,
        orders: 0,
        revenue: 0,
        discountGiven: 0,
        aov: 0,
        discountRate: 0,
        newCustomers: 0,
        repeatCustomers: 0,
        usageLimit: info?.usageLimit ?? null,
        usedCount: info?.usedCount ?? 0,
        endsAt: info?.endsAt ?? null,
      } satisfies CampaignRow);

    row.orders += 1;
    row.revenue += order.grandTotal;
    row.discountGiven += order.discountTotal;
    if (order.customerKey) {
      if (firstOrderByCustomer.get(order.customerKey) === order.id) row.newCustomers += 1;
      else row.repeatCustomers += 1;
    }
    map.set(code, row);
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      aov: row.orders > 0 ? row.revenue / row.orders : 0,
      discountRate: row.revenue + row.discountGiven > 0 ? row.discountGiven / (row.revenue + row.discountGiven) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export type CampaignSummary = {
  totalOrders: number;
  couponOrders: number;
  couponShare: number;
  couponRevenue: number;
  totalRevenue: number;
  discountGiven: number;
  couponAov: number;
  organicAov: number;
  aovLift: number;
  activeCampaigns: number;
};

/** Genel kupon etkisi: kullanım payı, verilen indirim ve sepet artışı. */
export function campaignSummary(input: CampaignInput): CampaignSummary {
  const rows = campaignRows(input);
  const couponOrders = rows.reduce((sum, r) => sum + r.orders, 0);
  const couponRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const discountGiven = rows.reduce((sum, r) => sum + r.discountGiven, 0);
  const totalRevenue = input.orders.reduce((sum, o) => sum + o.grandTotal, 0);
  const organicOrders = input.orders.length - couponOrders;
  const organicRevenue = totalRevenue - couponRevenue;
  const couponAov = couponOrders > 0 ? couponRevenue / couponOrders : 0;
  const organicAov = organicOrders > 0 ? organicRevenue / organicOrders : 0;

  return {
    totalOrders: input.orders.length,
    couponOrders,
    couponShare: input.orders.length > 0 ? couponOrders / input.orders.length : 0,
    couponRevenue,
    totalRevenue,
    discountGiven,
    couponAov,
    organicAov,
    aovLift: organicAov > 0 ? couponAov / organicAov - 1 : 0,
    activeCampaigns: input.discounts.filter((d) => d.isActive).length,
  };
}

export type CampaignTrendPoint = { date: string; couponRevenue: number; organicRevenue: number; couponOrders: number };

/** Günlük kuponlu vs kuponsuz ciro trendi. */
export function campaignTrend(input: CampaignInput, windowDays: number): CampaignTrendPoint[] {
  const buckets = new Map<string, CampaignTrendPoint>();
  const today = new Date();
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const date = new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    buckets.set(date, { date, couponRevenue: 0, organicRevenue: 0, couponOrders: 0 });
  }
  for (const order of input.orders) {
    const date = order.placedAt.slice(0, 10);
    const bucket = buckets.get(date);
    if (!bucket) continue;
    if (norm(order.discountCode)) {
      bucket.couponRevenue += order.grandTotal;
      bucket.couponOrders += 1;
    } else {
      bucket.organicRevenue += order.grandTotal;
    }
  }
  return [...buckets.values()];
}

/** Süresi yakında dolan veya kullanım limitine yaklaşan kuponlar. */
export function campaignAlerts(input: CampaignInput, days = 14) {
  const limit = Date.now() + days * 86_400_000;
  return input.discounts
    .filter((d) => d.isActive)
    .map((d) => {
      const expiringSoon = d.endsAt ? new Date(d.endsAt).getTime() <= limit : false;
      const usageRatio = d.usageLimit && d.usageLimit > 0 ? d.usedCount / d.usageLimit : 0;
      return { ...d, expiringSoon, usageRatio, nearLimit: usageRatio >= 0.8 };
    })
    .filter((d) => d.expiringSoon || d.nearLimit);
}
