import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { AbcInput } from "@/lib/abc";

/** ABC analizi verisi: varyant bazlı dönem cirosu, satılan adet, stok ve maliyet. */
export const abcDataQuery = (storeId: string, windowDays: number) =>
  queryOptions({
    queryKey: ["abc-data", storeId, windowDays],
    queryFn: async (): Promise<AbcInput[]> => {
      const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
      const [items, variants, products] = await Promise.all([
        supabase
          .from("order_items")
          .select("variant_id, quantity, line_total")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .limit(5000),
        supabase
          .from("product_variants")
          .select("id, product_id, title, sku, stock, cost_price")
          .eq("store_id", storeId)
          .limit(3000),
        supabase.from("products").select("id, title").eq("store_id", storeId).limit(2000),
      ]);
      if (items.error) throw items.error;
      if (variants.error) throw variants.error;
      if (products.error) throw products.error;

      const sold = new Map<string, { units: number; revenue: number }>();
      for (const item of items.data ?? []) {
        if (!item.variant_id) continue;
        const key = String(item.variant_id);
        const current = sold.get(key) ?? { units: 0, revenue: 0 };
        current.units += Number(item.quantity ?? 0);
        current.revenue += Number(item.line_total ?? 0);
        sold.set(key, current);
      }
      const productTitle = new Map(
        (products.data ?? []).map((product) => [String(product.id), String(product.title ?? "")]),
      );

      return (variants.data ?? []).map((variant) => {
        const id = String(variant.id);
        const stats = sold.get(id) ?? { units: 0, revenue: 0 };
        const parent = variant.product_id ? productTitle.get(String(variant.product_id)) : null;
        const variantTitle = variant.title ? String(variant.title) : "Varsayılan";
        return {
          variantId: id,
          productId: variant.product_id ? String(variant.product_id) : null,
          title: parent ? `${parent} — ${variantTitle}` : variantTitle,
          sku: variant.sku ? String(variant.sku) : null,
          stock: Number(variant.stock ?? 0),
          costPrice: variant.cost_price == null ? null : Number(variant.cost_price),
          soldUnits: stats.units,
          revenue: stats.revenue,
        };
      });
    },
  });
