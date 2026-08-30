import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Maliyet (cost_price) güncellemeleri. Tenant izolasyonu RLS ile zorlanır. */

export const setVariantCosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        updates: z
          .array(
            z.object({
              variantId: z.string().uuid(),
              costPrice: z.number().min(0).max(9_999_999).nullable(),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const ids = data.updates.map((update) => update.variantId);
    const { data: owned, error } = await supabase
      .from("product_variants")
      .select("id")
      .eq("store_id", data.storeId)
      .in("id", ids);
    if (error) throw new Error(error.message);
    const allowed = new Set((owned ?? []).map((variant) => String(variant.id)));
    if (allowed.size === 0) throw new Error("Güncellenecek varyant bulunamadı");

    let updated = 0;
    for (const update of data.updates) {
      if (!allowed.has(update.variantId)) continue;
      const { error: updateError } = await supabase
        .from("product_variants")
        .update({ cost_price: update.costPrice } as never)
        .eq("id", update.variantId)
        .eq("store_id", data.storeId);
      if (updateError) throw new Error(updateError.message);
      updated += 1;
    }

    await supabase.from("audit_logs").insert({
      store_id: data.storeId,
      actor_id: userId,
      action: "pricing.costs_updated",
      entity: "product_variants",
      entity_id: null,
      new_value: { variants: updated } as never,
    });

    return { updated };
  });
