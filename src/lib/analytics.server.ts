/** Sunucu tarafı analitik toplama — AI insight promptu için kullanılır. */

type AnySupabase = {
  from: (table: string) => any;
};

export type StoreMetrics = {
  storeName: string;
  currency: string;
  revenue: number;
  orders: number;
  aov: number;
  paidRatio: number;
  cancelled: number;
  newCustomers: number;
  lowStock: { title: string; stock: number }[];
  topProducts: { title: string; quantity: number; revenue: number }[];
  activeProducts: number;
  discountCodes: string[];
};

export async function collectStoreMetrics(
  supabase: AnySupabase,
  storeId: string,
  days: number,
): Promise<StoreMetrics> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [storeRes, ordersRes, itemsRes, variantsRes, productsRes, customersRes] = await Promise.all([
    supabase.from("stores").select("name, currency").eq("id", storeId).maybeSingle(),
    supabase
      .from("orders")
      .select("grand_total, status, payment_status, discount_code")
      .eq("store_id", storeId)
      .gte("placed_at", since),
    supabase
      .from("order_items")
      .select("title, quantity, line_total")
      .eq("store_id", storeId)
      .gte("created_at", since)
      .limit(1000),
    supabase
      .from("product_variants")
      .select("title, stock, low_stock_threshold")
      .eq("store_id", storeId)
      .order("stock", { ascending: true })
      .limit(200),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId).eq("status", "active"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("store_id", storeId).gte("created_at", since),
  ]);

  if (!storeRes.data) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

  const orders: any[] = ordersRes.data ?? [];
  const revenue = orders.reduce((total, order) => total + Number(order.grand_total ?? 0), 0);
  const paid = orders.filter((order) => order.payment_status === "paid").length;
  const cancelled = orders.filter((order) => order.status === "cancelled" || order.status === "refunded").length;

  const grouped = new Map<string, { title: string; quantity: number; revenue: number }>();
  for (const item of (itemsRes.data ?? []) as any[]) {
    const key = item.title as string;
    const entry = grouped.get(key) ?? { title: key, quantity: 0, revenue: 0 };
    entry.quantity += Number(item.quantity ?? 0);
    entry.revenue += Number(item.line_total ?? 0);
    grouped.set(key, entry);
  }

  const lowStock = ((variantsRes.data ?? []) as any[])
    .filter((variant) => Number(variant.stock ?? 0) <= Number(variant.low_stock_threshold ?? 0))
    .slice(0, 8)
    .map((variant) => ({ title: String(variant.title), stock: Number(variant.stock ?? 0) }));

  return {
    storeName: String(storeRes.data.name),
    currency: String(storeRes.data.currency ?? "TRY"),
    revenue,
    orders: orders.length,
    aov: orders.length > 0 ? revenue / orders.length : 0,
    paidRatio: orders.length > 0 ? (paid / orders.length) * 100 : 0,
    cancelled,
    newCustomers: Number(customersRes.count ?? 0),
    lowStock,
    topProducts: [...grouped.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6),
    activeProducts: Number(productsRes.count ?? 0),
    discountCodes: [...new Set(orders.map((order) => order.discount_code).filter(Boolean))].slice(0, 6) as string[],
  };
}

export function buildInsightPrompt(metrics: StoreMetrics, days: number): string {
  return [
    `Mağaza: ${metrics.storeName} (${metrics.currency})`,
    `Dönem: son ${days} gün`,
    `Ciro: ${metrics.revenue.toFixed(2)}`,
    `Sipariş: ${metrics.orders}`,
    `Sepet ortalaması: ${metrics.aov.toFixed(2)}`,
    `Ödemesi tamamlanan sipariş oranı: ${metrics.paidRatio.toFixed(1)}%`,
    `İptal/iade: ${metrics.cancelled}`,
    `Yeni müşteri: ${metrics.newCustomers}`,
    `Aktif ürün: ${metrics.activeProducts}`,
    `Kritik stok: ${metrics.lowStock.map((row) => `${row.title} (${row.stock})`).join(", ") || "yok"}`,
    `En çok satan: ${metrics.topProducts.map((row) => `${row.title} x${row.quantity}`).join(", ") || "veri yok"}`,
    `Kullanılan kuponlar: ${metrics.discountCodes.join(", ") || "yok"}`,
  ].join("\n");
}
