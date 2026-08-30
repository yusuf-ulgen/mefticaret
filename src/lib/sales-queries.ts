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

export const customerDetailQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      const [customer, orders, returns] = await Promise.all([
        supabase
          .from("customers")
          .select("*, customer_addresses(*)")
          .eq("id", customerId)
          .maybeSingle(),
        supabase
          .from("orders")
          .select("id, order_number, status, payment_status, grand_total, currency, placed_at")
          .eq("customer_id", customerId)
          .order("placed_at", { ascending: false })
          .limit(100),
        supabase
          .from("return_requests")
          .select("id, return_number, status, refund_amount, currency, created_at")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (customer.error) throw customer.error;
      if (orders.error) throw orders.error;
      if (returns.error) throw returns.error;
      return {
        customer: customer.data,
        orders: orders.data ?? [],
        returns: returns.data ?? [],
      };
    },
  });
