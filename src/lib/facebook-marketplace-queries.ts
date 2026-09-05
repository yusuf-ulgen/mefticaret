import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/** Facebook Marketplace modülü veri sorguları (RLS ile mağaza kapsamlı). */

export type FbAccountRow = Database["public"]["Tables"]["fb_marketplace_accounts"]["Row"];
export type FbListingRow = Database["public"]["Tables"]["fb_marketplace_listings"]["Row"];
export type FbSyncRunRow = Database["public"]["Tables"]["fb_marketplace_sync_runs"]["Row"];

export const fbAccountQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["fb-marketplace", storeId, "account"],
    queryFn: async (): Promise<FbAccountRow | null> => {
      const { data, error } = await supabase
        .from("fb_marketplace_accounts")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
    staleTime: 20_000,
  });

export const fbListingsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["fb-marketplace", storeId, "listings"],
    queryFn: async (): Promise<FbListingRow[]> => {
      const { data, error } = await supabase
        .from("fb_marketplace_listings")
        .select("*")
        .eq("store_id", storeId)
        .order("updated_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 10_000,
  });

export const fbSyncRunsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["fb-marketplace", storeId, "runs"],
    queryFn: async (): Promise<FbSyncRunRow[]> => {
      const { data, error } = await supabase
        .from("fb_marketplace_sync_runs")
        .select("*")
        .eq("store_id", storeId)
        .order("started_at", { ascending: false })
        .limit(15);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 10_000,
  });
