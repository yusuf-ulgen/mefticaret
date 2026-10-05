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
      // Açıklama (200.000 karaktere kadar) listede indirilmez; liste çok daha hızlı açılır.
      const { data, error } = await supabase
        .from("products")
        .select(
          "id,store_id,title,slug,status,vendor,product_type,tags,base_price,compare_at_price,currency,track_inventory,seo,created_at,updated_at,sku,barcode,seller_name,video_url,cost_price,tax_rate,weight_grams,length_cm,width_cm,height_cm,variant_options,seller_id,tax_class_id,brand_id,vendor_id,category_id,made_to_order,prep_days,custom_note_enabled,custom_note_label,is_digital,published_at,seo_title,seo_description, product_variants(id, stock, price), product_images(url, position)",
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

/** Dışa aktarma için ürün açıklamalarını yalnız gerektiğinde indirir. */
export async function fetchProductDescriptions(storeId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("products")
    .select("id, description")
    .eq("store_id", storeId)
    .limit(500);
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id, p.description ?? ""]));
}

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
