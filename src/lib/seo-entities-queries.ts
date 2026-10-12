import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { readSeo, type SeoFields } from "@/lib/seo";

/** SEO editöründe düzenlenebilir içerikler. */
export type SeoEntity = {
  id: string;
  kind: "product" | "collection" | "page" | "blog";
  title: string;
  slug: string;
  fallbackDescription: string;
  seo: SeoFields;
  status?: string;
  authorName?: string | null;
  publishedAt?: string | null;
};

export const seoEntitiesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["seo-entities", storeId],
    queryFn: async (): Promise<SeoEntity[]> => {
      const [products, collections, pages] = await Promise.all([
        supabase
          .from("products")
          .select("id, title, slug, status, description, seo")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("collections")
          .select("id, title, slug, description, seo")
          .eq("store_id", storeId)
          .order("sort_order")
          .limit(300),
        supabase
          .from("store_pages")
          .select("id, title, slug, excerpt, seo_description, seo, page_kind, author_name, published_at, is_published")
          .eq("store_id", storeId)
          .order("sort_order")
          .limit(300),
      ]);
      if (products.error) throw products.error;
      if (collections.error) throw collections.error;
      if (pages.error) throw pages.error;

      const rows: SeoEntity[] = [];
      for (const row of products.data ?? []) {
        rows.push({
          id: String(row.id),
          kind: "product",
          title: row.title,
          slug: row.slug,
          fallbackDescription: row.description ?? "",
          seo: readSeo(row.seo),
          status: String(row.status),
        });
      }
      for (const row of collections.data ?? []) {
        rows.push({
          id: String(row.id),
          kind: "collection",
          title: row.title,
          slug: row.slug,
          fallbackDescription: row.description ?? "",
          seo: readSeo(row.seo),
        });
      }
      for (const row of pages.data ?? []) {
        rows.push({
          id: String(row.id),
          kind: row.page_kind === "blog" ? "blog" : "page",
          title: row.title,
          slug: row.slug,
          fallbackDescription: row.seo_description ?? row.excerpt ?? "",
          seo: readSeo(row.seo),
          status: row.is_published ? "published" : "draft",
          authorName: row.author_name,
          publishedAt: row.published_at,
        });
      }
      return rows;
    },
    staleTime: 30 * 1000,
  });
