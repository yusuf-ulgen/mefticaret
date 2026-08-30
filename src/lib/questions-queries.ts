import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type QuestionStatus = "pending" | "published" | "rejected";

export const storeQuestionsQuery = (storeId: string, status?: QuestionStatus | "all") =>
  queryOptions({
    queryKey: ["questions", storeId, status ?? "all"],
    queryFn: async () => {
      let query = supabase
        .from("product_questions")
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

export const productQuestionsQuery = (productId: string) =>
  queryOptions({
    queryKey: ["product-questions", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_questions")
        .select("id, author_name, question, answer, answered_at, created_at")
        .eq("product_id", productId)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

export const myProductQuestionsQuery = (productId: string, userId: string | null) =>
  queryOptions({
    queryKey: ["my-questions", productId, userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_questions")
        .select("id, question, answer, status, created_at")
        .eq("product_id", productId)
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
