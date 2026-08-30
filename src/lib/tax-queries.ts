import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { TaxOrder } from "@/lib/tax";

/** Vergi raporu için sipariş verileri; RLS ile mağaza izolasyonu korunur. */

export const taxOrdersQuery = (storeId: string, days: number) =>
  queryOptions({
    queryKey: ["tax-orders", storeId, days],
    queryFn: async (): Promise<TaxOrder[]> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, placed_at, created_at, status, payment_status, subtotal, discount_total, shipping_total, tax_total, grand_total",
        )
        .eq("store_id", storeId)
        .gte("placed_at", since)
        .order("placed_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((order) => ({
        placedAt: String(order.placed_at ?? order.created_at),
        status: String(order.status),
        paymentStatus: String(order.payment_status),
        subtotal: Number(order.subtotal ?? 0),
        discountTotal: Number(order.discount_total ?? 0),
        shippingTotal: Number(order.shipping_total ?? 0),
        taxTotal: Number(order.tax_total ?? 0),
        grandTotal: Number(order.grand_total ?? 0),
      }));
    },
  });
