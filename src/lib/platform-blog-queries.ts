import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Platform blog yazıları — yönetici listesi ve herkese açık okuma. */

export const platformPostsQuery = () =>
  queryOptions({
    queryKey: ["platform-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_posts")
        .select("*")
        .order("sort_order")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const publicPlatformPostsQuery = () =>
  queryOptions({
    queryKey: ["platform-posts", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_posts")
        .select("title, slug, excerpt, cover_url, author_name, tags, is_featured, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

export const publicPlatformPostQuery = (slug: string) =>
  queryOptions({
    queryKey: ["platform-post", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_posts")
        .select("title, slug, excerpt, body, cover_url, seo_description, author_name, tags, published_at, updated_at")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
