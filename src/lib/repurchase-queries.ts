import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { RepurchaseLine } from "@/lib/repurchase";

/** Tekrar satın alma analizi: siparişleri müşteri kimliği ile eşleyip kalemleri döner. */
export const repurchaseQuery = (storeId: string, days = 365) =>
  queryOptions({
    queryKey: ["repurchase", storeId, days],
    queryFn: async (): Promise<RepurchaseLine[]> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const ordersRes = await supabase
        .from("orders")
        .select("id, customer_id, customer_email, placed_at, payment_status")
        .eq("store_id", storeId)
        .gte("placed_at", since)
        .neq("status", "cancelled")
        .limit(10000);
      if (ordersRes.error) throw ordersRes.error;

      const orders = ordersRes.data ?? [];
      const orderMeta = new Map<string, { customerKey: string; placedAt: string }>();
      for (const order of orders) {
        const customerKey = order.customer_id
          ? `c:${order.customer_id}`
          : order.customer_email
            ? `e:${String(order.customer_email).toLowerCase()}`
            : null;
        if (!customerKey) continue;
        orderMeta.set(String(order.id), {
          customerKey,
          placedAt: String(order.placed_at),
        });
      }

      if (orderMeta.size === 0) return [];

      const itemsRes = await supabase
        .from("order_items")
        .select("order_id, product_id, title, quantity, line_total")
        .eq("store_id", storeId)
        .gte("created_at", since)
        .limit(20000);
      if (itemsRes.error) throw itemsRes.error;

      const lines: RepurchaseLine[] = [];
      for (const item of itemsRes.data ?? []) {
        const meta = orderMeta.get(String(item.order_id));
        if (!meta || !item.product_id) continue;
        lines.push({
          orderId: String(item.order_id),
          customerKey: meta.customerKey,
          productId: String(item.product_id),
          productTitle: String(item.title ?? "Ürün"),
          quantity: Number(item.quantity ?? 0),
          lineTotal: Number(item.line_total ?? 0),
          placedAt: meta.placedAt,
        });
      }

      return lines;
    },
  });
