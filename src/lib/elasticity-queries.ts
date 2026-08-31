import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { ElasticityItemInput, ElasticityVariantInput } from "@/lib/elasticity";

/** İndirim derinliği analizi verisi: satılan kalemler + varyant liste fiyatları. */
export const elasticityDataQuery = (storeId: string, days = 180) =>
  queryOptions({
    queryKey: ["elasticity-data", storeId, days],
    queryFn: async (): Promise<{
      items: ElasticityItemInput[];
      variants: ElasticityVariantInput[];
    }> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [itemsRes, variantsRes] = await Promise.all([
        supabase
          .from("order_items")
          .select(
            "order_id, product_id, variant_id, title, quantity, unit_price, line_total, created_at",
          )
          .eq("store_id", storeId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(8000),
        supabase
          .from("product_variants")
          .select("id, product_id, price, cost_price")
          .eq("store_id", storeId)
          .limit(5000),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (variantsRes.error) throw variantsRes.error;

      return {
        items: (itemsRes.data ?? []).map((row) => ({
          orderId: String(row.order_id),
          productId: row.product_id ? String(row.product_id) : null,
          variantId: row.variant_id ? String(row.variant_id) : null,
          title: String(row.title ?? "Ürün"),
          quantity: Number(row.quantity ?? 0),
          unitPrice: Number(row.unit_price ?? 0),
          lineTotal: Number(row.line_total ?? 0),
          createdAt: String(row.created_at),
        })),
        variants: (variantsRes.data ?? []).map((row) => ({
          id: String(row.id),
          productId: String(row.product_id),
          price: Number(row.price ?? 0),
          costPrice: row.cost_price === null ? null : Number(row.cost_price),
        })),
      };
    },
    staleTime: 60_000,
  });
