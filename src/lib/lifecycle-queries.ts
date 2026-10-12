import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { LifecycleProductInput, LifecycleSaleInput } from "@/lib/lifecycle";

/** Ürün yaşam döngüsü verisi: ürünler + varyant stokları + son 90 günlük satış kalemleri. */
export const lifecycleDataQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["lifecycle-data", storeId],
    queryFn: async (): Promise<{
      products: LifecycleProductInput[];
      sales: LifecycleSaleInput[];
    }> => {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const [productsRes, variantsRes, itemsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, title, status, created_at")
          .eq("store_id", storeId)
          .limit(3000),
        supabase
          .from("product_variants")
          .select("product_id, stock")
          .eq("store_id", storeId)
          .limit(6000),
        supabase
          .from("order_items")
          .select("product_id, quantity, line_total, created_at")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .limit(8000),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (variantsRes.error) throw variantsRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const stockByProduct = new Map<string, number>();
      for (const row of variantsRes.data ?? []) {
        const key = String(row.product_id);
        stockByProduct.set(key, (stockByProduct.get(key) ?? 0) + Number(row.stock ?? 0));
      }

      return {
        products: (productsRes.data ?? []).map((row) => ({
          id: String(row.id),
          title: String(row.title ?? "Ürün"),
          status: String(row.status ?? "draft"),
          createdAt: String(row.created_at),
          stock: stockByProduct.get(String(row.id)) ?? 0,
        })),
        sales: (itemsRes.data ?? []).map((row) => ({
          productId: row.product_id ? String(row.product_id) : null,
          quantity: Number(row.quantity ?? 0),
          lineTotal: Number(row.line_total ?? 0),
          createdAt: String(row.created_at),
        })),
      };
    },
    staleTime: 60_000,
  });
