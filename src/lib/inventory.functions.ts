import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Stok uygulama katmanı. Tenant izolasyonu RLS ile zorlanır; burada stok
 * hesabı ve değiştirilemez stok hareketi kaydı üretilir.
 */

const kindEnum = z.enum(["count", "restock", "manual_out", "sale", "return", "damage"]);

export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        variantId: z.string().uuid(),
        kind: kindEnum,
        /** count → mutlak stok; diğerleri → miktar (pozitif) */
        amount: z.number().int().min(0).max(1_000_000),
        reason: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: variant, error: variantError } = await supabase
      .from("product_variants")
      .select("id, product_id, stock, store_id")
      .eq("id", data.variantId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (variantError) throw new Error(variantError.message);
    if (!variant) throw new Error("Varyant bulunamadı veya yetkiniz yok");

    const before = variant.stock ?? 0;
    let after = before;
    if (data.kind === "count") after = data.amount;
    else if (data.kind === "restock" || data.kind === "return") after = before + data.amount;
    else after = before - data.amount;
    if (after < 0) after = 0;

    const { error: updateError } = await supabase
      .from("product_variants")
      .update({ stock: after })
      .eq("id", variant.id);
    if (updateError) throw new Error(updateError.message);

    const { error: moveError } = await supabase.from("inventory_movements").insert({
      store_id: data.storeId,
      product_id: variant.product_id,
      variant_id: variant.id,
      kind: data.kind,
      quantity: data.kind === "count" ? after - before : data.amount,
      stock_before: before,
      stock_after: after,
      reason: data.reason?.length ? data.reason : null,
      actor_id: userId,
    });
    if (moveError) throw new Error(moveError.message);

    return { stock: after, before };
  });

export const setLowStockThreshold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        variantId: z.string().uuid(),
        threshold: z.number().int().min(0).max(100_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("product_variants")
      .update({ low_stock_threshold: data.threshold })
      .eq("id", data.variantId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
