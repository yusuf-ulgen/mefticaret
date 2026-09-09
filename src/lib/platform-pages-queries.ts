import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Platform içerik sayfaları — yönetici listesi ve vitrin okuması. */

export const platformPagesQuery = () =>
  queryOptions({
    queryKey: ["platform-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_pages")
        .select("*")
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

export const platformPageQuery = (slug: string) =>
  queryOptions({
    queryKey: ["platform-page", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_pages")
        .select("title, slug, excerpt, body, seo_description, updated_at")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
