import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { ShipmentRow } from "@/lib/logistics-performance";

/** Kargo performansı için sevkiyatlar + bağlı sipariş tarihleri. */
export const logisticsPerformanceQuery = (storeId: string, windowDays: number) =>
  queryOptions({
    queryKey: ["logistics-performance", storeId, windowDays],
    queryFn: async (): Promise<ShipmentRow[]> => {
      const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("shipments")
        .select("id, carrier, status, created_at, shipped_at, delivered_at, orders(placed_at)")
        .eq("store_id", storeId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(3000);
      if (error) throw error;

      return (data ?? []).map((row) => {
        const order = row.orders as { placed_at?: string | null } | null;
        return {
          id: String(row.id),
          carrier: String(row.carrier ?? ""),
          status: String(row.status ?? "pending"),
          createdAt: String(row.created_at),
          shippedAt: row.shipped_at ? String(row.shipped_at) : null,
          deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
          orderPlacedAt: order?.placed_at ? String(order.placed_at) : null,
        };
      });
    },
  });

export type SupplierPerformanceRow = {
  supplierId: string;
  name: string;
  orders: number;
  receivedOrders: number;
  openOrders: number;
  totalCost: number;
  orderedUnits: number;
  receivedUnits: number;
  fillRate: number;
  avgLeadDays: number | null;
  lastOrderAt: string | null;
};

/** Tedarikçi performansı: sipariş sayısı, karşılama oranı ve tedarik süresi. */
export const supplierPerformanceQuery = (storeId: string, windowDays: number) =>
  queryOptions({
    queryKey: ["supplier-performance", storeId, windowDays],
    queryFn: async (): Promise<SupplierPerformanceRow[]> => {
      const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
      const [suppliers, orders, items] = await Promise.all([
        supabase.from("suppliers").select("id, name").eq("store_id", storeId).limit(500),
        supabase
          .from("purchase_orders")
          .select("id, supplier_id, status, created_at, received_at")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .limit(2000),
        supabase
          .from("purchase_order_items")
          .select("purchase_order_id, quantity, received_quantity, unit_cost")
          .eq("store_id", storeId)
          .limit(8000),
      ]);
      if (suppliers.error) throw suppliers.error;
      if (orders.error) throw orders.error;
      if (items.error) throw items.error;

      const itemsByOrder = new Map<string, { ordered: number; received: number; cost: number }>();
      for (const item of items.data ?? []) {
        const key = String(item.purchase_order_id);
        const current = itemsByOrder.get(key) ?? { ordered: 0, received: 0, cost: 0 };
        const quantity = Number(item.quantity ?? 0);
        current.ordered += quantity;
        current.received += Number(item.received_quantity ?? 0);
        current.cost += quantity * Number(item.unit_cost ?? 0);
        itemsByOrder.set(key, current);
      }

      const names = new Map(
        (suppliers.data ?? []).map((row) => [String(row.id), String(row.name ?? "Tedarikçi")]),
      );
      const grouped = new Map<string, SupplierPerformanceRow>();

      for (const order of orders.data ?? []) {
        const supplierId = order.supplier_id ? String(order.supplier_id) : "unknown";
        const row =
          grouped.get(supplierId) ??
          ({
            supplierId,
            name: names.get(supplierId) ?? "Tedarikçisiz",
            orders: 0,
            receivedOrders: 0,
            openOrders: 0,
            totalCost: 0,
            orderedUnits: 0,
            receivedUnits: 0,
            fillRate: 0,
            avgLeadDays: null,
            lastOrderAt: null,
          } satisfies SupplierPerformanceRow);

        const stats = itemsByOrder.get(String(order.id)) ?? { ordered: 0, received: 0, cost: 0 };
        row.orders += 1;
        row.orderedUnits += stats.ordered;
        row.receivedUnits += stats.received;
        row.totalCost += stats.cost;
        if (order.received_at) {
          row.receivedOrders += 1;
          const lead =
            (new Date(String(order.received_at)).getTime() -
              new Date(String(order.created_at)).getTime()) /
            86_400_000;
          const previousTotal = (row.avgLeadDays ?? 0) * (row.receivedOrders - 1);
          row.avgLeadDays = (previousTotal + Math.max(0, lead)) / row.receivedOrders;
        } else if (order.status !== "cancelled") {
          row.openOrders += 1;
        }
        const createdAt = String(order.created_at);
        if (!row.lastOrderAt || createdAt > row.lastOrderAt) row.lastOrderAt = createdAt;
        grouped.set(supplierId, row);
      }

      return [...grouped.values()]
        .map((row) => ({
          ...row,
          fillRate: row.orderedUnits > 0 ? row.receivedUnits / row.orderedUnits : 0,
        }))
        .sort((a, b) => b.totalCost - a.totalCost);
    },
  });

export type FunnelData = {
  carts: number;
  recoveredCarts: number;
  cartValue: number;
  orders: number;
  revenue: number;
};

/** Sepet → sipariş dönüşüm hunisi verisi. */
export const funnelQuery = (storeId: string, windowDays: number) =>
  queryOptions({
    queryKey: ["funnel", storeId, windowDays],
    queryFn: async (): Promise<FunnelData> => {
      const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
      const [carts, orders] = await Promise.all([
        supabase
          .from("abandoned_carts")
          .select("id, total, recovered_order_id")
          .eq("store_id", storeId)
          .gte("last_seen_at", since)
          .limit(5000),
        supabase
          .from("orders")
          .select("id, grand_total")
          .eq("store_id", storeId)
          .gte("placed_at", since)
          .limit(5000),
      ]);
      if (carts.error) throw carts.error;
      if (orders.error) throw orders.error;

      return {
        carts: carts.data?.length ?? 0,
        recoveredCarts: (carts.data ?? []).filter((row) => row.recovered_order_id).length,
        cartValue: (carts.data ?? []).reduce((sum, row) => sum + Number(row.total ?? 0), 0),
        orders: orders.data?.length ?? 0,
        revenue: (orders.data ?? []).reduce((sum, row) => sum + Number(row.grand_total ?? 0), 0),
      };
    },
  });
