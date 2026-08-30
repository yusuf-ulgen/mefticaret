import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ürün soru & cevap. Sorular "pending" olarak kaydedilir; mağaza ekibi
 * yayınlayana kadar vitrinde görünmez. Tenant izolasyonu RLS ile zorlanır.
 */

export const submitQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeSlug: z.string().trim().min(1).max(120),
        productId: z.string().uuid(),
        question: z.string().trim().min(5).max(1000),
        authorName: z.string().trim().min(2).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, store_id, stores!inner(slug)")
      .eq("id", data.productId)
      .eq("status", "active")
      .maybeSingle();
    if (productError) throw new Error(productError.message);
    if (!product || (product as { stores?: { slug: string } }).stores?.slug !== data.storeSlug) {
      throw new Error("Ürün bulunamadı");
    }

    const { data: myCustomers } = await supabase
      .from("customers")
      .select("id")
      .eq("store_id", product.store_id)
      .eq("user_id", userId);

    const { data: question, error } = await supabase
      .from("product_questions")
      .insert({
        store_id: product.store_id,
        product_id: data.productId,
        customer_id: myCustomers?.[0]?.id ?? null,
        user_id: userId,
        author_name: data.authorName,
        question: data.question,
        status: "pending",
      })
      .select("id, status")
      .maybeSingle();
    if (error) throw new Error(error.message);

    return question;
  });

export const moderateQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        questionId: z.string().uuid(),
        status: z.enum(["pending", "published", "rejected"]).optional(),
        answer: z.string().trim().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    if (data.status) patch["status"] = data.status;
    if (data.answer !== undefined) {
      patch["answer"] = data.answer || null;
      patch["answered_at"] = data.answer ? new Date().toISOString() : null;
      // Cevap yazıldıysa ve soru hâlâ bekliyorsa otomatik yayınla
      if (data.answer && !data.status) patch["status"] = "published";
    }
    if (Object.keys(patch).length === 0) throw new Error("Güncellenecek alan yok");

    const { data: question, error } = await supabase
      .from("product_questions")
      .update(patch as never)
      .eq("id", data.questionId)
      .select("id, store_id, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!question) throw new Error("Bu soruyu yönetme yetkiniz yok");

    await supabase.from("audit_logs").insert({
      store_id: question.store_id,
      actor_id: userId,
      action: "question.moderated",
      entity: "product_questions",
      entity_id: question.id,
      new_value: patch as never,
    });

    return question;
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ questionId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: question, error } = await supabase
      .from("product_questions")
      .delete()
      .eq("id", data.questionId)
      .select("id, store_id, author_name")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!question) throw new Error("Bu soruyu silme yetkiniz yok");

    await supabase.from("audit_logs").insert({
      store_id: question.store_id,
      actor_id: userId,
      action: "question.deleted",
      entity: "product_questions",
      entity_id: question.id,
      old_value: { author_name: question.author_name } as never,
    });
    return { id: question.id };
  });
