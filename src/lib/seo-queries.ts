import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

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
      const [products, images] = await Promise.all([
        supabase
          .from("products")
          .select("id, title, slug, status, description, seo")
          .eq("store_id", storeId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("product_images").select("product_id").eq("store_id", storeId).limit(2000),
      ]);
      if (products.error) throw products.error;
      if (images.error) throw images.error;

      const counts = new Map<string, number>();
      for (const image of images.data ?? []) {
        const key = String(image.product_id);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }

      return (products.data ?? []).map((product) => ({
        id: String(product.id),
        title: product.title,
        slug: product.slug,
        status: String(product.status),
        description: product.description,
        seo: (product.seo ?? null) as SeoProductRow["seo"],
        imageCount: counts.get(String(product.id)) ?? 0,
      }));
    },
    staleTime: 60 * 1000,
  });
