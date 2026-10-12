import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ReturnStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "received"
  | "refunded"
  | "cancelled";

export type ReturnReason =
  | "damaged"
  | "wrong_item"
  | "not_as_described"
  | "size_fit"
  | "changed_mind"
  | "other";

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  requested: "Talep edildi",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  received: "Teslim alındı",
  refunded: "İade edildi",
  cancelled: "İptal edildi",
};

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  damaged: "Hasarlı ürün",
  wrong_item: "Yanlış ürün",
  not_as_described: "Açıklamaya uymuyor",
  size_fit: "Beden / uyum",
  changed_mind: "Fikir değişikliği",
  other: "Diğer",
};

export const storeReturnsQuery = (storeId: string, status?: ReturnStatus | "all") =>
  queryOptions({
    queryKey: ["returns", storeId, status ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("return_requests")
        .select("*, return_items(*), orders(order_number, customer_name, grand_total)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status && status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

export const returnableOrdersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["returnable-orders", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, customer_name, customer_id, currency, grand_total, placed_at, order_items(id, title, variant_title, variant_id, quantity, unit_price)",
        )
        .eq("store_id", storeId)
        .in("payment_status", ["paid", "partially_refunded"])
        .order("placed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
