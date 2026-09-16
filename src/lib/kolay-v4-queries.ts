import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { listNearbyStores } from "@/lib/kolay-v4.functions";

/** Kolay Panel v4 okuma katmanı: malzemeler, içindekiler ve komşu mağazalar. */

export type MaterialRow = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  expiry_date: string | null;
  note: string | null;
};

export type Freshness = "fresh" | "soon" | "expired" | "unknown";

/** Son kullanma tarihine göre tazelik durumu: yeşil / sarı / kırmızı. */
export function freshnessOf(expiry: string | null, soonDays = 7): Freshness {
  if (!expiry) return "unknown";
  const day = 86_400_000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const left = Math.round((new Date(`${expiry}T00:00:00`).getTime() - today.getTime()) / day);
  if (left < 0) return "expired";
  if (left <= soonDays) return "soon";
  return "fresh";
}

export const materialsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["kolay-materials", storeId],
    staleTime: 30_000,
    queryFn: async (): Promise<MaterialRow[]> => {
      const { data, error } = await supabase
        .from("store_materials")
        .select("id, name, unit, quantity, expiry_date, note")
        .eq("store_id", storeId)
        .order("expiry_date", { ascending: true, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        unit: row.unit,
        quantity: Number(row.quantity ?? 0),
        expiry_date: row.expiry_date,
        note: row.note,
      }));
    },
  });

/** Ürün kimliği → bağlı malzeme kimlikleri. */
export const productMaterialsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["kolay-product-materials", storeId],
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const { data, error } = await supabase
        .from("product_materials")
        .select("product_id, material_id")
        .eq("store_id", storeId)
        .limit(2000);
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const row of data ?? []) {
        const list = map[row.product_id] ?? [];
        list.push(row.material_id);
        map[row.product_id] = list;
      }
      return map;
    },
  });

export const nearbyStoresQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["kolay-nearby-stores", storeId],
    staleTime: 5 * 60_000,
    queryFn: () => listNearbyStores({ data: { storeId } }),
  });

export type DelegationRow = {
  id: string;
  order_id: string;
  from_store_id: string;
  to_store_id: string;
  status: string;
  note: string | null;
  created_at: string;
};

export const delegationsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["kolay-delegations", storeId],
    staleTime: 20_000,
    queryFn: async (): Promise<DelegationRow[]> => {
      const { data, error } = await supabase
        .from("order_delegations")
        .select("id, order_id, from_store_id, to_store_id, status, note, created_at")
        .or(`from_store_id.eq.${storeId},to_store_id.eq.${storeId}`)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        order_id: row.order_id,
        from_store_id: row.from_store_id,
        to_store_id: row.to_store_id,
        status: row.status,
        note: row.note,
        created_at: row.created_at,
      }));
    },
  });
