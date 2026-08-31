import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { ReorderInput } from "@/lib/reorder";

/** Yeniden sipariş verileri: satış adetleri + varyant stok/maliyet bilgisi. */
export const reorderDataQuery = (storeId: string, windowDays: number) =>
  queryOptions({
    queryKey: ["reorder-data", storeId, windowDays],
    queryFn: async (): Promise<ReorderInput[]> => {
      const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
      const [items, variants, products] = await Promise.all([
        supabase
          .from("order_items")
          .select("variant_id, quantity, created_at")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .limit(5000),
        supabase
          .from("product_variants")
          .select("id, product_id, title, sku, stock, cost_price")
          .eq("store_id", storeId)
          .limit(3000),
        supabase.from("products").select("id, title, status").eq("store_id", storeId).limit(2000),
      ]);
      if (items.error) throw items.error;
      if (variants.error) throw variants.error;
      if (products.error) throw products.error;

      const sold = new Map<string, number>();
      for (const item of items.data ?? []) {
        if (!item.variant_id) continue;
        const key = String(item.variant_id);
        sold.set(key, (sold.get(key) ?? 0) + Number(item.quantity ?? 0));
      }
      const productTitle = new Map(
        (products.data ?? []).map((product) => [String(product.id), String(product.title ?? "")]),
      );

      return (variants.data ?? []).map((variant) => {
        const id = String(variant.id);
        const parent = variant.product_id ? productTitle.get(String(variant.product_id)) : null;
        const variantTitle = variant.title ? String(variant.title) : "Varsayılan";
        return {
          variantId: id,
          productId: variant.product_id ? String(variant.product_id) : null,
          title: parent ? `${parent} — ${variantTitle}` : variantTitle,
          sku: variant.sku ? String(variant.sku) : null,
          stock: Number(variant.stock ?? 0),
          costPrice: variant.cost_price == null ? null : Number(variant.cost_price),
          soldUnits: sold.get(id) ?? 0,
        };
      });
    },
  });
