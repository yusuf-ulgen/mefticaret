import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { DropshipOrderStatus } from "@/lib/dropshipping";

/** Dropshipping sipariş yönlendirme sorguları (tedarikçi besleme motoru kaldırıldı). */

export type SupplierProductRow = {
  id: string;
  external_id: string | null;
  sku: string | null;
  barcode: string | null;
  title: string;
  brand: string | null;
  category: string | null;
  supplier_price: number;
  computed_price: number | null;
  stock: number;
  images: string[];
  product_id: string | null;
  variant_id: string | null;
  matched_at: string | null;
  updated_at: string;
};

export type DropshipOrderRow = {
  id: string;
  order_id: string;
  supplier_id: string | null;
  status: DropshipOrderStatus;
  external_ref: string | null;
  carrier: string | null;
  tracking_number: string | null;
  error: string | null;
  sent_at: string | null;
  created_at: string;
  orders: { id: string; order_number: string; grand_total: number; currency: string } | null;
  suppliers: { id: string; name: string } | null;
};

export const supplierProductsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["supplier-products", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_products")
        .select(
          "id, external_id, sku, barcode, title, brand, category, supplier_price, computed_price, stock, images, product_id, variant_id, matched_at, updated_at",
        )
        .eq("store_id", storeId)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as SupplierProductRow[];
    },
  });

export const dropshipOrdersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["dropship-orders", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dropship_orders")
        .select(
          "id, order_id, supplier_id, status, external_ref, carrier, tracking_number, error, sent_at, created_at, orders(id, order_number, grand_total, currency), suppliers(id, name)",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as DropshipOrderRow[];
    },
  });
