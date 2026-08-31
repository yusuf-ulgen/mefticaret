/**
 * Coğrafi satış dağılımı — saf hesaplama katmanı.
 *
 * Sipariş teslimat adreslerinden şehir/ilçe/ülke bazlı ciro, sipariş adedi,
 * ortalama sepet ve müşteri sayısı çıkarılır; en hızlı büyüyen bölgeler
 * son 30 gün ile önceki 30 gün karşılaştırılarak bulunur.
 */

export type GeoOrderInput = {
  id: string;
  placedAt: string;
  grandTotal: number;
  shippingTotal: number;
  status: string;
  customerKey: string | null;
  country: string | null;
  city: string | null;
  district: string | null;
};

export type GeoRow = {
  key: string;
  label: string;
  parent: string | null;
  orders: number;
  revenue: number;
  shipping: number;
  customers: number;
  avgOrderValue: number;
  share: number;
  recentRevenue: number;
  previousRevenue: number;
  growth: number | null;
};

export type GeoAnalysis = {
  totals: { orders: number; revenue: number; regions: number; avgOrderValue: number };
  countries: GeoRow[];
  cities: GeoRow[];
  districts: GeoRow[];
  /** Son 30 günde en hızlı büyüyen şehirler */
  risers: GeoRow[];
};

const norm = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

type Bucket = {
  label: string;
  parent: string | null;
  orders: number;
  revenue: number;
  shipping: number;
  customers: Set<string>;
  recentRevenue: number;
  previousRevenue: number;
};

const DAY = 24 * 60 * 60 * 1000;

export function analyzeGeo(orders: GeoOrderInput[], now: Date = new Date()): GeoAnalysis {
  const nowMs = now.getTime();
  const cancelled = new Set(["cancelled", "refunded"]);
  const valid = orders.filter((order) => !cancelled.has(order.status));

  const make = () => new Map<string, Bucket>();
  const countryMap = make();
  const cityMap = make();
  const districtMap = make();

  const add = (
    map: Map<string, Bucket>,
    key: string,
    label: string,
    parent: string | null,
    order: GeoOrderInput,
  ) => {
    const bucket =
      map.get(key) ??
      {
        label,
        parent,
        orders: 0,
        revenue: 0,
        shipping: 0,
        customers: new Set<string>(),
        recentRevenue: 0,
        previousRevenue: 0,
      };
    bucket.orders += 1;
    bucket.revenue += order.grandTotal;
    bucket.shipping += order.shippingTotal;
    if (order.customerKey) bucket.customers.add(order.customerKey);

    const age = nowMs - new Date(order.placedAt).getTime();
    if (age <= 30 * DAY) bucket.recentRevenue += order.grandTotal;
    else if (age <= 60 * DAY) bucket.previousRevenue += order.grandTotal;

    map.set(key, bucket);
  };

  let totalRevenue = 0;
  for (const order of valid) {
    totalRevenue += order.grandTotal;
    const country = norm(order.country) ?? "Bilinmiyor";
    const city = norm(order.city) ?? "Bilinmiyor";
    const district = norm(order.district);

    add(countryMap, country, country, null, order);
    add(cityMap, `${country}|${city}`, city, country, order);
    if (district) {
      add(districtMap, `${country}|${city}|${district}`, `${city} / ${district}`, city, order);
    }
  }

  const toRows = (map: Map<string, Bucket>): GeoRow[] =>
    [...map.entries()]
      .map(([key, bucket]) => ({
        key,
        label: bucket.label,
        parent: bucket.parent,
        orders: bucket.orders,
        revenue: bucket.revenue,
        shipping: bucket.shipping,
        customers: bucket.customers.size,
        avgOrderValue: bucket.orders ? bucket.revenue / bucket.orders : 0,
        share: totalRevenue > 0 ? bucket.revenue / totalRevenue : 0,
        recentRevenue: bucket.recentRevenue,
        previousRevenue: bucket.previousRevenue,
        growth:
          bucket.previousRevenue > 0
            ? (bucket.recentRevenue - bucket.previousRevenue) / bucket.previousRevenue
            : bucket.recentRevenue > 0
              ? null
              : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

  const cities = toRows(cityMap);

  return {
    totals: {
      orders: valid.length,
      revenue: totalRevenue,
      regions: cityMap.size,
      avgOrderValue: valid.length ? totalRevenue / valid.length : 0,
    },
    countries: toRows(countryMap),
    cities,
    districts: toRows(districtMap).slice(0, 40),
    risers: cities
      .filter((row) => row.recentRevenue > 0 && row.growth !== null && row.growth > 0)
      .sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))
      .slice(0, 8),
  };
}
