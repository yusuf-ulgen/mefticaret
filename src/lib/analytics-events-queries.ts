import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { rangeDays, type DateRange } from "@/lib/analytics-range";

/**
 * Vitrin davranış analitiği: ziyaretçi, oturum, sayfa/ürün görüntüleme, sepete
 * ekleme, checkout ve satın alma olayları. RLS mağaza izolasyonunu korur.
 */

export type AnalyticsEvent = {
  id: string;
  kind: "page_view" | "product_view" | "add_to_cart" | "checkout" | "purchase";
  visitor_id: string;
  session_id: string;
  path: string | null;
  product_id: string | null;
  value: number | string;
  quantity: number;
  currency: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  referrer_host: string | null;
  device: string | null;
  country: string | null;
  created_at: string;
};

export const analyticsEventsQuery = (storeId: string, range: DateRange) =>
  queryOptions({
    queryKey: ["analytics-events", storeId, range.fromIso, range.toIso],
    queryFn: async (): Promise<AnalyticsEvent[]> => {
      const { data, error } = await supabase
        .from("analytics_events")
        .select(
          "id, kind, visitor_id, session_id, path, product_id, value, quantity, currency, source, medium, campaign, referrer_host, device, country, created_at",
        )
        .eq("store_id", storeId)
        .gte("created_at", range.fromIso)
        .lte("created_at", range.toIso)
        .order("created_at", { ascending: true })
        .limit(20000);
      if (error) throw error;
      return (data ?? []) as AnalyticsEvent[];
    },
  });

export const analyticsRangeOrdersQuery = (storeId: string, range: DateRange) =>
  queryOptions({
    queryKey: ["analytics-range-orders", storeId, range.fromIso, range.toIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, placed_at, created_at, grand_total, discount_total, status, payment_status, customer_id, customer_email, discount_code",
        )
        .eq("store_id", storeId)
        .gte("placed_at", range.fromIso)
        .lte("placed_at", range.toIso)
        .order("placed_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

function countBy<T>(rows: T[], pick: (row: T) => string | null) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = (pick(row) ?? "bilinmiyor").trim() || "bilinmiyor";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export type TrafficSummary = ReturnType<typeof summarizeEvents>;

/** Tüm huni metriklerini tek geçişte hesaplar. */
export function summarizeEvents(events: AnalyticsEvent[], orderRevenue: number, orderCount: number) {
  const of = (kind: AnalyticsEvent["kind"]) => events.filter((event) => event.kind === kind);
  const pageViews = of("page_view");
  const productViews = of("product_view");
  const addToCart = of("add_to_cart");
  const checkouts = of("checkout");
  const purchases = of("purchase");

  const visitors = new Set(events.map((event) => event.visitor_id)).size;
  const sessions = new Set(events.map((event) => event.session_id)).size;
  const cartSessions = new Set(addToCart.map((event) => event.session_id)).size;
  const checkoutSessions = new Set(checkouts.map((event) => event.session_id)).size;
  const purchaseSessions = new Set(purchases.map((event) => event.session_id)).size;
  const bouncedSessions = (() => {
    const perSession = new Map<string, number>();
    for (const event of pageViews) perSession.set(event.session_id, (perSession.get(event.session_id) ?? 0) + 1);
    return [...perSession.values()].filter((count) => count <= 1).length;
  })();

  const revenue = orderRevenue;
  const conversion = sessions > 0 ? (purchaseSessions / sessions) * 100 : 0;

  return {
    visitors,
    sessions,
    pageViews: pageViews.length,
    productViews: productViews.length,
    addToCart: addToCart.length,
    cartSessions,
    checkoutSessions,
    purchaseSessions,
    purchases: purchases.length,
    conversion,
    cartRate: sessions > 0 ? (cartSessions / sessions) * 100 : 0,
    checkoutRate: cartSessions > 0 ? (checkoutSessions / cartSessions) * 100 : 0,
    purchaseRate: checkoutSessions > 0 ? (purchaseSessions / checkoutSessions) * 100 : 0,
    bounceRate: sessions > 0 ? (bouncedSessions / sessions) * 100 : 0,
    pagesPerSession: sessions > 0 ? pageViews.length / sessions : 0,
    revenue,
    orders: orderCount,
    aov: orderCount > 0 ? revenue / orderCount : 0,
    revenuePerSession: sessions > 0 ? revenue / sessions : 0,
    sources: countBy(events, (event) => event.source),
    referrers: countBy(
      events.filter((event) => event.referrer_host),
      (event) => event.referrer_host,
    ),
    devices: countBy(events, (event) => event.device),
    countries: countBy(events, (event) => event.country),
    campaigns: countBy(
      events.filter((event) => event.campaign),
      (event) => event.campaign,
    ),
    topPages: countBy(pageViews, (event) => event.path).slice(0, 10),
  };
}

/** Günlük ziyaretçi / oturum / satın alma / ciro serisi. */
export function buildTrafficSeries(
  events: AnalyticsEvent[],
  orders: { placed_at: string | null; created_at: string; grand_total: number | string }[],
  range: DateRange,
) {
  const days = rangeDays(range);
  const buckets = new Map(
    days.map((day) => [
      day,
      {
        date: day,
        visitors: new Set<string>(),
        sessions: new Set<string>(),
        pageViews: 0,
        purchases: 0,
        orders: 0,
        revenue: 0,
      },
    ]),
  );

  for (const event of events) {
    const bucket = buckets.get(event.created_at.slice(0, 10));
    if (!bucket) continue;
    bucket.visitors.add(event.visitor_id);
    bucket.sessions.add(event.session_id);
    if (event.kind === "page_view") bucket.pageViews += 1;
    if (event.kind === "purchase") bucket.purchases += 1;
  }

  for (const order of orders) {
    const bucket = buckets.get((order.placed_at ?? order.created_at).slice(0, 10));
    if (!bucket) continue;
    bucket.revenue += Number(order.grand_total ?? 0);
    bucket.orders += 1;
  }

  return [...buckets.values()].map((bucket) => ({
    date: bucket.date,
    visitors: bucket.visitors.size,
    sessions: bucket.sessions.size,
    pageViews: bucket.pageViews,
    purchases: bucket.purchases,
    orders: bucket.orders,
    revenue: bucket.revenue,
    conversion: bucket.sessions.size > 0 ? (bucket.purchases / bucket.sessions.size) * 100 : 0,
  }));
}
