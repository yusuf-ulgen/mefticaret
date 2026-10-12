import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Analitik sorguları: RLS ile mağaza izolasyonu korunur. */

function sinceIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const analyticsOrdersQuery = (storeId: string, days: number) =>
  queryOptions({
    queryKey: ["analytics-orders", storeId, days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, placed_at, created_at, grand_total, subtotal, discount_total, shipping_total, status, payment_status, fulfillment_status, customer_id, customer_email, discount_code",
        )
        .eq("store_id", storeId)
        .gte("placed_at", sinceIso(days))
        .order("placed_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const analyticsItemsQuery = (storeId: string, days: number) =>
  queryOptions({
    queryKey: ["analytics-items", storeId, days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, title, variant_title, quantity, line_total, product_id, created_at")
        .eq("store_id", storeId)
        .gte("created_at", sinceIso(days))
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

export type AnalyticsOrder = {
  placed_at: string | null;
  created_at: string;
  grand_total: number | string;
  status: string;
  payment_status: string;
  customer_email: string | null;
  discount_code: string | null;
};

/** Günlük ciro/sipariş serisi üretir (boş günler 0 ile doldurulur). */
export function buildDailySeries(orders: AnalyticsOrder[], days: number) {
  const buckets = new Map<string, { date: string; revenue: number; orders: number }>();
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    buckets.set(date, { date, revenue: 0, orders: 0 });
  }
  for (const order of orders) {
    const key = (order.placed_at ?? order.created_at).slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += Number(order.grand_total ?? 0);
    bucket.orders += 1;
  }
  return [...buckets.values()];
}

/** Ürün performans raporu için güncel stok ve ürün bilgisi. */
export const productPerformanceStockQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["product-performance-stock", storeId],
    queryFn: async () => {
      const [products, variants] = await Promise.all([
        supabase
          .from("products")
          .select("id, title, status, base_price, currency")
          .eq("store_id", storeId)
          .limit(1000),
        supabase.from("product_variants").select("product_id, stock").eq("store_id", storeId).limit(2000),
      ]);
      if (products.error) throw products.error;
      if (variants.error) throw variants.error;
      const stockByProduct = new Map<string, number>();
      for (const variant of variants.data ?? []) {
        const key = String(variant.product_id);
        stockByProduct.set(key, (stockByProduct.get(key) ?? 0) + Number(variant.stock ?? 0));
      }
      return (products.data ?? []).map((product) => ({
        id: String(product.id),
        title: String(product.title),
        status: String(product.status),
        stock: stockByProduct.get(String(product.id)) ?? 0,
      }));
    },
  });
