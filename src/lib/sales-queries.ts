import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export const ordersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["orders", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(id, quantity)")
        .eq("store_id", storeId)
        .order("placed_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

export const orderQuery = (orderId: string) =>
  queryOptions({
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*), order_events(*), customers(id, full_name, email, phone)")
        .eq("id", orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const customersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["customers", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*, customer_addresses(id, city, district, line1, is_default)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

export const discountsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["discounts", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discounts")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
