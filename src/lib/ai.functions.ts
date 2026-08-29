import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** AI asistan sunucu fonksiyonları (thin wrapper — mantık ai.server.ts içinde). */

export const generateProductCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        title: z.string().trim().min(2).max(160),
        audience: z.string().trim().max(200).optional(),
        keywords: z.string().trim().max(300).optional(),
        tone: z.enum(["premium", "samimi", "teknik", "minimal"]).default("premium"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { chatComplete, COPY_SYSTEM_PROMPT } = await import("@/lib/ai.server");

    const { data: store, error } = await context.supabase
      .from("stores")
      .select("id, name, industry")
      .eq("id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

    const prompt = [
      `Mağaza: ${store.name}${store.industry ? ` (${store.industry})` : ""}`,
      `Ürün: ${data.title}`,
      data.audience ? `Hedef kitle: ${data.audience}` : null,
      data.keywords ? `Anahtar kelimeler: ${data.keywords}` : null,
      `Ton: ${data.tone}`,
    ]
      .filter(Boolean)
      .join("\n");

    const text = await chatComplete([
      { role: "system", content: COPY_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ]);
    return { text };
  });

export const generateStoreInsight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.string().uuid(), days: z.number().int().min(7).max(180).default(30) }).parse(data))
  .handler(async ({ data, context }) => {
    const { chatComplete, INSIGHT_SYSTEM_PROMPT } = await import("@/lib/ai.server");
    const { buildInsightPrompt, collectStoreMetrics } = await import("@/lib/analytics.server");

    const metrics = await collectStoreMetrics(context.supabase, data.storeId, data.days);
    const text = await chatComplete([
      { role: "system", content: INSIGHT_SYSTEM_PROMPT },
      { role: "user", content: buildInsightPrompt(metrics, data.days) },
    ]);
    return { text, metrics };
  });
