import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ShipmentStatus =
  | "pending"
  | "in_transit"
  | "delivered"
  | "returned"
  | "cancelled";

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  pending: "Hazırlanıyor",
  in_transit: "Yolda",
  delivered: "Teslim edildi",
  returned: "İade edildi",
  cancelled: "İptal edildi",
};

export const orderShipmentsQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["shipments", "order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipments")
        .select("*, shipment_items(id, order_item_id, quantity)")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const storeShipmentsQuery = (storeId: string, status?: ShipmentStatus | "all") =>
  queryOptions({
    queryKey: ["shipments", storeId, status ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("shipments")
        .select("*, orders(order_number, customer_name)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status && status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
