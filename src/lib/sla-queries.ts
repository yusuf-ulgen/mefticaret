import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { SlaOrderInput, SlaShipmentInput } from "@/lib/sla";

/** Karşılama SLA analizi için sipariş + sevkiyat verisi (son 90 gün). */
export const slaDataQuery = (storeId: string, days = 90) =>
  queryOptions({
    queryKey: ["sla-data", storeId, days],
    queryFn: async (): Promise<{ orders: SlaOrderInput[]; shipments: SlaShipmentInput[] }> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [ordersRes, shipmentsRes] = await Promise.all([
        supabase
          .from("orders")
          .select(
            "id, order_number, placed_at, status, fulfillment_status, payment_status, grand_total, customer_name",
          )
          .eq("store_id", storeId)
          .gte("placed_at", since)
          .order("placed_at", { ascending: false })
          .limit(2000),
        supabase
          .from("shipments")
          .select("order_id, created_at, shipped_at, delivered_at, carrier")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .limit(4000),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (shipmentsRes.error) throw shipmentsRes.error;

      return {
        orders: (ordersRes.data ?? []).map((row) => ({
          id: String(row.id),
          orderNumber: String(row.order_number ?? ""),
          placedAt: String(row.placed_at),
          status: String(row.status),
          fulfillmentStatus: String(row.fulfillment_status),
          paymentStatus: String(row.payment_status),
          grandTotal: Number(row.grand_total ?? 0),
          customerName: row.customer_name ? String(row.customer_name) : null,
        })),
        shipments: (shipmentsRes.data ?? []).map((row) => ({
          orderId: String(row.order_id),
          createdAt: String(row.created_at),
          shippedAt: row.shipped_at ? String(row.shipped_at) : null,
          deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
          carrier: row.carrier ? String(row.carrier) : null,
        })),
      };
    },
    staleTime: 60_000,
  });
