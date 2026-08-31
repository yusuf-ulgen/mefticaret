import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { SimulatorProductInput } from "@/lib/simulator";

/** Simülatör verisi: son dönem satış kalemleri + varyant maliyetleri. */
export const simulatorDataQuery = (storeId: string, days = 90) =>
  queryOptions({
    queryKey: ["simulator-data", storeId, days],
    queryFn: async (): Promise<{ products: SimulatorProductInput[]; orders: number }> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [itemsRes, variantsRes, ordersRes] = await Promise.all([
        supabase
          .from("order_items")
          .select("order_id, product_id, variant_id, title, quantity, line_total")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .limit(8000),
        supabase
          .from("product_variants")
          .select("id, product_id, price, cost_price")
          .eq("store_id", storeId)
          .limit(6000),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId)
          .gte("created_at", since),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (variantsRes.error) throw variantsRes.error;
      if (ordersRes.error) throw ordersRes.error;

      const costByVariant = new Map<string, number | null>();
      const costByProduct = new Map<string, number | null>();
      for (const row of variantsRes.data ?? []) {
        const cost = row.cost_price === null ? null : Number(row.cost_price);
        costByVariant.set(String(row.id), cost);
        if (cost !== null && !costByProduct.has(String(row.product_id))) {
          costByProduct.set(String(row.product_id), cost);
        }
      }

      const grouped = new Map<string, SimulatorProductInput>();
      for (const row of itemsRes.data ?? []) {
        const key = row.product_id ? String(row.product_id) : `t:${String(row.title)}`;
        const quantity = Number(row.quantity ?? 0);
        const lineTotal = Number(row.line_total ?? 0);
        const unitCost =
          (row.variant_id ? costByVariant.get(String(row.variant_id)) : null) ??
          (row.product_id ? costByProduct.get(String(row.product_id)) : null) ??
          (quantity > 0 ? (lineTotal / quantity) * 0.6 : 0);

        const entry =
          grouped.get(key) ??
          ({
            productId: key,
            title: String(row.title ?? "Ürün"),
            units: 0,
            revenue: 0,
            cost: 0,
          } satisfies SimulatorProductInput);
        entry.units += quantity;
        entry.revenue += lineTotal;
        entry.cost += unitCost * quantity;
        grouped.set(key, entry);
      }

      return {
        products: [...grouped.values()].sort((a, b) => b.revenue - a.revenue),
        orders: ordersRes.count ?? 0,
      };
    },
    staleTime: 60_000,
  });
