import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** AI İçerik Stüdyosu sunucu fonksiyonları (mantık ai-studio.server.ts içinde). */

const storeId = z.guid();
const tone = z.enum(["profesyonel", "samimi", "premium", "teknik", "minimalist"]);

export const fetchCompetitors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId }).parse(data))
  .handler(async ({ data, context }) => {
    const { listCompetitors } = await import("@/lib/ai-studio.server");
    return listCompetitors(context.supabase, data.storeId);
  });

export const upsertCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid().nullish(),
        productId: z.guid().nullish(),
        name: z.string().trim().min(2).max(200),
        url: z.string().trim().url().max(500).nullish(),
        source: z.string().trim().max(60).nullish(),
        competitorTitle: z.string().trim().max(300).nullish(),
        competitorDescription: z.string().trim().max(6000).nullish(),
        competitorCategory: z.string().trim().max(200).nullish(),
        competitorPrice: z.number().min(0).max(100000000).nullish(),
        currency: z.string().trim().min(3).max(3).nullish(),
        visibilityScore: z.number().int().min(0).max(100).nullish(),
        serpPosition: z.number().int().min(1).max(500).nullish(),
        alertThresholdPct: z.number().min(0).max(100).nullish(),
        isActive: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { saveCompetitor } = await import("@/lib/ai-studio.server");
    const { storeId: store, ...input } = data;
    return saveCompetitor({ client: context.supabase, storeId: store, input });
  });

export const removeCompetitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { deleteCompetitor } = await import("@/lib/ai-studio.server");
    return deleteCompetitor({ client: context.supabase, storeId: data.storeId, id: data.id });
  });

export const analyzeCompetitorProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, competitorId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { analyzeCompetitor } = await import("@/lib/ai-studio.server");
    return analyzeCompetitor({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      competitorId: data.competitorId,
    });
  });

export const generateProductCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        productIds: z.array(z.guid()).min(1).max(20),
        tone,
        keywords: z.string().trim().max(300).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { generateProductCopyPack } = await import("@/lib/ai-studio.server");
    return generateProductCopyPack({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      productIds: data.productIds,
      tone: data.tone,
      ...(data.keywords ? { keywords: data.keywords } : {}),
    });
  });

export const applyProductCopyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        draftId: z.guid(),
        target: z.enum(["description", "seo_description", "both"]).default("both"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { applyProductCopy } = await import("@/lib/ai-studio.server");
    return applyProductCopy({
      client: context.supabase,
      storeId: data.storeId,
      draftId: data.draftId,
      target: data.target,
    });
  });

export const generateCategoryPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ storeId, categoryId: z.guid(), keywords: z.string().trim().max(300).optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { generateCategoryContent } = await import("@/lib/ai-studio.server");
    return generateCategoryContent({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      categoryId: data.categoryId,
      ...(data.keywords ? { keywords: data.keywords } : {}),
    });
  });

export const applyCategoryPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, draftId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { applyCategoryContent } = await import("@/lib/ai-studio.server");
    return applyCategoryContent({ client: context.supabase, storeId: data.storeId, draftId: data.draftId });
  });

export const generateBlogPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        topic: z.string().trim().min(3).max(200),
        keywords: z.string().trim().max(300).optional(),
        tone: tone.optional(),
        length: z.enum(["kısa", "orta", "uzun"]).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { generateBlogPackage } = await import("@/lib/ai-studio.server");
    return generateBlogPackage({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      topic: data.topic,
      ...(data.keywords ? { keywords: data.keywords } : {}),
      ...(data.tone ? { tone: data.tone } : {}),
      ...(data.length ? { length: data.length } : {}),
    });
  });

export const applyBlogPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, draftId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { applyBlogPackage } = await import("@/lib/ai-studio.server");
    return applyBlogPackage({ client: context.supabase, storeId: data.storeId, draftId: data.draftId });
  });

export const generateLegalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        kind: z.enum(["kvkk", "privacy", "returns", "distance_sales", "terms"]),
        companyName: z.string().trim().max(200).optional(),
        contactEmail: z.string().trim().max(200).optional(),
        notes: z.string().trim().max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { generateLegalDraft } = await import("@/lib/ai-studio.server");
    return generateLegalDraft({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      kind: data.kind,
      ...(data.companyName ? { companyName: data.companyName } : {}),
      ...(data.contactEmail ? { contactEmail: data.contactEmail } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
    });
  });

export const applyLegalDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, draftId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { applyLegalDraft } = await import("@/lib/ai-studio.server");
    return applyLegalDraft({ client: context.supabase, storeId: data.storeId, draftId: data.draftId });
  });

export const fetchAiDrafts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId, entityType: z.string().trim().max(30).optional() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { listAiDrafts } = await import("@/lib/ai-studio.server");
    return listAiDrafts(context.supabase, data.storeId, data.entityType);
  });

export const fetchStudioCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId }).parse(data))
  .handler(async ({ data, context }) => {
    const [products, categories] = await Promise.all([
      context.supabase
        .from("products")
        .select("id, title, base_price, currency, status")
        .eq("store_id", data.storeId)
        .order("updated_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("categories")
        .select("id, name")
        .eq("store_id", data.storeId)
        .order("name", { ascending: true })
        .limit(200),
    ]);
    if (products.error) throw new Error(products.error.message);
    if (categories.error) throw new Error(categories.error.message);
    return {
      products: (products.data ?? []).map((row) => ({
        id: String(row.id),
        title: String(row.title),
        price: Number(row.base_price ?? 0),
        currency: String(row.currency ?? "TRY"),
        status: String(row.status),
      })),
      categories: (categories.data ?? []).map((row) => ({ id: String(row.id), name: String(row.name) })),
    };
  });
