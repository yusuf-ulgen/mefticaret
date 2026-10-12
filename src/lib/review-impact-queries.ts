import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type {
  ReviewInput,
  ReviewProductInput,
  ReviewReturnInput,
  ReviewSaleInput,
} from "@/lib/review-impact";

/** Değerlendirme etkisi verisi: ürünler, yorumlar, satış kalemleri ve iade kalemleri. */
export const reviewImpactDataQuery = (storeId: string, days = 180) =>
  queryOptions({
    queryKey: ["review-impact-data", storeId, days],
    queryFn: async (): Promise<{
      products: ReviewProductInput[];
      reviews: ReviewInput[];
      sales: ReviewSaleInput[];
      returns: ReviewReturnInput[];
    }> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [productsRes, reviewsRes, itemsRes, returnItemsRes] = await Promise.all([
        supabase.from("products").select("id, title").eq("store_id", storeId).limit(3000),
        supabase
          .from("product_reviews")
          .select("product_id, rating, status, created_at")
          .eq("store_id", storeId)
          .limit(5000),
        supabase
          .from("order_items")
          .select("product_id, quantity, line_total")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .limit(8000),
        supabase
          .from("return_items")
          .select("quantity, order_item_id, order_items(product_id)")
          .eq("store_id", storeId)
          .limit(4000),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (reviewsRes.error) throw reviewsRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (returnItemsRes.error) throw returnItemsRes.error;

      return {
        products: (productsRes.data ?? []).map((row) => ({
          id: String(row.id),
          title: String(row.title ?? "Ürün"),
        })),
        reviews: (reviewsRes.data ?? []).map((row) => ({
          productId: String(row.product_id),
          rating: Number(row.rating ?? 0),
          status: String(row.status ?? "pending"),
          createdAt: String(row.created_at),
        })),
        sales: (itemsRes.data ?? []).map((row) => ({
          productId: row.product_id ? String(row.product_id) : null,
          quantity: Number(row.quantity ?? 0),
          lineTotal: Number(row.line_total ?? 0),
        })),
        returns: (returnItemsRes.data ?? []).map((row) => {
          const joined = (row as { order_items?: { product_id: string | null } | null }).order_items;
          return {
            productId: joined?.product_id ? String(joined.product_id) : null,
            quantity: Number(row.quantity ?? 0),
          };
        }),
      };
    },
    staleTime: 60_000,
  });
