import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Otomatik SEO AI merkezi — yalnızca platform_admin doğrulaması sonrası çalışır. */

async function guard(supabase: unknown, userId: string) {
  const mod = await import("@/lib/platform-admin.server");
  await mod.assertPlatformAdmin(supabase as never, userId);
}

const settingsSchema = z.object({
  isEnabled: z.boolean().optional(),
  runLanding: z.boolean().optional(),
  runProducts: z.boolean().optional(),
  runCollections: z.boolean().optional(),
  runBlog: z.boolean().optional(),
  runCampaigns: z.boolean().optional(),
  autofixEnabled: z.boolean().optional(),
  aiEnabled: z.boolean().optional(),
  providerCode: z.enum(["lovable", "openai", "anthropic", "gemini"]).optional(),
  model: z.string().trim().min(2).max(80).optional(),
  maxStoresPerRun: z.number().int().min(1).max(100).optional(),
  maxItemsPerStore: z.number().int().min(1).max(40).optional(),
  dailyHour: z.number().int().min(0).max(23).optional(),
  focusKeywords: z.string().max(500).optional(),
});

export const fetchSeoAiStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.supabase, context.userId);
    const server = await import("@/lib/seo-ai.server");
    return server.seoAiStatus();
  });

export const saveSeoAiConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => settingsSchema.parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const server = await import("@/lib/seo-ai.server");
    return server.saveSeoAiSettings(data);
  });

export const runSeoAiNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ storeId: z.string().uuid().nullish() }).parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const server = await import("@/lib/seo-ai.server");
    return server.runSeoAiCycle({
      trigger: "manual",
      userId: context.userId,
      storeId: data.storeId ?? null,
      force: true,
    });
  });
