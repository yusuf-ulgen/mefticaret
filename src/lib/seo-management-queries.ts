import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type SeoRedirect = {
  id: string;
  store_id: string;
  source_path: string;
  target_path: string;
  status_code: number;
  is_active: boolean;
  hit_count: number;
  last_hit_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Seo404 = {
  id: string;
  store_id: string;
  path: string;
  hit_count: number;
  last_seen_at: string;
  referrer: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};

export const seoRedirectsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["seo-redirects", storeId],
    queryFn: async (): Promise<SeoRedirect[]> => {
      const { data, error } = await supabase
        .from("store_seo_redirects")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

export const seo404Query = (storeId: string) =>
  queryOptions({
    queryKey: ["seo-404s", storeId],
    queryFn: async (): Promise<Seo404[]> => {
      const { data, error } = await supabase
        .from("store_seo_404s")
        .select("*")
        .eq("store_id", storeId)
        .order("hit_count", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
