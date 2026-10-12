import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/** TikTok modülü veri sorguları (RLS ile mağaza kapsamlı). */

export type TiktokAccount = Database["public"]["Tables"]["tiktok_accounts"]["Row"];
export type TiktokRule = Database["public"]["Tables"]["tiktok_comment_rules"]["Row"];
export type TiktokInteraction = Database["public"]["Tables"]["tiktok_interactions"]["Row"];
export type TiktokEvent = Database["public"]["Tables"]["tiktok_events"]["Row"];

export const tiktokAccountQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["tiktok", storeId, "account"],
    queryFn: async (): Promise<TiktokAccount | null> => {
      const { data, error } = await supabase
        .from("tiktok_accounts")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ?? null;
    },
    staleTime: 30_000,
  });

export const tiktokRulesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["tiktok", storeId, "rules"],
    queryFn: async (): Promise<TiktokRule[]> => {
      const { data, error } = await supabase
        .from("tiktok_comment_rules")
        .select("*")
        .eq("store_id", storeId)
        .order("priority", { ascending: true });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 15_000,
  });

export const tiktokInteractionsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["tiktok", storeId, "interactions"],
    queryFn: async (): Promise<TiktokInteraction[]> => {
      const { data, error } = await supabase
        .from("tiktok_interactions")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 10_000,
  });

export const tiktokEventsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["tiktok", storeId, "events"],
    queryFn: async (): Promise<TiktokEvent[]> => {
      const { data, error } = await supabase
        .from("tiktok_events")
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
export const tiktokProductOptionsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["tiktok", storeId, "product-options"],
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
