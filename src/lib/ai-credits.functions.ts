import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** AI kredi cüzdanı ve süper admin motor masası sunucu fonksiyonları. */

/** Kredi paketi satın alma bağlantısı (fiyat yalnızca sunucuda belirlenir). */
export const startAiCreditPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), packageId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { startAiCreditCheckout } = await import("@/lib/ai-credit-checkout.server");
    return startAiCreditCheckout(context.supabase, data, context.userId);
  });

/** Mağaza kredi durumu (rozet ve satın alma penceresi için). */
export const fetchAiCreditStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const credits = await import("@/lib/ai-credits.server");
    const engine = await credits.loadAiEngineSettings();
    return {
      balance: await credits.aiCreditBalance(data.storeId),
      costs: engine.creditCosts,
      engineEnabled: engine.isEnabled,
    };
  });

const engineSchema = z.object({
  isEnabled: z.boolean().optional(),
  modelFast: z.string().trim().min(2).max(60).optional(),
  modelSmart: z.string().trim().min(2).max(60).optional(),
  modelImage: z.string().trim().min(2).max(60).optional(),
  creditCostText: z.number().int().min(0).max(100).optional(),
  creditCostImage: z.number().int().min(0).max(100).optional(),
  creditCostCampaign: z.number().int().min(0).max(100).optional(),
  creditCostCopilot: z.number().int().min(0).max(100).optional(),
  fastInputUsd: z.number().min(0).max(1000).optional(),
  fastOutputUsd: z.number().min(0).max(1000).optional(),
  smartInputUsd: z.number().min(0).max(1000).optional(),
  smartOutputUsd: z.number().min(0).max(1000).optional(),
  imageUnitUsd: z.number().min(0).max(100).optional(),
});

async function adminGuard(supabase: unknown, userId: string) {
  const mod = await import("@/lib/platform-admin.server");
  await mod.assertPlatformAdmin(supabase as never, userId);
}

/** Motor ayarları + finans özeti + anahtar durumu. */
export const fetchAiEngineDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await adminGuard(context.supabase, context.userId);
    const server = await import("@/lib/ai-engine.server");
    return server.aiEngineDesk();
  });

export const saveAiEngineConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => engineSchema.parse(data))
  .handler(async ({ data, context }) => {
    await adminGuard(context.supabase, context.userId);
    const server = await import("@/lib/ai-engine.server");
    return server.saveAiEngineConfig(data, context.userId);
  });

/** OpenAI anahtarının gerçekten çalıştığını sunucuda test eder. */
export const testOpenAiConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await adminGuard(context.supabase, context.userId);
    const server = await import("@/lib/ai-engine.server");
    return server.testOpenAiKey();
  });

/** Yönetici hediye kredisi. */
export const grantAiCreditsToStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), credits: z.number().int().min(1).max(10_000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await adminGuard(context.supabase, context.userId);
    const { grantAiCredits } = await import("@/lib/ai-credits.server");
    const balance = await grantAiCredits({
      storeId: data.storeId,
      credits: data.credits,
      reason: "admin_grant",
      userId: context.userId,
    });
    return { balance };
  });
