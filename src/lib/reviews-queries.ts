import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type ReviewStatus = "pending" | "published" | "rejected";

export const storeReviewsQuery = (storeId: string, status?: ReviewStatus | "all") =>
  queryOptions({
    queryKey: ["reviews", storeId, status ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("product_reviews")
        .select("*, products(title, slug)")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(300);
      if (status && status !== "all") query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

export const myProductReviewQuery = (productId: string, userId: string | null) =>
  queryOptions({
    queryKey: ["my-review", productId, userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_reviews")
        .select("id, rating, title, body, status, created_at")
        .eq("product_id", productId)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
