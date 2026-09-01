import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computePrice } from "@/lib/pricing";
import { insertAuditRow } from "./audit.server";

/** Toplu fiyat güncelleme. Tenant izolasyonu RLS ile zorlanır. */

export const applyBulkPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        productIds: z.array(z.string().uuid()).min(1).max(500),
        mode: z.enum(["increase_percent", "decrease_percent", "increase_amount", "decrease_amount", "set"]),
        value: z.number().min(0).max(9_999_999),
        round: z.enum(["none", "integer", "x90", "x99"]),
        includeVariants: z.boolean(),
        setCompareAtToOld: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: products, error } = await supabase
      .from("products")
      .select("id, title, base_price, compare_at_price")
      .eq("store_id", data.storeId)
      .in("id", data.productIds);
    if (error) throw new Error(error.message);
    if (!products || products.length === 0) throw new Error("Güncellenecek ürün bulunamadı");

    let productCount = 0;
    let variantCount = 0;

    for (const product of products) {
      const before = Number(product.base_price ?? 0);
      const after = computePrice(before, data.mode, data.value, data.round);
      const patch: Record<string, unknown> = { base_price: after };
      if (data.setCompareAtToOld && after < before) patch["compare_at_price"] = before;

      const { error: updateError } = await supabase
        .from("products")
        .update(patch as never)
        .eq("id", product.id);
      if (updateError) throw new Error(updateError.message);
      productCount += 1;

      if (data.includeVariants) {
        const { data: variants, error: variantError } = await supabase
          .from("product_variants")
          .select("id, price")
          .eq("product_id", product.id);
        if (variantError) throw new Error(variantError.message);
        for (const variant of variants ?? []) {
          const nextPrice = computePrice(Number(variant.price ?? 0), data.mode, data.value, data.round);
          const { error: vErr } = await supabase
            .from("product_variants")
            .update({ price: nextPrice } as never)
            .eq("id", variant.id);
          if (vErr) throw new Error(vErr.message);
          variantCount += 1;
        }
      }
    }

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "pricing.bulk_updated",
      entity: "products",
      entity_id: null,
      new_value: {
        mode: data.mode,
        value: data.value,
        round: data.round,
        includeVariants: data.includeVariants,
        products: productCount,
        variants: variantCount,
      } as never,
    });

    return { productCount, variantCount };
  });
