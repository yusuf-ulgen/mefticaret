import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { insertAuditRow } from "./audit.server";

const rowSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(200_000).optional(),
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
        storeId: z.guid(),
        rows: z.array(rowSchema).min(1).max(500),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { importProductRows } = await import("@/lib/bulk.server");

    const { data: store, error: storeError } = await supabase
      .from("stores")
      .select("id, currency, plans!stores_plan_id_fkey(limits)")
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

    await insertAuditRow(supabase, {
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

/* ------------------------------------------------------------------ */
/* Toplu ürün işlemleri                                               */
/* ------------------------------------------------------------------ */

const operationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("status"), status: z.enum(["draft", "active", "archived"]) }),
  z.object({
    kind: z.literal("price"),
    mode: z.enum([
      "set",
      "increase_percent",
      "decrease_percent",
      "increase_amount",
      "decrease_amount",
    ]),
    value: z.number().min(0).max(9_999_999),
    target: z.enum(["base", "compare_at", "cost"]).default("base"),
    applyToVariants: z.boolean().default(true),
    rounding: z.enum(["none", "integer", "ends_99"]).default("none"),
  }),
  z.object({
    kind: z.literal("stock"),
    mode: z.enum(["set", "increase", "decrease"]),
    value: z.number().int().min(0).max(1_000_000),
  }),
  z.object({
    kind: z.literal("tags"),
    mode: z.enum(["add", "remove", "replace"]),
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
  }),
  z.object({
    kind: z.literal("collections"),
    mode: z.enum(["add", "remove", "replace"]),
    collectionIds: z.array(z.guid()).max(30),
  }),
  z.object({
    kind: z.literal("fields"),
    vendor: z.string().trim().max(80).optional(),
    productType: z.string().trim().max(80).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    trackInventory: z.boolean().optional(),
  }),
  z.object({ kind: z.literal("delete") }),
]);

export const bulkUpdateProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        productIds: z.array(z.guid()).min(1).max(500),
        operation: operationSchema,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { applyBulkOperation } = await import("@/lib/bulk.server");

    const result = await applyBulkOperation(
      supabase as never,
      data.storeId,
      data.productIds,
      data.operation as never,
    );

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: `catalog.bulk_${data.operation.kind}`,
      entity: "products",
      new_value: {
        operation: data.operation,
        requested: data.productIds.length,
        affected: result.affected,
      } as never,
    });

    return result;
  });
