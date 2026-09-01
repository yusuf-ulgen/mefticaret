import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type WarehouseKind = "warehouse" | "branch" | "supplier" | "dropship" | "virtual";
export type StockTransferStatus = "draft" | "in_transit" | "received" | "cancelled";

export const WAREHOUSE_KIND_LABELS: Record<WarehouseKind, string> = {
  warehouse: "Depo",
  branch: "Şube",
  supplier: "Tedarikçi deposu",
  dropship: "Dropshipping",
  virtual: "Sanal depo",
};

export const TRANSFER_STATUS_LABELS: Record<StockTransferStatus, string> = {
  draft: "Taslak",
  in_transit: "Yolda",
  received: "Teslim alındı",
  cancelled: "İptal",
};

export type WarehouseRow = {
  id: string;
  store_id: string;
  code: string;
  name: string;
  kind: WarehouseKind;
  city: string | null;
  district: string | null;
  address: string | null;
  contact_name: string | null;
  phone: string | null;
  priority: number;
  is_default: boolean;
  is_active: boolean;
  allows_fulfillment: boolean;
  external_source: string | null;
  sync_url: string | null;
  last_synced_at: string | null;
  note: string | null;
};

export type InventoryLevelRow = {
  id: string;
  warehouse_id: string;
  variant_id: string;
  product_id: string | null;
  on_hand: number;
  reserved: number;
  incoming: number;
  min_stock: number;
  available: number;
  bin_location: string | null;
  product_variants: { id: string; title: string; sku: string | null; barcode: string | null } | null;
  products: { id: string; title: string } | null;
};

/** Mağaza depoları ve şubeleri — RLS is_store_member ile korunur. */
export const warehousesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["warehouses", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select(
          "id, store_id, code, name, kind, city, district, address, contact_name, phone, priority, is_default, is_active, allows_fulfillment, external_source, sync_url, last_synced_at, note",
        )
        .eq("store_id", storeId)
        .order("priority", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as WarehouseRow[];
    },
  });

/** Depo bazlı stok seviyeleri (mevcut / rezerve / satılabilir / minimum). */
export const inventoryLevelsQuery = (storeId: string, warehouseId?: string | null) =>
  queryOptions({
    queryKey: ["inventory-levels", storeId, warehouseId ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("inventory_levels")
        .select(
          "id, warehouse_id, variant_id, product_id, on_hand, reserved, incoming, min_stock, available, bin_location, product_variants(id, title, sku, barcode), products(id, title)",
        )
        .eq("store_id", storeId)
        .limit(2000);
      if (warehouseId) query = query.eq("warehouse_id", warehouseId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as InventoryLevelRow[];
    },
  });

export type TransferRow = {
  id: string;
  code: string;
  status: StockTransferStatus;
  note: string | null;
  from_warehouse_id: string;
  to_warehouse_id: string;
  shipped_at: string | null;
  received_at: string | null;
  created_at: string;
  stock_transfer_items: {
    id: string;
    title: string;
    sku: string | null;
    quantity: number;
    received_quantity: number;
    variant_id: string | null;
  }[];
};

export const stockTransfersQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["stock-transfers", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_transfers")
        .select(
          "id, code, status, note, from_warehouse_id, to_warehouse_id, shipped_at, received_at, created_at, stock_transfer_items(id, title, sku, quantity, received_quantity, variant_id)",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as TransferRow[];
    },
  });
