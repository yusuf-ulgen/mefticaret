import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/** Instagram modülü veri sorguları (RLS ile mağaza kapsamlı). */

export type InstagramAccount = Database["public"]["Tables"]["instagram_accounts"]["Row"];
export type InstagramRule = Database["public"]["Tables"]["instagram_comment_rules"]["Row"];
export type InstagramInteraction = Database["public"]["Tables"]["instagram_interactions"]["Row"];
export type InstagramEvent = Database["public"]["Tables"]["instagram_events"]["Row"];

export const instagramAccountQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["instagram", storeId, "account"],
    queryFn: async (): Promise<InstagramAccount | null> => {
      const { data, error } = await supabase
        .from("instagram_accounts")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
    staleTime: 30_000,
  });

export const instagramRulesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["instagram", storeId, "rules"],
    queryFn: async (): Promise<InstagramRule[]> => {
      const { data, error } = await supabase
        .from("instagram_comment_rules")
        .select("*")
        .eq("store_id", storeId)
        .order("priority", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 15_000,
  });

export const instagramInteractionsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["instagram", storeId, "interactions"],
    queryFn: async (): Promise<InstagramInteraction[]> => {
      const { data, error } = await supabase
        .from("instagram_interactions")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 10_000,
  });

export const instagramEventsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["instagram", storeId, "events"],
    queryFn: async (): Promise<InstagramEvent[]> => {
      const { data, error } = await supabase
        .from("instagram_events")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 10_000,
  });

/** Kural formunda ürün seçimi için hafif ürün listesi. */
export const instagramProductOptionsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["instagram", storeId, "product-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, title")
        .eq("store_id", storeId)
        .order("title", { ascending: true })
        .limit(200);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 60_000,
  });
