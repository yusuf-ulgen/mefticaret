import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** AI asistan sunucu fonksiyonları (mantık ai.server.ts içinde). */

export const runAiAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        task: z.string().trim().min(2).max(60),
        values: z.record(z.string(), z.string().max(6000)).default({}),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { runAiTask } = await import("@/lib/ai.server");
    const result = await runAiTask({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      taskKey: data.task,
      values: data.values,
    });
    return {
      text: result.text,
      totalTokens: result.totalTokens,
      model: result.model,
      providerCode: result.providerCode,
    };
  });

export const saveStoreAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        providerCode: z.string().trim().min(2).max(40),
        model: z.string().trim().min(2).max(120),
        creativity: z.number().min(0).max(1),
        brandTone: z.string().trim().min(2).max(40),
        language: z.string().trim().min(2).max(10),
        monthlyTokenLimit: z.number().int().min(0).max(50_000_000),
        isEnabled: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("store_ai_settings")
      .upsert(
        {
          store_id: data.storeId,
          provider_code: data.providerCode,
          model: data.model,
          creativity: data.creativity,
          brand_tone: data.brandTone,
          language: data.language,
          monthly_token_limit: data.monthlyTokenLimit,
          is_enabled: data.isEnabled,
        },
        { onConflict: "store_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAiProviderEnabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ providerId: z.guid(), isEnabled: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ai_providers")
      .update({ is_enabled: data.isEnabled })
      .eq("id", data.providerId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const generateProductCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        title: z.string().trim().min(2).max(160),
        audience: z.string().trim().max(200).optional(),
        keywords: z.string().trim().max(300).optional(),
        tone: z.enum(["premium", "samimi", "teknik", "minimal"]).default("premium"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { runAiTask } = await import("@/lib/ai.server");
    const result = await runAiTask({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      taskKey: "product_description",
      values: {
        product: data.title,
        details: data.keywords ?? "",
        audience: data.audience ?? "",
        tone: data.tone,
      },
    });
    return { text: result.text };
  });

export const generateStoreInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), days: z.number().int().min(7).max(180).default(30) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { runAiTask } = await import("@/lib/ai.server");
    const result = await runAiTask({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      taskKey: "sales_analysis",
      values: { days: String(data.days) },
    });
    return { text: result.text };
  });
