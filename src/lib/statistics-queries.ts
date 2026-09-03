import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * İstatistik merkezi verisi: trafik, satış, ürün, dönüşüm, müşteri ve arama
 * raporlarını tek geçişte hesaplar. Tüm okumalar RLS ile mağaza izolasyonludur.
 */

const DAY = 86_400_000;

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * DAY).toISOString();
}

export type StatsRow = { key: string; count: number };

function countBy<T>(rows: T[], pick: (row: T) => string | null | undefined): StatsRow[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = (pick(row) ?? "bilinmiyor").toString().trim() || "bilinmiyor";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

function delta(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

type EventRow = {
  kind: string;
  visitor_id: string;
  session_id: string;
  path: string | null;
  product_id: string | null;
  source: string | null;
  device: string | null;
  country: string | null;
  search_term: string | null;
  search_results: number | null;
  created_at: string;
};

type OrderRow = {
  id: string;
  placed_at: string | null;
  created_at: string;
  grand_total: number | string | null;
  shipping_total: number | string | null;
  discount_total: number | string | null;
  status: string;
  payment_status: string;
  customer_id: string | null;
  customer_email: string | null;
  discount_code: string | null;
};

type ItemRow = {
  order_id: string;
  product_id: string | null;
  title: string;
  quantity: number | null;
  line_total: number | string | null;
};

function traffic(events: EventRow[]) {
  const pageViews = events.filter((event) => event.kind === "page_view");
  const sessions = new Set(events.map((event) => event.session_id));
  const perSession = new Map<string, number>();
  for (const event of pageViews) {
    perSession.set(event.session_id, (perSession.get(event.session_id) ?? 0) + 1);
  }
  const bounced = [...perSession.values()].filter((count) => count <= 1).length;

  const spans = new Map<string, { first: number; last: number }>();
  for (const event of events) {
    const time = Date.parse(event.created_at);
    const span = spans.get(event.session_id);
    if (!span) spans.set(event.session_id, { first: time, last: time });
    else {
      span.first = Math.min(span.first, time);
      span.last = Math.max(span.last, time);
    }
  }
  const durations = [...spans.values()].map((span) => (span.last - span.first) / 1000);
  const avgDuration = durations.length
    ? durations.reduce((total, value) => total + value, 0) / durations.length
    : 0;

  return {
    visitors: new Set(events.map((event) => event.visitor_id)).size,
    sessions: sessions.size,
    pageViews: pageViews.length,
    pagesPerSession: sessions.size > 0 ? pageViews.length / sessions.size : 0,
    bounceRate: perSession.size > 0 ? (bounced / perSession.size) * 100 : 0,
    avgDuration,
    sources: countBy(events, (event) => event.source),
    devices: countBy(events, (event) => event.device),
    countries: countBy(events, (event) => event.country),
    topPages: countBy(pageViews, (event) => event.path).slice(0, 10),
  };
}

export const statisticsQuery = (storeId: string, days: number) =>
  queryOptions({
    queryKey: ["statistics-center", storeId, days],
    staleTime: 60_000,
    queryFn: async () => {
      const currentFrom = isoDaysAgo(days);
      const previousFrom = isoDaysAgo(days * 2);

      const [eventRes, orderRes, itemRes, productRes, variantRes, customerRes] = await Promise.all([
        supabase
          .from("analytics_events")
          .select(
            "kind, visitor_id, session_id, path, product_id, source, device, country, search_term, search_results, created_at",
          )
          .eq("store_id", storeId)
          .gte("created_at", previousFrom)
          .order("created_at", { ascending: true })
          .limit(20000),
        supabase
          .from("orders")
          .select(
            "id, placed_at, created_at, grand_total, shipping_total, discount_total, status, payment_status, customer_id, customer_email, discount_code",
          )
          .eq("store_id", storeId)
          .gte("created_at", previousFrom)
          .order("created_at", { ascending: true })
          .limit(10000),
        supabase
          .from("order_items")
          .select("order_id, product_id, title, quantity, line_total, created_at")
          .eq("store_id", storeId)
          .gte("created_at", previousFrom)
          .limit(10000),
        supabase
          .from("products")
          .select("id, title, status, base_price, created_at")
          .eq("store_id", storeId)
          .limit(3000),
        supabase
          .from("product_variants")
          .select("id, product_id, stock, price")
          .eq("store_id", storeId)
          .limit(6000),
        supabase
          .from("customers")
          .select("id, created_at, orders_count, total_spent")
          .eq("store_id", storeId)
          .limit(6000),
      ]);

      if (eventRes.error) throw eventRes.error;
      if (orderRes.error) throw orderRes.error;
      if (itemRes.error) throw itemRes.error;
      if (productRes.error) throw productRes.error;
      if (variantRes.error) throw variantRes.error;
      if (customerRes.error) throw customerRes.error;

      const events = (eventRes.data ?? []) as unknown as EventRow[];
      const orders = (orderRes.data ?? []) as unknown as OrderRow[];
      const items = (itemRes.data ?? []) as unknown as (ItemRow & { created_at: string })[];
      const products = productRes.data ?? [];
      const variants = variantRes.data ?? [];
      const customers = customerRes.data ?? [];

      const inCurrent = (iso: string) => iso >= currentFrom;
      const curEvents = events.filter((event) => inCurrent(event.created_at));
      const prevEvents = events.filter((event) => !inCurrent(event.created_at));
      const orderTime = (order: OrderRow) => order.placed_at ?? order.created_at;
      const curOrders = orders.filter((order) => inCurrent(orderTime(order)));
      const prevOrders = orders.filter((order) => !inCurrent(orderTime(order)));
      const curOrderIds = new Set(curOrders.map((order) => order.id));
      const prevOrderIds = new Set(prevOrders.map((order) => order.id));
      const curItems = items.filter((item) => curOrderIds.has(item.order_id));
      const prevItems = items.filter((item) => prevOrderIds.has(item.order_id));

      const sum = (rows: OrderRow[], pick: (row: OrderRow) => number | string | null) =>
        rows.reduce((total, row) => total + Number(pick(row) ?? 0), 0);
      const units = (rows: ItemRow[]) =>
        rows.reduce((total, row) => total + Number(row.quantity ?? 0), 0);

      // --- Satış raporları
      const revenue = sum(curOrders, (order) => order.grand_total);
      const prevRevenue = sum(prevOrders, (order) => order.grand_total);
      const cancelled = curOrders.filter((order) =>
        ["cancelled", "refunded", "returned"].includes(order.status),
      ).length;
      const newCustomers = customers.filter((customer) => inCurrent(String(customer.created_at))).length;
      const prevNewCustomers = customers.filter(
        (customer) => !inCurrent(String(customer.created_at)) && String(customer.created_at) >= previousFrom,
      ).length;

      const sales = {
        revenue,
        revenueDelta: delta(revenue, prevRevenue),
        orders: curOrders.length,
        ordersDelta: delta(curOrders.length, prevOrders.length),
        aov: curOrders.length > 0 ? revenue / curOrders.length : 0,
        aovDelta: delta(
          curOrders.length > 0 ? revenue / curOrders.length : 0,
          prevOrders.length > 0 ? prevRevenue / prevOrders.length : 0,
        ),
        cancelRate: curOrders.length > 0 ? (cancelled / curOrders.length) * 100 : 0,
        soldUnits: units(curItems),
        soldUnitsDelta: delta(units(curItems), units(prevItems)),
        newCustomers,
        newCustomersDelta: delta(newCustomers, prevNewCustomers),
        couponUsage: curOrders.filter((order) => Boolean(order.discount_code)).length,
        shippingRevenue: sum(curOrders, (order) => order.shipping_total),
        shippingRevenueDelta: delta(
          sum(curOrders, (order) => order.shipping_total),
          sum(prevOrders, (order) => order.shipping_total),
        ),
        totalDiscount: sum(curOrders, (order) => order.discount_total),
        paidOrders: curOrders.filter((order) => order.payment_status === "paid").length,
        statusBreakdown: countBy(curOrders, (order) => order.status),
      };

      // --- Ürün analizi
      const stockByProduct = new Map<string, number>();
      for (const variant of variants) {
        const key = String(variant.product_id ?? "");
        stockByProduct.set(key, (stockByProduct.get(key) ?? 0) + Number(variant.stock ?? 0));
      }
      const totalStock = variants.reduce((total, variant) => total + Number(variant.stock ?? 0), 0);
      const outOfStock = variants.filter((variant) => Number(variant.stock ?? 0) <= 0).length;
      const lowStock = variants.filter((variant) => {
        const stock = Number(variant.stock ?? 0);
        return stock > 0 && stock <= 5;
      }).length;

      const soldByProduct = new Map<string, { title: string; quantity: number; revenue: number }>();
      for (const item of curItems) {
        const key = item.product_id ? String(item.product_id) : item.title;
        const entry = soldByProduct.get(key) ?? { title: item.title, quantity: 0, revenue: 0 };
        entry.quantity += Number(item.quantity ?? 0);
        entry.revenue += Number(item.line_total ?? 0);
        soldByProduct.set(key, entry);
      }
      const topProducts = [...soldByProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);

      const prices = variants.map((variant) => Number(variant.price ?? 0)).filter((price) => price > 0);
      const priceBuckets = [
        { label: "0 – 100", min: 0, max: 100 },
        { label: "100 – 500", min: 100, max: 500 },
        { label: "500 – 1.000", min: 500, max: 1000 },
        { label: "1.000 – 5.000", min: 1000, max: 5000 },
        { label: "5.000+", min: 5000, max: Number.POSITIVE_INFINITY },
      ].map((bucket) => ({
        key: bucket.label,
        count: prices.filter((price) => price >= bucket.min && price < bucket.max).length,
      }));

      const productStats = {
        activeProducts: products.filter((product) => product.status === "active").length,
        totalProducts: products.length,
        soldUnits: units(curItems),
        soldUnitsDelta: delta(units(curItems), units(prevItems)),
        distinctSold: soldByProduct.size,
        outOfStock,
        lowStock,
        healthy: Math.max(0, variants.length - outOfStock - lowStock),
        totalSku: variants.length,
        totalStock,
        avgSalePrice: units(curItems) > 0 ? revenue / units(curItems) : 0,
        topProducts,
        priceBuckets,
        stockLeaders: products
          .map((product) => ({
            title: String(product.title),
            stock: stockByProduct.get(String(product.id)) ?? 0,
          }))
          .sort((a, b) => b.stock - a.stock)
          .slice(0, 6),
      };

      // --- Trafik + dönüşüm
      const curTraffic = traffic(curEvents);
      const prevTraffic = traffic(prevEvents);
      const sessionsWith = (kind: string, rows: EventRow[]) =>
        new Set(rows.filter((event) => event.kind === kind).map((event) => event.session_id)).size;

      const funnelVisitors = curTraffic.visitors;
      const funnelCart = sessionsWith("add_to_cart", curEvents);
      const funnelCheckout = sessionsWith("checkout", curEvents);
      const funnelPurchase = Math.max(sessionsWith("purchase", curEvents), 0) || curOrders.length;

      const conversion = {
        visitors: funnelVisitors,
        visitorsDelta: delta(funnelVisitors, prevTraffic.visitors),
        conversionRate: funnelVisitors > 0 ? (funnelPurchase / funnelVisitors) * 100 : 0,
        conversionDelta: delta(
          funnelVisitors > 0 ? funnelPurchase / funnelVisitors : 0,
          prevTraffic.visitors > 0 ? sessionsWith("purchase", prevEvents) / prevTraffic.visitors : 0,
        ),
        addToCart: funnelCart,
        bounceRate: curTraffic.bounceRate,
        funnel: [
          { label: "Ziyaretçi", value: funnelVisitors },
          { label: "Sepete ekleme", value: funnelCart },
          { label: "Checkout", value: funnelCheckout },
          { label: "Satın alma", value: funnelPurchase },
        ],
      };

      // --- Müşteri istatistikleri
      const guestOrders = curOrders.filter((order) => !order.customer_id).length;
      const orderingCustomers = new Set(
        curOrders.filter((order) => order.customer_id).map((order) => String(order.customer_id)),
      ).size;
      const prevOrderingCustomers = new Set(
        prevOrders.filter((order) => order.customer_id).map((order) => String(order.customer_id)),
      ).size;
      const repeatCustomers = customers.filter((customer) => Number(customer.orders_count ?? 0) > 1).length;
      const ltvTotal = customers.reduce((total, customer) => total + Number(customer.total_spent ?? 0), 0);

      const newCustomerRevenue = curOrders
        .filter((order) => {
          if (!order.customer_id) return false;
          const record = customers.find((customer) => String(customer.id) === String(order.customer_id));
          return record ? Number(record.orders_count ?? 0) <= 1 : true;
        })
        .reduce((total, order) => total + Number(order.grand_total ?? 0), 0);
      const guestRevenue = curOrders
        .filter((order) => !order.customer_id)
        .reduce((total, order) => total + Number(order.grand_total ?? 0), 0);
      const repeatRevenue = Math.max(0, revenue - newCustomerRevenue - guestRevenue);

      const customerStats = {
        total: customers.length,
        newCustomers,
        newCustomersDelta: delta(newCustomers, prevNewCustomers),
        ordering: orderingCustomers,
        orderingDelta: delta(orderingCustomers, prevOrderingCustomers),
        repeatRate: customers.length > 0 ? (repeatCustomers / customers.length) * 100 : 0,
        guestOrders,
        avgLtv: customers.length > 0 ? ltvTotal / customers.length : 0,
        mix: [
          { key: "Yeni müşteri", count: newCustomerRevenue },
          { key: "Tekrar eden", count: repeatRevenue },
          { key: "Misafir", count: guestRevenue },
        ],
        topCustomers: [...customers]
          .sort((a, b) => Number(b.total_spent ?? 0) - Number(a.total_spent ?? 0))
          .slice(0, 6)
          .map((customer) => ({
            id: String(customer.id),
            spent: Number(customer.total_spent ?? 0),
            orders: Number(customer.orders_count ?? 0),
          })),
      };

      // --- Arama raporu
      const searchEvents = curEvents.filter((event) => event.kind === "search" && event.search_term);
      const termMap = new Map<string, { term: string; count: number; results: number }>();
      for (const event of searchEvents) {
        const term = String(event.search_term).toLocaleLowerCase("tr");
        const entry = termMap.get(term) ?? { term, count: 0, results: Number(event.search_results ?? 0) };
        entry.count += 1;
        entry.results = Math.max(entry.results, Number(event.search_results ?? 0));
        termMap.set(term, entry);
      }
      const noResultTerms = [...termMap.values()].filter((entry) => entry.results <= 0);
      const searchSessions = new Set(searchEvents.map((event) => event.session_id));
      const clicksAfterSearch = curEvents.filter(
        (event) => event.kind === "product_view" && searchSessions.has(event.session_id),
      ).length;
      const noResultCount = searchEvents.filter((event) => Number(event.search_results ?? 0) <= 0).length;

      const hourly = Array.from({ length: 24 }, (_, hour) => ({ key: `${hour}:00`, count: 0 }));
      for (const event of searchEvents) {
        const hour = new Date(event.created_at).getHours();
        const bucket = hourly[hour];
        if (bucket) bucket.count += 1;
      }

      const searchStats = {
        total: searchEvents.length,
        uniqueTerms: termMap.size,
        noResult: noResultCount,
        noResultRate: searchEvents.length > 0 ? (noResultCount / searchEvents.length) * 100 : 0,
        clicks: clicksAfterSearch,
        ctr: searchEvents.length > 0 ? (clicksAfterSearch / searchEvents.length) * 100 : 0,
        topTerms: [...termMap.values()].sort((a, b) => b.count - a.count).slice(0, 10),
        noResultTerms: noResultTerms.slice(0, 12),
        hourly,
      };

      // --- Günlük trend serisi
      const dayKeys: string[] = [];
      for (let index = days - 1; index >= 0; index -= 1) {
        dayKeys.push(new Date(Date.now() - index * DAY).toISOString().slice(0, 10));
      }
      const seriesMap = new Map(
        dayKeys.map((day) => [
          day,
          { date: day, revenue: 0, orders: 0, visitors: new Set<string>(), searches: 0 },
        ]),
      );
      for (const order of curOrders) {
        const bucket = seriesMap.get(orderTime(order).slice(0, 10));
        if (!bucket) continue;
        bucket.revenue += Number(order.grand_total ?? 0);
        bucket.orders += 1;
      }
      for (const event of curEvents) {
        const bucket = seriesMap.get(event.created_at.slice(0, 10));
        if (!bucket) continue;
        bucket.visitors.add(event.visitor_id);
        if (event.kind === "search") bucket.searches += 1;
      }
      const series = [...seriesMap.values()].map((bucket) => ({
        date: bucket.date,
        revenue: bucket.revenue,
        orders: bucket.orders,
        visitors: bucket.visitors.size,
        searches: bucket.searches,
      }));

      return {
        traffic: {
          ...curTraffic,
          visitorsDelta: delta(curTraffic.visitors, prevTraffic.visitors),
          sessionsDelta: delta(curTraffic.sessions, prevTraffic.sessions),
          pageViewsDelta: delta(curTraffic.pageViews, prevTraffic.pageViews),
          bounceDelta: delta(curTraffic.bounceRate, prevTraffic.bounceRate),
        },
        sales,
        productStats,
        conversion,
        customerStats,
        searchStats,
        series,
      };
    },
  });

export type StatisticsData = Awaited<ReturnType<ReturnType<typeof statisticsQuery>["queryFn"]>>;
