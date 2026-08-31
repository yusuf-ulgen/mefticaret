import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { ShippingOrderInput } from "@/lib/shipping-economics";

/** Kargo ekonomisi verisi: dönem siparişlerinin sepet ve kargo tutarları. */
export const shippingEconomicsQuery = (storeId: string, days = 90) =>
  queryOptions({
    queryKey: ["shipping-economics", storeId, days],
    queryFn: async (): Promise<ShippingOrderInput[]> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("orders")
        .select("id, subtotal, shipping_total, discount_total, grand_total, created_at, status")
        .eq("store_id", storeId)
        .gte("created_at", since)
        .not("status", "in", "(cancelled,refunded)")
        .limit(8000);

      if (error) throw error;

      return (data ?? []).map((order) => ({
        orderId: String(order.id),
        subtotal: Number(order.subtotal ?? 0),
        shippingCharged: Number(order.shipping_total ?? 0),
        discountTotal: Number(order.discount_total ?? 0),
        grandTotal: Number(order.grand_total ?? 0),
        createdAt: String(order.created_at),
      }));
    },
    staleTime: 60_000,
  });
