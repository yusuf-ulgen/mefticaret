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
        .select(
          "title, slug, excerpt, body, meta_title, seo_description, canonical_url, noindex, show_contact_form, updated_at",
        )
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

/** Vitrin ve mobil uygulamada gösterilecek platform sayfaları (alt menü). */
export const platformFooterPagesQuery = () =>
  queryOptions({
    queryKey: ["platform-footer-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_pages")
        .select("title, slug")
        .eq("is_published", true)
        .eq("show_in_footer", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 300_000,
  });
