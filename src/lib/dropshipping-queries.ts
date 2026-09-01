import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type {
  DropshipOrderStatus,
  FieldMap,
  PriceRules,
  StockRules,
  SupplierFeedKind,
  SupplierFeedRunStatus,
  SupplierFeedSchedule,
  SupplierMatchKey,
} from "@/lib/dropshipping";

export type SupplierFeedRow = {
  id: string;
  store_id: string;
  supplier_id: string | null;
  name: string;
  kind: SupplierFeedKind;
  source_url: string;
  auth_header: string | null;
  schedule: SupplierFeedSchedule;
  is_active: boolean;
  match_key: SupplierMatchKey;
  item_path: string | null;
  field_map: FieldMap;
  category_map: Record<string, string>;
  brand_map: Record<string, string>;
  price_rules: PriceRules;
  stock_rules: StockRules;
  import_images: boolean;
  create_missing: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status: SupplierFeedRunStatus | null;
  last_error: string | null;
  stats: Record<string, number>;
  created_at: string;
  suppliers: { id: string; name: string } | null;
};

export type SupplierFeedRunRow = {
  id: string;
  feed_id: string;
  status: SupplierFeedRunStatus;
  trigger: string;
  started_at: string;
  finished_at: string | null;
  totals: Record<string, number>;
  error: string | null;
};

export type SupplierProductRow = {
  id: string;
  feed_id: string;
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

export const supplierFeedsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["supplier-feeds", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_feeds")
        .select("*, suppliers(id, name)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SupplierFeedRow[];
    },
  });

export const supplierFeedRunsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["supplier-feed-runs", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_feed_runs")
        .select("id, feed_id, status, trigger, started_at, finished_at, totals, error")
        .eq("store_id", storeId)
        .order("started_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as unknown as SupplierFeedRunRow[];
    },
  });

export const supplierProductsQuery = (storeId: string, feedId?: string) =>
  queryOptions({
    queryKey: ["supplier-products", storeId, feedId ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("supplier_products")
        .select(
          "id, feed_id, external_id, sku, barcode, title, brand, category, supplier_price, computed_price, stock, images, product_id, variant_id, matched_at, updated_at",
        )
        .eq("store_id", storeId)
        .order("updated_at", { ascending: false })
        .limit(200);
      if (feedId) query = query.eq("feed_id", feedId);
      const { data, error } = await query;
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
