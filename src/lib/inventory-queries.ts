import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type InventoryMovementKind =
  | "count"
  | "restock"
  | "manual_out"
  | "sale"
  | "return"
  | "damage";

export const inventoryQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["inventory", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select(
          "id, product_id, title, sku, price, stock, low_stock_threshold, products(id, title, status, track_inventory)",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const inventoryMovementsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["inventory-movements", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("*, product_variants(title), products(title)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data ?? [];
    },
  });
