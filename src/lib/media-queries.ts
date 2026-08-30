import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { signMediaPaths } from "@/lib/media";

export type MediaLibraryItem = {
  id: string;
  alt: string | null;
  position: number;
  storage_path: string | null;
  url: string;
  created_at: string;
  productId: string | null;
  productTitle: string;
  productStatus: string;
  displayUrl: string;
};

/** Mağazanın tüm ürün görsellerini imzalı adreslerle listeler. */
export const mediaLibraryQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["media-library", storeId],
    queryFn: async (): Promise<MediaLibraryItem[]> => {
      const { data, error } = await supabase
        .from("product_images")
        .select("id, alt, position, storage_path, url, created_at, product_id, products(title, status)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(400);
      if (error) throw error;
      const rows = data ?? [];
      const signed = await signMediaPaths(
        rows.map((row) => row.storage_path ?? "").filter(Boolean),
      );
      return rows.map((row) => {
        const product = (row as { products: { title: string; status: string } | null }).products;
        return {
          id: row.id,
          alt: row.alt,
          position: row.position,
          storage_path: row.storage_path,
          url: row.url,
          created_at: row.created_at,
          productId: row.product_id,
          productTitle: product?.title ?? "—",
          productStatus: product?.status ?? "—",
          displayUrl: row.storage_path ? (signed[row.storage_path] ?? "") : row.url,
        };
      });
    },
    staleTime: 30_000,
  });
