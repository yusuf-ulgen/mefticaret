import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { StockoutInput } from "@/lib/stockout";

/** Stok tükenme radarı: varyant stok/fiyat bilgisi + son iki dönemin satış adetleri. */
export const stockoutDataQuery = (storeId: string, recentDays = 14) =>
  queryOptions({
    queryKey: ["stockout-data", storeId, recentDays],
    queryFn: async (): Promise<StockoutInput[]> => {
      const now = Date.now();
      const recentSince = new Date(now - recentDays * 86_400_000).toISOString();
      const previousSince = new Date(now - recentDays * 2 * 86_400_000).toISOString();

      const [items, variants, products] = await Promise.all([
        supabase
          .from("order_items")
          .select("variant_id, quantity, created_at")
          .eq("store_id", storeId)
          .gte("created_at", previousSince)
          .limit(10000),
        supabase
          .from("product_variants")
          .select("id, product_id, title, sku, stock, price, low_stock_threshold")
          .eq("store_id", storeId)
          .limit(3000),
        supabase.from("products").select("id, title, status").eq("store_id", storeId).limit(2000),
      ]);
      if (items.error) throw items.error;
      if (variants.error) throw variants.error;
      if (products.error) throw products.error;

      const recent = new Map<string, number>();
      const previous = new Map<string, number>();
      for (const item of items.data ?? []) {
        if (!item.variant_id) continue;
        const key = String(item.variant_id);
        const target = String(item.created_at) >= recentSince ? recent : previous;
        target.set(key, (target.get(key) ?? 0) + Number(item.quantity ?? 0));
      }

      const productMap = new Map(
        (products.data ?? []).map((product) => [
          String(product.id),
          { title: String(product.title ?? ""), status: String(product.status ?? "") },
        ]),
      );

      return (variants.data ?? [])
        .filter((variant) => {
          const parent = variant.product_id ? productMap.get(String(variant.product_id)) : null;
          return !parent || parent.status !== "archived";
        })
        .map((variant) => {
          const id = String(variant.id);
          const parent = variant.product_id ? productMap.get(String(variant.product_id)) : null;
          const variantTitle = variant.title ? String(variant.title) : "Varsayılan";
          return {
            variantId: id,
            title: parent?.title ? `${parent.title} — ${variantTitle}` : variantTitle,
            sku: variant.sku ? String(variant.sku) : null,
            stock: Number(variant.stock ?? 0),
            price: Number(variant.price ?? 0),
            lowStockThreshold: Number(variant.low_stock_threshold ?? 0),
            recentUnits: recent.get(id) ?? 0,
            previousUnits: previous.get(id) ?? 0,
          };
        });
    },
  });
