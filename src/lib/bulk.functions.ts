import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const rowSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional(),
  sku: z.string().trim().max(60).optional(),
  vendor: z.string().trim().max(80).optional(),
  productType: z.string().trim().max(80).optional(),
  price: z.number().min(0).max(9_999_999),
  compareAtPrice: z.number().min(0).max(9_999_999).optional(),
  stock: z.number().int().min(0).max(1_000_000),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  tags: z.array(z.string().trim().max(40)).max(20).default([]),
});

export const importProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        rows: z.array(rowSchema).min(1).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { importProductRows } = await import("@/lib/bulk.server");

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, currency, plans(limits)")
      .eq("id", data.storeId)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

    const limits = ((store as { plans?: { limits?: Record<string, number> } }).plans?.limits ??
      {}) as { products?: number };

    let remainingQuota: number | null = null;
    if (typeof limits.products === "number" && limits.products >= 0) {
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("store_id", data.storeId);
      remainingQuota = Math.max(0, limits.products - (count ?? 0));
    }

    const result = await importProductRows(
      supabase as never,
      data.storeId,
      store.currency,
      data.rows,
      remainingQuota,
    );

    await supabase.from("audit_logs").insert({
      store_id: data.storeId,
      actor_id: userId,
      action: "catalog.imported",
      entity: "products",
      new_value: {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped.length,
      } as never,
    });

    return result;
  });
