import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type StockAlertRow = {
  id: string;
  email: string;
  variant_id: string | null;
  notified_at: string | null;
  created_at: string;
  products: { title: string; slug: string } | null;
  product_variants: { title: string; stock: number } | null;
};

/** Mağaza ekibi için stok bildirim talepleri — RLS is_store_member ile korunur. */
export const stockAlertsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store", storeId, "stock-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_alerts")
        .select("id, email, variant_id, notified_at, created_at, products(title, slug), product_variants(title, stock)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as StockAlertRow[];
    },
  });
