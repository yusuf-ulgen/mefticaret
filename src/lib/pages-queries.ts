import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getStorefrontPage } from "@/lib/storefront.functions";

export const storePagesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["store-pages", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_pages")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

export const storefrontPageQuery = (slug: string, pageSlug: string) =>
  queryOptions({
    queryKey: ["storefront", slug, "page", pageSlug],
    queryFn: () => getStorefrontPage({ data: { slug, pageSlug } }),
    staleTime: 60_000,
  });
