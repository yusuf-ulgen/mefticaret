import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { readAllPages } from "@/lib/read-all-pages";

export type SeoProductRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  description: string | null;
  seo: { title?: string; description?: string; keywords?: string } | null;
  imageCount: number;
};

export const storeSeoAuditQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["seo-audit", storeId],
    queryFn: async (): Promise<SeoProductRow[]> => {
      const products = await readAllPages((from, to) =>
        supabase
          .from("products")
          .select("id, title, slug, status, description, seo, product_images(count)")
          .eq("store_id", storeId)
          .order("id")
          .range(from, to),
      );

      return (products.data ?? []).map((product) => ({
        id: String(product.id),
        title: product.title,
        slug: product.slug,
        status: String(product.status),
        description: product.description,
        seo: (product.seo ?? null) as SeoProductRow["seo"],
        imageCount: product.product_images[0]?.count ?? 0,
      }));
    },
    staleTime: 60 * 1000,
  });
