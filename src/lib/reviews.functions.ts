import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ürün değerlendirmeleri. Yorumlar "pending" olarak kaydedilir; mağaza ekibi
 * onaylayana kadar vitrinde görünmez. Tenant izolasyonu RLS ile zorlanır.
 */

export const submitReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeSlug: z.string().trim().min(1).max(120),
        productId: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        title: z.string().trim().max(120).optional(),
        body: z.string().trim().max(2000).optional(),
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
    const customerIds = (myCustomers ?? []).map((row) => row.id);

    let verified = false;
    if (customerIds.length) {
      const { count } = await supabase
        .from("order_items")
        .select("id, orders!inner(customer_id)", { count: "exact", head: true })
        .eq("product_id", data.productId)
        .in("orders.customer_id", customerIds);
      verified = (count ?? 0) > 0;
    }

    const { data: review, error } = await supabase
      .from("product_reviews")
      .insert({
        store_id: product.store_id,
        product_id: data.productId,
        customer_id: customerIds[0] ?? null,
        user_id: userId,
        author_name: data.authorName,
        rating: data.rating,
        title: data.title ?? null,
        body: data.body ?? null,
        is_verified_purchase: verified,
        status: "pending",
      })
      .select("id, status, is_verified_purchase")
      .maybeSingle();
    if (error) {
      if (error.code === "23505" || error.message.includes("duplicate")) {
        throw new Error("Bu ürün için zaten bir değerlendirme bıraktınız");
      }
      throw new Error(error.message);
    }

    return review;
  });

export const moderateReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        reviewId: z.string().uuid(),
        status: z.enum(["pending", "published", "rejected"]).optional(),
        reply: z.string().trim().max(1000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, unknown> = {};
    if (data.status) patch["status"] = data.status;
    if (data.reply !== undefined) {
      patch["reply"] = data.reply || null;
      patch["replied_at"] = data.reply ? new Date().toISOString() : null;
    }
    if (Object.keys(patch).length === 0) throw new Error("Güncellenecek alan yok");

    const { data: review, error } = await supabase
      .from("product_reviews")
      .update(patch as never)
      .eq("id", data.reviewId)
      .select("id, store_id, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!review) throw new Error("Bu yorumu yönetme yetkiniz yok");

    await supabase.from("audit_logs").insert({
      store_id: review.store_id,
      actor_id: userId,
      action: "review.moderated",
      entity: "product_reviews",
      entity_id: review.id,
      new_value: patch as never,
    });

    return review;
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ reviewId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: review, error } = await supabase
      .from("product_reviews")
      .delete()
      .eq("id", data.reviewId)
      .select("id, store_id, author_name")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!review) throw new Error("Bu yorumu silme yetkiniz yok");

    await supabase.from("audit_logs").insert({
      store_id: review.store_id,
      actor_id: userId,
      action: "review.deleted",
      entity: "product_reviews",
      entity_id: review.id,
      old_value: { author_name: review.author_name } as never,
    });
    return { id: review.id };
  });
