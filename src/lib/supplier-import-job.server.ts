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
  shortDescription: z
    .string()
    .max(1000)
    .nullable()
    .default(null)
    .transform((value) => sanitizeNullableText(value, 600)),
  costPrice: z.number().finite().min(0).max(100_000_000),
  retailPrice: z.number().finite().min(0).max(100_000_000).nullable(),
  discountPrice: z.number().finite().min(0).max(100_000_000).nullable().default(null),
  taxRate: z.number().finite().min(0).max(100).nullable().default(null),
  stock: z.number().int().min(0).max(10_000_000),
  category: z.string().trim().max(200).nullable().transform((value) => sanitizeNullableText(value, 200)),
  categoryPath: z
    .array(z.string().max(200))
    .max(6)
    .default([])
    .transform((values) => values.map((value) => sanitizeText(value, 200)).filter(Boolean)),
  brand: z.string().trim().max(200).nullable().transform((value) => sanitizeNullableText(value, 200)),
  images: z
    .array(z.string().max(2000))
    .max(20)
    .transform((values) => values.map((value) => sanitizeUrl(value)).filter((value): value is string => value !== null)),
  videos: z
    .array(
      z.object({
        url: z.string().max(2000),
        source: z.string().max(20),
        embedUrl: z.string().max(2000),
        thumbnailUrl: z.string().max(2000).nullable(),
      }),
    )
    .max(6)
    .default([])
    .transform((values) =>
      values
        .map((video) => ({
          url: sanitizeUrl(video.url),
          source: sanitizeText(video.source, 20),
          embedUrl: sanitizeUrl(video.embedUrl),
          thumbnailUrl: video.thumbnailUrl ? sanitizeUrl(video.thumbnailUrl) : null,
        }))
        .filter((video): video is { url: string; source: string; embedUrl: string; thumbnailUrl: string | null } =>
          video.url !== null && video.embedUrl !== null,
        ),
    ),
  color: z.string().trim().max(120).nullable().transform((value) => sanitizeNullableText(value, 120)),
  size: z.string().trim().max(120).nullable().transform((value) => sanitizeNullableText(value, 120)),
  currency: z.string().trim().max(10).nullable(),
  fabric: z.string().trim().max(200).nullable().default(null).transform((value) => sanitizeNullableText(value, 200)),
  modelSize: z.string().trim().max(200).nullable().default(null).transform((value) => sanitizeNullableText(value, 200)),
  hsCode: z.string().trim().max(40).nullable().default(null).transform((value) => sanitizeNullableText(value, 40)),
  weight: z.number().finite().min(0).max(100_000).nullable().default(null),
  variants: z
    .array(
      z.object({
        name: z.string().max(120),
        value: z.string().max(200),
        barcode: z.string().max(120).nullable(),
        stock: z.number().int().min(0).max(10_000_000),
        price: z.number().finite().min(0).max(100_000_000).nullable(),
        image: z.string().max(2000).nullable(),
      }),
    )
    .max(60)
    .default([])
    .transform((values) =>
      values.map((variant) => ({
        name: sanitizeText(variant.name, 120) || "Beden",
        value: sanitizeText(variant.value, 200),
        barcode: sanitizeNullableText(variant.barcode, 120),
        stock: variant.stock,
        price: variant.price,
        image: variant.image ? sanitizeUrl(variant.image) : null,
      })),
    ),
  warnings: z.array(z.string().max(300)).max(20).default([]),
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

/**
 * Kırık görsel koruması: erişilemeyen (404) birincil görseller ayıklanır,
 * satırda hiç geçerli görsel kalmazsa yer tutucu atanır — akış durmaz.
 */
async function repairBrokenImages<T extends { images: string[] }>(rows: T[], budget = 200): Promise<number> {
  const cache = new Map<string, boolean>();
  let checks = 0;
  let replaced = 0;

  const reachable = async (url: string): Promise<boolean> => {
    if (cache.has(url)) return cache.get(url)!;
    if (checks >= budget) return true;
    checks += 1;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
      clearTimeout(timer);
      const ok = response.status !== 404 && response.status !== 410;
      cache.set(url, ok);
      return ok;
    } catch {
      // Ağ hatası kırık link sayılmaz; görsel korunur.
      cache.set(url, true);
      return true;
    }
  };

  for (const row of rows) {
    if (!row.images.length) continue;
    const kept: string[] = [];
    for (const image of row.images.slice(0, 6)) {
      if (await reachable(image)) kept.push(image);
    }
    if (!kept.length) {
      row.images = [PLACEHOLDER_IMAGE];
      replaced += 1;
    } else if (kept.length !== row.images.length) {
      row.images = kept;
    }
  }
  return replaced;
}

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
    const placeholders = await repairBrokenImages(rows);
    const result = await applySupplierImport(supabase as never, {
      storeId: parsed.storeId,
      supplierId: parsed.supplierId,
      feedId: parsed.feedId,
      rows: rows as never,
      currency: parsed.currency,
    });
    if (placeholders) {
      console.warn(`[supplier-import] ${placeholders} satıra yer tutucu görsel atandı (job ${importJobId})`);
    }

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
