import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { GeoOrderInput } from "@/lib/geo";

type AddressLike = { country?: unknown; city?: unknown; district?: unknown } | null;

const pick = (address: AddressLike, key: "country" | "city" | "district"): string | null => {
  if (!address || typeof address !== "object") return null;
  const value = (address as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length ? value.trim() : null;
};

/** Coğrafi satış dağılımı verisi (son N gün). */
export const geoDataQuery = (storeId: string, days = 180) =>
  queryOptions({
    queryKey: ["geo-data", storeId, days],
    queryFn: async (): Promise<GeoOrderInput[]> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, placed_at, status, grand_total, shipping_total, customer_id, customer_email, shipping_address",
        )
        .eq("store_id", storeId)
        .gte("placed_at", since)
        .order("placed_at", { ascending: false })
        .limit(5000);

      if (error) throw error;

      return (data ?? []).map((row) => {
        const address = row.shipping_address as AddressLike;
        return {
          id: String(row.id),
          placedAt: String(row.placed_at),
          status: String(row.status),
          grandTotal: Number(row.grand_total ?? 0),
          shippingTotal: Number(row.shipping_total ?? 0),
          customerKey: row.customer_id
            ? String(row.customer_id)
            : row.customer_email
              ? String(row.customer_email).toLowerCase()
              : null,
          country: pick(address, "country"),
          city: pick(address, "city"),
          district: pick(address, "district"),
        };
      });
    },
    staleTime: 60_000,
  });
