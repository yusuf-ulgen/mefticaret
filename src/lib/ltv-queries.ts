import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { LtvOrder } from "@/lib/ltv";

/** LTV analizi için mağazanın tüm sipariş geçmişi (RLS ile izole). */
export const ltvOrdersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["ltv-orders", storeId],
    queryFn: async (): Promise<LtvOrder[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("customer_id, customer_email, customer_name, grand_total, placed_at, created_at, status")
        .eq("store_id", storeId)
        .order("placed_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as LtvOrder[];
    },
  });
