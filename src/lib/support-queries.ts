import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { SupportThreadInput } from "@/lib/support";

export type SupportQueryData = {
  threads: SupportThreadInput[];
  titleByProduct: Map<string, string>;
};

/** Müşteri iletişimi: ürün soruları ve yorum yanıtlarını tek akışta toplar. */
export const supportQuery = (storeId: string, days = 90) =>
  queryOptions({
    queryKey: ["support-performance", storeId, days],
    queryFn: async (): Promise<SupportQueryData> => {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [questionsRes, reviewsRes, productsRes] = await Promise.all([
        supabase
          .from("product_questions")
          .select("id, product_id, created_at, answered_at, answer")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .limit(5000),
        supabase
          .from("product_reviews")
          .select("id, product_id, created_at, replied_at, reply, rating")
          .eq("store_id", storeId)
          .gte("created_at", since)
          .limit(5000),
        supabase.from("products").select("id, title").eq("store_id", storeId).limit(5000),
      ]);

      if (questionsRes.error) throw questionsRes.error;
      if (reviewsRes.error) throw reviewsRes.error;
      if (productsRes.error) throw productsRes.error;

      const threads: SupportThreadInput[] = [];

      for (const row of questionsRes.data ?? []) {
        const hasAnswer = Boolean(row.answer && String(row.answer).trim());
        threads.push({
          id: String(row.id),
          kind: "question",
          productId: row.product_id ? String(row.product_id) : null,
          createdAt: String(row.created_at),
          respondedAt: hasAnswer ? (row.answered_at ? String(row.answered_at) : String(row.created_at)) : null,
        });
      }

      for (const row of reviewsRes.data ?? []) {
        const hasReply = Boolean(row.reply && String(row.reply).trim());
        threads.push({
          id: String(row.id),
          kind: "review",
          productId: row.product_id ? String(row.product_id) : null,
          createdAt: String(row.created_at),
          respondedAt: hasReply ? (row.replied_at ? String(row.replied_at) : String(row.created_at)) : null,
          rating: typeof row.rating === "number" ? row.rating : null,
        });
      }

      const titleByProduct = new Map<string, string>();
      for (const product of productsRes.data ?? []) {
        titleByProduct.set(String(product.id), String(product.title ?? "Ürün"));
      }

      return { threads, titleByProduct };
    },
  });
