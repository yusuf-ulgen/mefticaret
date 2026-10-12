import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { getActiveStorefrontPopups } from "@/lib/marketing-tools.functions";

/** Mağaza panelindeki popup listesi (sıraya göre). */
export const storePopupsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["marketing-tools", storeId, "popups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_popups")
        .select("*")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
  });

/** Ürün/story paylaşım listesi. */
export const storeStoriesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["marketing-tools", storeId, "stories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_stories")
        .select("*, products(id, title, slug)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
  });

/** Paylaşım için mağaza ürün listesi (görsel + slug ile). */
export const storeShareableProductsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["marketing-tools", storeId, "shareable-products"],
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from("products")
        .select("id, title, slug, base_price, currency, status")
        .eq("store_id", storeId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const ids = (products ?? []).map((p) => p.id);
      let covers: Record<string, string> = {};
      if (ids.length) {
        const { data: images } = await supabase
          .from("product_images")
          .select("product_id, url, position")
          .in("product_id", ids)
          .order("position");
        for (const row of images ?? []) {
          if (!covers[row.product_id] && row.url) covers[row.product_id] = row.url;
        }
      }
      return (products ?? []).map((p) => ({ ...p, coverUrl: covers[p.id] ?? null }));
    },
    staleTime: 30_000,
  });

/** Ürün akışları (Google Shopping / TikTok / Instagram / Facebook). */
export const storeProductFeedsQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["marketing-tools", storeId, "product-feeds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_product_feeds")
        .select("*")
        .eq("store_id", storeId)
        .order("kind", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 15_000,
  });

/** Mağaza kategorileri (akış kategori eşleştirme editörü için). */
export const storeCategoriesLiteQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["marketing-tools", storeId, "categories-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug")
        .eq("store_id", storeId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

/** Vitrinde gösterilecek aktif popup'lar (public, anon RLS ile). */
export const activeStorefrontPopupsQuery = (slug: string) =>
  queryOptions({
    queryKey: ["storefront", slug, "popups"],
    queryFn: () => getActiveStorefrontPopups({ data: { slug } }),
    staleTime: 60_000,
  });
