import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type SupplierRow = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  tax_number: string | null;
  address: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
};

export type PurchaseOrderItemRow = {
  id: string;
  purchase_order_id: string;
  variant_id: string | null;
  product_id: string | null;
  title: string;
  sku: string | null;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
};

export type PurchaseOrderRow = {
  id: string;
  code: string;
  status: "draft" | "ordered" | "received" | "cancelled";
  currency: string;
  supplier_id: string | null;
  expected_at: string | null;
  received_at: string | null;
  note: string | null;
  created_at: string;
  suppliers: { id: string; name: string } | null;
  purchase_order_items: PurchaseOrderItemRow[];
};

export const suppliersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["suppliers", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("store_id", storeId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SupplierRow[];
    },
  });

export const purchaseOrdersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["purchase-orders", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(
          "id, code, status, currency, supplier_id, expected_at, received_at, note, created_at, suppliers(id, name), purchase_order_items(id, purchase_order_id, variant_id, product_id, title, sku, quantity, received_quantity, unit_cost)",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as PurchaseOrderRow[];
    },
  });
