import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { BasketItemInput } from "@/lib/basket";

/** Sepet analizi için sipariş kalemleri (son 5000 satır). */
export const basketDataQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["basket-data", storeId],
    queryFn: async (): Promise<BasketItemInput[]> => {
      const { data, error } = await supabase
        .from("order_items")
        .select("order_id, product_id, title, quantity, line_total")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;

      return (data ?? [])
        .filter((row) => row.product_id && row.order_id)
        .map((row) => ({
          orderId: String(row.order_id),
          productId: String(row.product_id),
          title: row.title ? String(row.title) : "Ürün",
          quantity: Number(row.quantity ?? 0),
          lineTotal: Number(row.line_total ?? 0),
        }));
    },
    staleTime: 60_000,
  });
