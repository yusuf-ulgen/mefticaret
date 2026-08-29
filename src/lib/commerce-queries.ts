import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ConnectorKind = "payment" | "shipping";

export const connectorsQuery = (kind: ConnectorKind) =>
  queryOptions({
    queryKey: ["connectors", kind],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("connectors")
        .select("*")
        .eq("kind", kind)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const paymentMethodsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["payment-methods", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_payment_methods")
        .select("*, connectors(code, name, description, supports_installments, config_fields)")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const shippingZonesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["shipping-zones", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_zones")
        .select("*, shipping_rates(*, connectors(code, name))")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
