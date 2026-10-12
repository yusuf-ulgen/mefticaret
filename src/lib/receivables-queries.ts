import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { ReceivableOrder } from "@/lib/receivables";

/** Tahsilat takibi: dönem içindeki siparişleri ödeme durumu ile döner. */
export const receivablesQuery = (storeId: string, days = 90) =>
  queryOptions({
    queryKey: ["receivables", storeId, days],
    queryFn: async (): Promise<ReceivableOrder[]> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, payment_status, status, grand_total, placed_at, updated_at")
        .eq("store_id", storeId)
        .gte("placed_at", since)
        .order("placed_at", { ascending: false })
        .limit(10000);
      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: String(row.id),
        orderNumber: String(row.order_number ?? ""),
        customerName: String(row.customer_name ?? "Misafir"),
        paymentStatus: String(row.payment_status ?? "pending"),
        status: String(row.status ?? ""),
        grandTotal: Number(row.grand_total ?? 0),
        placedAt: String(row.placed_at),
        updatedAt: String(row.updated_at ?? row.placed_at),
      }));
    },
  });
