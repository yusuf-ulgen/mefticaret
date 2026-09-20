/**
 * Süper Analitik & İş Zekâsı — sunucu katmanı.
 * Tüm veriler gerçek tablolardan, çağıran kullanıcının RLS yetkisiyle okunur.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  CHANNEL_LABELS,
  DEVICE_LABELS,
  acquisitionMetrics,
  classifyChannel,
  cohortMatrix,
  computeProfit,
  depletionForecast,
  funnelStages,
  normalizeDevice,
  safeDivide,
  type CostSettings,
  type DeviceKey,
} from "@/lib/bi";

type Client = SupabaseClient<Database>;
type Any = any;

export type BiRange = { fromIso: string; toIso: string; days: number; label: string };

export type BiReport = Awaited<ReturnType<typeof collectBusinessIntelligence>>;

const DEFAULT_SETTINGS: CostSettings = {
  paymentCommissionRate: 0,
  shippingCostPerOrder: 0,
  packagingCostPerOrder: 0,
  overheadRate: 0,
};

export async function collectBusinessIntelligence(client: Client, storeId: string, range: BiRange) {
  const db = client as unknown as Any;
  const now = Date.now();
  const cohortSince = new Date(now - 400 * 86_400_000).toISOString();
  const liveSince = new Date(now - 15 * 60_000).toISOString();
  const cartSince = new Date(now - 60 * 60_000).toISOString();

  const [
    store,
    costRow,
    orders,
    items,
    products,
    variants,
    vendors,
    refunds,
    spend,
    events,
    liveEvents,
    liveCarts,
    settlements,
    shipments,
    returns,
    newCustomers,
    cohortOrders,
  ] = await Promise.all([
    db.from("stores").select("name, currency").eq("id", storeId).maybeSingle(),
    db.from("finance_cost_settings").select("*").eq("store_id", storeId).maybeSingle(),
    db
      .from("orders")
      .select(
        "id, customer_id, customer_email, grand_total, subtotal, discount_total, shipping_total, tax_total, currency, display_currency, exchange_rate, status, payment_status, placed_at, created_at, shipping_address, market_id",
      )
      .eq("store_id", storeId)
      .gte("placed_at", range.fromIso)
      .lte("placed_at", range.toIso)
      .limit(5000),
    db
      .from("order_items")
      .select("order_id, product_id, quantity, line_total, unit_price")
      .eq("store_id", storeId)
      .gte("created_at", range.fromIso)
      .lte("created_at", range.toIso)
      .limit(5000),
    db.from("products").select("id, title, base_price, cost_price, vendor_id").eq("store_id", storeId).limit(2000),
    db.from("product_variants").select("product_id, stock, cost_price").eq("store_id", storeId).limit(5000),
    db.from("vendors").select("id, name").eq("store_id", storeId).limit(500),
    db
      .from("refunds")
      .select("amount, created_at")
      .eq("store_id", storeId)
      .gte("created_at", range.fromIso)
      .lte("created_at", range.toIso)
      .limit(2000),
    db
      .from("marketing_spend")
      .select("id, spend_date, channel, amount, currency, impressions, clicks, note")
      .eq("store_id", storeId)
      .gte("spend_date", range.fromIso.slice(0, 10))
      .lte("spend_date", range.toIso.slice(0, 10))
      .order("spend_date", { ascending: false })
      .limit(1000),
    db
      .from("analytics_events")
      .select("kind, session_id, visitor_id, source, medium, referrer_host, device, country, city, path, value, created_at")
      .eq("store_id", storeId)
      .gte("created_at", range.fromIso)
      .lte("created_at", range.toIso)
      .limit(20000),
    db
      .from("analytics_events")
      .select("kind, session_id, value, created_at")
      .eq("store_id", storeId)
      .gte("created_at", liveSince)
      .limit(2000),
    db
      .from("abandoned_carts")
      .select("id, total, last_seen_at, recovered_order_id")
      .eq("store_id", storeId)
      .gte("last_seen_at", cartSince)
      .limit(500),
    db
      .from("marketplace_settlements")
      .select("marketplace, gross_amount, commission_amount, shipping_amount, service_fee, net_amount, currency, period_start")
      .eq("store_id", storeId)
      .gte("period_start", range.fromIso.slice(0, 10))
      .limit(500),
    db
      .from("shipments")
      .select("order_id, created_at, shipped_at, delivered_at")
      .eq("store_id", storeId)
      .gte("created_at", range.fromIso)
      .limit(3000),
    db
      .from("return_requests")
      .select("order_id, refund_amount, created_at")
      .eq("store_id", storeId)
      .gte("created_at", range.fromIso)
      .limit(2000),
    db
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("store_id", storeId)
      .gte("created_at", range.fromIso)
      .lte("created_at", range.toIso),
    db
      .from("orders")
      .select("customer_id, customer_email, grand_total, placed_at, created_at")
      .eq("store_id", storeId)
      .gte("placed_at", cohortSince)
      .limit(20000),
  ]);

  if (!store.data) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
  if (orders.error) throw new Error(orders.error.message);

  const currency = String(store.data.currency ?? "TRY");
  const settings: CostSettings = costRow.data
    ? {
        paymentCommissionRate: Number(costRow.data.payment_commission_rate ?? 0),
        shippingCostPerOrder: Number(costRow.data.shipping_cost_per_order ?? 0),
        packagingCostPerOrder: Number(costRow.data.packaging_cost_per_order ?? 0),
        overheadRate: Number(costRow.data.overhead_rate ?? 0),
      }
    : DEFAULT_SETTINGS;

  const orderRows: Any[] = orders.data ?? [];
  const itemRows: Any[] = items.data ?? [];
  const productRows: Any[] = products.data ?? [];
  const variantRows: Any[] = variants.data ?? [];
  const eventRows: Any[] = events.data ?? [];

  /* ------------------------------ finans ---------------------------------- */

  const paidOrders = orderRows.filter(
    (row) => row.payment_status === "paid" || row.status === "processing" || row.status === "shipped" || row.status === "delivered",
  );
  const countedOrders = orderRows.filter((row) => row.status !== "cancelled");

  const grossSales = sum(countedOrders, (row) => Number(row.subtotal ?? 0));
  const discounts = sum(countedOrders, (row) => Number(row.discount_total ?? 0));
  const shippingRevenue = sum(countedOrders, (row) => Number(row.shipping_total ?? 0));
  const taxTotal = sum(countedOrders, (row) => Number(row.tax_total ?? 0));
  const refundTotal = sum((refunds.data ?? []) as Any[], (row) => Number(row.amount ?? 0));

  const costByProduct = new Map<string, number>();
  for (const product of productRows) costByProduct.set(String(product.id), Number(product.cost_price ?? 0));
  const variantCost = new Map<string, number>();
  for (const variant of variantRows) {
    const key = String(variant.product_id);
    const value = Number(variant.cost_price ?? 0);
    if (value > 0 && !variantCost.has(key)) variantCost.set(key, value);
  }

  const cogs = sum(itemRows, (row) => {
    const key = String(row.product_id ?? "");
    const unitCost = costByProduct.get(key) || variantCost.get(key) || 0;
    return unitCost * Number(row.quantity ?? 0);
  });

  const spendRows: Any[] = spend.data ?? [];
  const adsSpend = sum(spendRows, (row) => Number(row.amount ?? 0));

  const profit = computeProfit({
    grossSales,
    discounts,
    refunds: refundTotal,
    shippingRevenue,
    taxTotal,
    cogs,
    adsSpend,
    orderCount: countedOrders.length,
    settings,
  });

  /* ----------------------------- günlük seri ------------------------------- */

  const dailyMap = new Map<string, { date: string; grossSales: number; netSales: number; orders: number; spend: number }>();
  for (const row of countedOrders) {
    const key = String(row.placed_at ?? row.created_at).slice(0, 10);
    const bucket = dailyMap.get(key) ?? { date: key, grossSales: 0, netSales: 0, orders: 0, spend: 0 };
    bucket.grossSales += Number(row.subtotal ?? 0);
    bucket.netSales += Number(row.subtotal ?? 0) - Number(row.discount_total ?? 0);
    bucket.orders += 1;
    dailyMap.set(key, bucket);
  }
  for (const row of spendRows) {
    const key = String(row.spend_date).slice(0, 10);
    const bucket = dailyMap.get(key) ?? { date: key, grossSales: 0, netSales: 0, orders: 0, spend: 0 };
    bucket.spend += Number(row.amount ?? 0);
    dailyMap.set(key, bucket);
  }
  const daily = [...dailyMap.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      const costRate = profit.netSales > 0 ? profit.totalCost / profit.netSales : 0;
      return {
        ...row,
        grossSales: r2(row.grossSales),
        netSales: r2(row.netSales),
        spend: r2(row.spend),
        netProfit: r2(row.netSales - row.netSales * costRate),
      };
    });

  /* --------------------------- para birimleri ----------------------------- */

  const currencyMap = new Map<string, { currency: string; orders: number; revenue: number; baseRevenue: number }>();
  for (const row of countedOrders) {
    const key = String(row.display_currency ?? row.currency ?? currency).toUpperCase();
    const bucket = currencyMap.get(key) ?? { currency: key, orders: 0, revenue: 0, baseRevenue: 0 };
    const rate = Number(row.exchange_rate ?? 1) || 1;
    const total = Number(row.grand_total ?? 0);
    bucket.orders += 1;
    bucket.revenue += key === currency ? total : total / rate;
    bucket.baseRevenue += total;
    currencyMap.set(key, bucket);
  }
  const currencyBreakdown = [...currencyMap.values()]
    .map((row) => ({ ...row, revenue: r2(row.revenue), baseRevenue: r2(row.baseRevenue) }))
    .sort((a, b) => b.baseRevenue - a.baseRevenue);

  /* -------------------------------- huni ---------------------------------- */

  const sessions = new Set<string>();
  let productViews = 0;
  let cartAdds = 0;
  let checkouts = 0;
  const geoMap = new Map<string, { country: string; city: string; sessions: Set<string>; revenue: number }>();
  const deviceMap = new Map<DeviceKey, Set<string>>();
  const landingMap = new Map<string, Set<string>>();
  const channelMap = new Map<
    string,
    { channel: string; label: string; sessions: Set<string>; orders: number; revenue: number }
  >();

  for (const event of eventRows) {
    const sessionKey = String(event.session_id ?? event.visitor_id ?? "");
    if (sessionKey) sessions.add(sessionKey);
    if (event.kind === "product_view") productViews += 1;
    if (event.kind === "add_to_cart") cartAdds += 1;
    if (event.kind === "checkout") checkouts += 1;

    const country = String(event.country ?? "—");
    const city = String(event.city ?? "—");
    const geoKey = `${country}|${city}`;
    const geo = geoMap.get(geoKey) ?? { country, city, sessions: new Set<string>(), revenue: 0 };
    if (sessionKey) geo.sessions.add(sessionKey);
    if (event.kind === "purchase") geo.revenue += Number(event.value ?? 0);
    geoMap.set(geoKey, geo);

    const device = normalizeDevice(event.device);
    const deviceSet = deviceMap.get(device) ?? new Set<string>();
    if (sessionKey) deviceSet.add(sessionKey);
    deviceMap.set(device, deviceSet);

    if (event.kind === "page_view" && event.path) {
      const path = String(event.path);
      const set = landingMap.get(path) ?? new Set<string>();
      if (sessionKey) set.add(sessionKey);
      landingMap.set(path, set);
    }

    const channel = classifyChannel({
      source: event.source,
      medium: event.medium,
      referrerHost: event.referrer_host,
    });
    const bucket =
      channelMap.get(channel) ??
      { channel, label: CHANNEL_LABELS[channel] ?? channel, sessions: new Set<string>(), orders: 0, revenue: 0 };
    if (sessionKey) bucket.sessions.add(sessionKey);
    if (event.kind === "purchase") {
      bucket.orders += 1;
      bucket.revenue += Number(event.value ?? 0);
    }
    channelMap.set(channel, bucket);
  }

  const funnel = funnelStages({
    visits: sessions.size,
    productViews,
    cartAdds,
    checkouts,
    orders: countedOrders.length,
  });

  const channels = [...channelMap.values()]
    .map((row) => ({
      channel: row.channel,
      label: row.label,
      sessions: row.sessions.size,
      orders: row.orders,
      revenue: r2(row.revenue),
      conversion: r2(safeDivide(row.orders, row.sessions.size) * 100),
    }))
    .sort((a, b) => b.revenue - a.revenue || b.sessions - a.sessions);

  const geo = [...geoMap.values()]
    .map((row) => ({ country: row.country, city: row.city, sessions: row.sessions.size, revenue: r2(row.revenue) }))
    .sort((a, b) => b.revenue - a.revenue || b.sessions - a.sessions)
    .slice(0, 40);

  const totalDeviceSessions = [...deviceMap.values()].reduce((total, set) => total + set.size, 0);
  const devices = [...deviceMap.entries()]
    .map(([key, set]) => ({
      device: key,
      label: DEVICE_LABELS[key],
      sessions: set.size,
      share: r2(safeDivide(set.size, totalDeviceSessions) * 100),
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const landingPages = [...landingMap.entries()]
    .map(([path, set]) => ({ path, sessions: set.size }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 12);

  /* ------------------------------ metrikler -------------------------------- */

  const netRevenue = sum(countedOrders, (row) => Number(row.grand_total ?? 0));
  const customerKeys = new Set(
    countedOrders.map((row) => String(row.customer_id ?? row.customer_email ?? "")).filter(Boolean),
  );
  const cohortRows: Any[] = cohortOrders.data ?? [];
  const cohortInput = cohortRows
    .map((row) => ({
      customerKey: String(row.customer_id ?? row.customer_email ?? ""),
      date: String(row.placed_at ?? row.created_at).slice(0, 10),
      revenue: Number(row.grand_total ?? 0),
    }))
    .filter((row) => row.customerKey);

  const ordersPerCustomer = new Map<string, number>();
  const revenuePerCustomer = new Map<string, number>();
  for (const row of cohortInput) {
    ordersPerCustomer.set(row.customerKey, (ordersPerCustomer.get(row.customerKey) ?? 0) + 1);
    revenuePerCustomer.set(row.customerKey, (revenuePerCustomer.get(row.customerKey) ?? 0) + row.revenue);
  }
  const repeatCustomers = [...ordersPerCustomer.values()].filter((count) => count > 1).length;
  const ltv =
    revenuePerCustomer.size > 0
      ? [...revenuePerCustomer.values()].reduce((total, value) => total + value, 0) / revenuePerCustomer.size
      : 0;

  const attributedRevenue = channels
    .filter((row) => ["meta_ads", "google_ads", "tiktok", "instagram"].includes(row.channel))
    .reduce((total, row) => total + row.revenue, 0);

  const acquisition = acquisitionMetrics({
    adsSpend,
    newCustomers: Number(newCustomers.count ?? 0),
    attributedRevenue: attributedRevenue > 0 ? attributedRevenue : netRevenue,
    netProfit: profit.netProfit,
  });

  const metrics = {
    orders: countedOrders.length,
    paidOrders: paidOrders.length,
    revenue: r2(netRevenue),
    aov: r2(safeDivide(netRevenue, countedOrders.length)),
    ltv: r2(ltv),
    repeatRate: r2(safeDivide(repeatCustomers, ordersPerCustomer.size) * 100),
    conversionRate: r2(safeDivide(countedOrders.length, sessions.size) * 100),
    newCustomers: Number(newCustomers.count ?? 0),
    uniqueBuyers: customerKeys.size,
    ...acquisition,
  };

  const cohorts = cohortMatrix(cohortInput).slice(0, 12);

  /* -------------------------------- canlı --------------------------------- */

  const liveRows: Any[] = liveEvents.data ?? [];
  const liveSessions = new Set(liveRows.map((row) => String(row.session_id ?? "")).filter(Boolean));
  const cartRows = ((liveCarts.data ?? []) as Any[]).filter((row) => !row.recovered_order_id);
  const live = {
    activeUsers: liveSessions.size,
    activeCarts: cartRows.length,
    activeCartValue: r2(sum(cartRows, (row) => Number(row.total ?? 0))),
    liveRevenue: r2(sum(liveRows.filter((row) => row.kind === "purchase"), (row) => Number(row.value ?? 0))),
    eventsLast15Min: liveRows.length,
  };

  /* ---------------------------- pazaryeri / vitrin -------------------------- */

  const settlementRows: Any[] = settlements.data ?? [];
  const marketplaceMap = new Map<
    string,
    { name: string; gross: number; commission: number; shipping: number; net: number }
  >();
  for (const row of settlementRows) {
    const name = String(row.marketplace ?? "Pazaryeri");
    const bucket = marketplaceMap.get(name) ?? { name, gross: 0, commission: 0, shipping: 0, net: 0 };
    bucket.gross += Number(row.gross_amount ?? 0);
    bucket.commission += Number(row.commission_amount ?? 0) + Number(row.service_fee ?? 0);
    bucket.shipping += Number(row.shipping_amount ?? 0);
    bucket.net += Number(row.net_amount ?? 0);
    marketplaceMap.set(name, bucket);
  }
  const marketplaces = [
    {
      name: "Mefticaret Vitrini",
      gross: r2(netRevenue),
      commission: r2(profit.gatewayCommission),
      shipping: r2(profit.shippingCost),
      net: r2(netRevenue - profit.gatewayCommission - profit.shippingCost),
    },
    ...[...marketplaceMap.values()].map((row) => ({
      name: row.name,
      gross: r2(row.gross),
      commission: r2(row.commission),
      shipping: r2(row.shipping),
      net: r2(row.net),
    })),
  ].sort((a, b) => b.gross - a.gross);

  /* ------------------------- tedarikçi / marka skoru ----------------------- */

  const vendorById = new Map<string, string>(
    ((vendors.data ?? []) as Any[]).map((row) => [String(row.id), String(row.name)]),
  );
  const productVendor = new Map<string, string>();
  const productTitle = new Map<string, string>();
  const productPrice = new Map<string, number>();
  for (const product of productRows) {
    const id = String(product.id);
    productVendor.set(id, product.vendor_id ? vendorById.get(String(product.vendor_id)) ?? "Tanımsız" : "Tanımsız");
    productTitle.set(id, String(product.title));
    productPrice.set(id, Number(product.base_price ?? 0));
  }

  const returnedOrderIds = new Set(((returns.data ?? []) as Any[]).map((row) => String(row.order_id)));
  const shipmentRows: Any[] = shipments.data ?? [];
  const fulfillHours = new Map<string, number>();
  for (const row of shipmentRows) {
    if (!row.shipped_at || !row.created_at) continue;
    const hours = (Date.parse(row.shipped_at) - Date.parse(row.created_at)) / 3_600_000;
    if (hours >= 0) fulfillHours.set(String(row.order_id), hours);
  }

  const vendorMap = new Map<
    string,
    { name: string; revenue: number; units: number; cost: number; orderIds: Set<string> }
  >();
  for (const item of itemRows) {
    const productId = String(item.product_id ?? "");
    const name = productVendor.get(productId) ?? "Tanımsız";
    const bucket = vendorMap.get(name) ?? { name, revenue: 0, units: 0, cost: 0, orderIds: new Set<string>() };
    const quantity = Number(item.quantity ?? 0);
    bucket.revenue += Number(item.line_total ?? 0);
    bucket.units += quantity;
    bucket.cost += (costByProduct.get(productId) || variantCost.get(productId) || 0) * quantity;
    bucket.orderIds.add(String(item.order_id));
    vendorMap.set(name, bucket);
  }

  const vendorScorecard = [...vendorMap.values()]
    .map((row) => {
      const orderIds = [...row.orderIds];
      const returned = orderIds.filter((id) => returnedOrderIds.has(id)).length;
      const hours = orderIds.map((id) => fulfillHours.get(id)).filter((value): value is number => value !== undefined);
      return {
        name: row.name,
        revenue: r2(row.revenue),
        units: row.units,
        orders: orderIds.length,
        returnRate: r2(safeDivide(returned, orderIds.length) * 100),
        avgFulfillHours: hours.length > 0 ? r2(hours.reduce((a, b) => a + b, 0) / hours.length) : null,
        marginPercent: row.revenue > 0 ? r2(((row.revenue - row.cost) / row.revenue) * 100) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20);

  /* ---------------------------- stok tükenmesi ----------------------------- */

  const stockByProduct = new Map<string, number>();
  for (const variant of variantRows) {
    const key = String(variant.product_id);
    stockByProduct.set(key, (stockByProduct.get(key) ?? 0) + Number(variant.stock ?? 0));
  }
  const soldByProduct = new Map<string, number>();
  for (const item of itemRows) {
    const key = String(item.product_id ?? "");
    soldByProduct.set(key, (soldByProduct.get(key) ?? 0) + Number(item.quantity ?? 0));
  }
  const depletion = depletionForecast(
    [...soldByProduct.entries()].map(([productId, unitsSold]) => ({
      productId,
      title: productTitle.get(productId) ?? "Ürün",
      stock: stockByProduct.get(productId) ?? 0,
      unitsSold,
      price: productPrice.get(productId) ?? 0,
      windowDays: range.days,
    })),
  ).slice(0, 25);

  const stockLossTotal = r2(depletion.reduce((total, row) => total + row.lostRevenue, 0));

  return {
    storeName: String(store.data.name),
    currency,
    range,
    settings,
    profit,
    daily,
    currencyBreakdown,
    funnel,
    metrics,
    cohorts,
    live,
    geo,
    devices,
    landingPages,
    channels,
    marketplaces,
    vendorScorecard,
    depletion,
    stockLossTotal,
    spend: spendRows.map((row) => ({
      id: String(row.id),
      spendDate: String(row.spend_date),
      channel: String(row.channel),
      amount: Number(row.amount ?? 0),
      currency: String(row.currency ?? currency),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      note: (row.note ?? null) as string | null,
    })),
  };
}

/* --------------------------- maliyet & harcama yazma ---------------------- */

export async function saveCostSettings(args: {
  client: Client;
  storeId: string;
  input: CostSettings & { currency?: string | undefined };
}) {
  const db = args.client as unknown as Any;
  const { error } = await db.from("finance_cost_settings").upsert(
    {
      store_id: args.storeId,
      payment_commission_rate: args.input.paymentCommissionRate,
      shipping_cost_per_order: args.input.shippingCostPerOrder,
      packaging_cost_per_order: args.input.packagingCostPerOrder,
      overhead_rate: args.input.overheadRate,
      ...(args.input.currency ? { currency: args.input.currency } : {}),
    },
    { onConflict: "store_id" },
  );
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function addMarketingSpend(args: {
  client: Client;
  storeId: string;
  input: {
    spendDate: string;
    channel: string;
    amount: number;
    currency: string;
    impressions?: number | undefined;
    clicks?: number | undefined;
    note?: string | undefined;
  };
}) {
  const db = args.client as unknown as Any;
  const { error } = await db.from("marketing_spend").insert({
    store_id: args.storeId,
    spend_date: args.input.spendDate,
    channel: args.input.channel,
    amount: args.input.amount,
    currency: args.input.currency,
    impressions: args.input.impressions ?? 0,
    clicks: args.input.clicks ?? 0,
    note: args.input.note ?? null,
  });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function deleteMarketingSpend(args: { client: Client; storeId: string; id: string }) {
  const db = args.client as unknown as Any;
  const { error } = await db.from("marketing_spend").delete().eq("id", args.id).eq("store_id", args.storeId);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0);
}

function r2(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}
