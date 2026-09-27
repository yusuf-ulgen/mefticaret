import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const markets = z.array(z.enum(["google", "trendyol", "hepsiburada", "amazon"])).max(4);
const short = z.string().trim().max(160).optional();

export const generateKeywords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        mode: z.enum(["text", "vision", "url"]),
        markets,
        productName: short,
        category: short,
        audience: short,
        imageDataUrl: z
          .string()
          .max(6_000_000)
          .regex(/^data:image\/(png|jpe?g|webp);base64,/, "Yalnız PNG, JPG veya WEBP görsel")
          .optional(),
        url: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { generateKeywordSet } = await import("@/lib/keyword-generator.server");
    const { aiCreditBalance } = await import("@/lib/ai-credits.server");
    const out = await generateKeywordSet({ ...data, userId: context.userId });
    return { ...out, balance: await aiCreditBalance(data.storeId) };
  });

export const generateKeywordDescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        productName: z.string().trim().min(1).max(160),
        category: short,
        audience: short,
        keywords: z.array(z.string().trim().min(1).max(120)).min(1).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { generateSeoDescription } = await import("@/lib/keyword-generator.server");
    const { aiCreditBalance } = await import("@/lib/ai-credits.server");
    const out = await generateSeoDescription({ ...data, userId: context.userId });
    return { ...out, balance: await aiCreditBalance(data.storeId) };
  });

export const listKeywordProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), q: z.string().trim().max(80).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("products")
      .select("id, title")
      .eq("store_id", data.storeId)
      .order("updated_at", { ascending: false })
      .limit(30);
    const term = (data.q ?? "").replace(/[^\p{L}\p{N} _-]/gu, "").trim();
    if (term) query = query.ilike("title", `%${term}%`);
    const { data: rows, error } = await query;
    if (error) throw new Error("Ürünler yüklenemedi");
    return rows ?? [];
  });

/** Seçili ürünün meta başlık, meta açıklama ve arama etiketlerini doldurur. */
export const applyKeywordsToProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        storeId: z.guid(),
        productId: z.guid(),
        metaTitle: z.string().trim().max(120),
        metaDescription: z.string().trim().max(320),
        tags: z.array(z.string().trim().min(1).max(80)).max(40),
        description: z.string().trim().max(10000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const patch: { seo_title: string; seo_description: string; tags: string[]; description?: string } = {
      seo_title: data.metaTitle,
      seo_description: data.metaDescription,
      tags: [...new Set(data.tags.map((t) => t.toLocaleLowerCase("tr")))],
    };
    if (data.description) patch.description = data.description;
    const { data: row, error } = await context.supabase
      .from("products")
      .update(patch)
      .eq("id", data.productId)
      .eq("store_id", data.storeId)
      .select("id")
      .maybeSingle();
    if (error || !row) throw new Error("Ürün güncellenemedi");
    return { ok: true as const };
  });
