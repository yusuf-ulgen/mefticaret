import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { sanitizeNullableText, sanitizeText, sanitizeUrl } from "@/lib/sanitize";

/**
 * Tedarikçi dosya içe aktarmalarının arka plan işleyicisi.
 * İstek sırasında yalnızca kayıt açılır; satırların işlenmesi kuyrukta yapılır.
 */

type Client = SupabaseClient<Database>;

/** Kuyruğa giren her satır burada yeniden doğrulanır (frontend'e güvenilmez). */
export const importRowSchema = z.object({
  index: z.number().int().min(0),
  sku: z.string().trim().min(1).max(120).transform((value) => sanitizeText(value, 120)),
  barcode: z.string().trim().max(120).nullable().transform((value) => sanitizeNullableText(value, 120)),
  title: z.string().trim().min(1).max(400).transform((value) => sanitizeText(value, 400)),
  description: z.string().max(8000).nullable().transform((value) => sanitizeNullableText(value, 8000)),
  costPrice: z.number().finite().min(0).max(100_000_000),
  retailPrice: z.number().finite().min(0).max(100_000_000).nullable(),
  stock: z.number().int().min(0).max(10_000_000),
  category: z.string().trim().max(200).nullable().transform((value) => sanitizeNullableText(value, 200)),
  brand: z.string().trim().max(200).nullable().transform((value) => sanitizeNullableText(value, 200)),
  images: z
    .array(z.string().max(2000))
    .max(20)
    .transform((values) => values.map((value) => sanitizeUrl(value)).filter((value): value is string => value !== null)),
  color: z.string().trim().max(120).nullable().transform((value) => sanitizeNullableText(value, 120)),
  size: z.string().trim().max(120).nullable().transform((value) => sanitizeNullableText(value, 120)),
  currency: z.string().trim().max(10).nullable(),
  errors: z.array(z.string().max(300)).max(20),
});

export const importJobPayloadSchema = z.object({
  importJobId: z.string(),
  storeId: z.string(),
  supplierId: z.string(),
  feedId: z.string(),
  currency: z.string().min(1).max(10),
  rows: z.array(importRowSchema).max(5000),
  invalidCount: z.number().int().min(0),
});

export async function runSupplierImportJob(
  supabase: Client,
  importJobId: string,
  payload: Record<string, unknown>,
) {
  const parsed = importJobPayloadSchema.parse({ ...payload, importJobId });
  await supabase.from("supplier_import_jobs").update({ status: "running" } as never).eq("id", importJobId);

  try {
    const { applySupplierImport } = await import("@/lib/supplier-desk.server");
    const rows = parsed.rows.filter((row) => row.errors.length === 0);
    const result = await applySupplierImport(supabase as never, {
      storeId: parsed.storeId,
      supplierId: parsed.supplierId,
      feedId: parsed.feedId,
      rows: rows as never,
      currency: parsed.currency,
    });

    const { error: finishError } = await supabase
      .from("supplier_import_jobs")
      .update({
        status: parsed.invalidCount === 0 ? "completed" : rows.length === 0 ? "failed" : "partial",
        created_count: result.created,
        updated_count: result.updated,
        valid_count: rows.length,
        error_count: parsed.invalidCount,
      } as never)
      .eq("id", importJobId);
    if (finishError) throw new Error(finishError.message);

    return { importJobId, ...result, invalid: parsed.invalidCount };
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "İçe aktarma başarısız";
    await supabase
      .from("supplier_import_jobs")
      .update({ status: "failed" } as never)
      .eq("id", importJobId);
    throw new Error(message);
  }
}
