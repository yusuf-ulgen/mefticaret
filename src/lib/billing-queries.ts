import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Abonelik sorguları: paket limit kullanımı ve mağaza aktivite kayıtları. */

export type StoreUsage = {
  products: number;
  orders: number;
  staff: number;
  domains: number;
  collections: number;
};

export const storeUsageQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-usage", storeId],
    queryFn: async (): Promise<StoreUsage> => {
      const counts = await Promise.all(
        (["products", "orders", "store_users", "store_domains", "collections"] as const).map(
          async (table) => {
            const { count, error } = await supabase
              .from(table)
              .select("id", { count: "exact", head: true })
              .eq("store_id", storeId);
            if (error) throw error;
            return count ?? 0;
          },
        ),
      );
      return {
        products: counts[0],
        orders: counts[1],
        staff: counts[2],
        domains: counts[3],
        collections: counts[4],
      };
    },
  });

export type PlanLimits = {
  products?: number;
  staff?: number;
  domains?: number;
  orders_monthly?: number;
};

export function readLimits(limits: unknown): PlanLimits {
  if (!limits || typeof limits !== "object") return {};
  const raw = limits as Record<string, unknown>;
  const num = (key: string) => (typeof raw[key] === "number" ? (raw[key] as number) : undefined);
  return {
    products: num("products"),
    staff: num("staff"),
    domains: num("domains"),
    orders_monthly: num("orders_monthly"),
  };
}

export function readFeatures(features: unknown): string[] {
  if (Array.isArray(features)) return features.filter((item): item is string => typeof item === "string");
  if (features && typeof features === "object") {
    return Object.entries(features as Record<string, unknown>)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);
  }
  return [];
}

export function usageRatio(used: number, limit: number | undefined): number | null {
  if (limit === undefined || limit === null || limit < 0) return null;
  if (limit === 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}
