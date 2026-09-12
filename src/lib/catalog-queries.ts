import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ProductStatus = "draft" | "active" | "archived";

export const productsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["products", storeId],
    // Liste ekranı için ilk 500 kayıt yeterli; büyük kataloglarda mobil
    // yüklemeyi hızlandırır. Kısa süreli önbellek sekme geçişlerinde
    // gereksiz yeniden istekleri önler.
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_variants(id, stock, price), product_images(url, position)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

export const productQuery = (productId: string) =>
  queryOptions({
    queryKey: ["product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_variants(*), product_collections(collection_id)")
        .eq("id", productId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const collectionsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["collections", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("*, product_collections(product_id)")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
