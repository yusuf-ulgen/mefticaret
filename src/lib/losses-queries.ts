import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { LossItemInput, LossOrderInput } from "@/lib/losses";

/** İptal & kayıp analizi verisi (son 180 gün). */
export const lossesDataQuery = (storeId: string, days = 180) =>
  queryOptions({
    queryKey: ["losses-data", storeId, days],
    queryFn: async (): Promise<{ orders: LossOrderInput[]; items: LossItemInput[] }> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [ordersRes, itemsRes] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, order_number, placed_at, status, payment_status, grand_total, customer_name, discount_code",
          )
          .eq("store_id", storeId)
          .gte("placed_at", since)
          .order("placed_at", { ascending: false })
          .limit(3000),
        supabase
          .from("order_items")
          .select("order_id, product_id, title, quantity, line_total")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .limit(8000),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (itemsRes.error) throw itemsRes.error;

      return {
        orders: (ordersRes.data ?? []).map((row) => ({
          id: String(row.id),
          orderNumber: String(row.order_number ?? ""),
          placedAt: String(row.placed_at),
          status: String(row.status),
          paymentStatus: String(row.payment_status),
          grandTotal: Number(row.grand_total ?? 0),
          customerName: row.customer_name ? String(row.customer_name) : null,
          discountCode: row.discount_code ? String(row.discount_code) : null,
        })),
        items: (itemsRes.data ?? []).map((row) => ({
          orderId: String(row.order_id),
          productId: row.product_id ? String(row.product_id) : null,
          title: row.title ? String(row.title) : "Ürün",
          quantity: Number(row.quantity ?? 0),
          lineTotal: Number(row.line_total ?? 0),
        })),
      };
    },
    staleTime: 60_000,
  });
