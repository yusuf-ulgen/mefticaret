import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type BlogCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
};

export type BlogTag = { id: string; name: string; slug: string };

export type BlogAuthor = {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  bio: string | null;
  avatar_url: string | null;
  email: string | null;
};

export type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  seo_description: string | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  updated_at: string;
  category_id: string | null;
  author_id: string | null;
  author_name: string | null;
  cover_url: string | null;
  show_in_footer: boolean;
  sort_order: number;
  tagIds: string[];
};

export const BLOG_STATUS_LABELS: Record<string, string> = {
  draft: "Taslak",
  published: "Yayında",
  scheduled: "Zamanlanmış",
};

export const blogCategoriesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["blog-categories", storeId],
    queryFn: async (): Promise<BlogCategory[]> => {
      const { data, error } = await supabase
        .from("blog_categories")
        .select("id, name, slug, description, sort_order")
        .eq("store_id", storeId)
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

export const blogTagsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["blog-tags", storeId],
    queryFn: async (): Promise<BlogTag[]> => {
      const { data, error } = await supabase
        .from("blog_tags")
        .select("id, name, slug")
        .eq("store_id", storeId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

export const blogAuthorsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["blog-authors", storeId],
    queryFn: async (): Promise<BlogAuthor[]> => {
      const { data, error } = await supabase
        .from("blog_authors")
        .select("id, name, slug, title, bio, avatar_url, email")
        .eq("store_id", storeId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

/** Yönetim paneli: mağazanın blog yazıları (etiket eşleşmeleriyle). */
export const blogPostsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["blog-posts", storeId],
    queryFn: async (): Promise<BlogPostRow[]> => {
      const { data, error } = await supabase
        .from("store_pages")
        .select(
          "id, title, slug, excerpt, body, seo_description, status, scheduled_at, published_at, updated_at, category_id, author_id, author_name, cover_url, show_in_footer, sort_order, store_page_tags(tag_id)",
        )
        .eq("store_id", storeId)
        .eq("page_kind", "blog")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const { store_page_tags: tags, ...rest } = row as typeof row & {
          store_page_tags: { tag_id: string }[] | null;
        };
        return { ...rest, tagIds: (tags ?? []).map((tag) => tag.tag_id) } as BlogPostRow;
      });
    },
  });
