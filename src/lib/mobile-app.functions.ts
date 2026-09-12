import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  automationSchema,
  campaignSchema,
  createCampaign,
  loadMobileApp,
  publishConfig,
  saveConfigSchema,
  saveDraftConfig,
  requestBuild,
  storeIdSchema,
  upsertAutomation,
} from "@/lib/mobile-app.server";
import { z } from "zod";

/**
 * Mobil uygulama oluşturucu server function'ları.
 * Yetki `requireSupabaseAuth` + RLS (`app_private.can_manage_store`) ile zorlanır;
 * tüm tasarım JSON'u sunucuda şemaya göre normalize edilir.
 */

export const getMobileApp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => loadMobileApp(context.supabase, data.storeId));

export const saveMobileAppDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => saveConfigSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requirePlanModule } = await import("@/lib/entitlements.server");
    await requirePlanModule(context.supabase as never, data.storeId, "module_mobile_app");
    return saveDraftConfig(context.supabase, data);
  });

export const publishMobileApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => saveConfigSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { requirePlanModule } = await import("@/lib/entitlements.server");
    await requirePlanModule(context.supabase as never, data.storeId, "module_mobile_app");
    return publishConfig(context.supabase, data, context.userId);
  });

export const saveMobilePushAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => automationSchema.parse(data))
  .handler(async ({ data, context }) => upsertAutomation(context.supabase, data));

export const sendMobilePushCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => campaignSchema.parse(data))
  .handler(async ({ data, context }) => createCampaign(context.supabase, data, context.userId));

export const requestMobileAppBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), platform: z.enum(["ios", "android", "both"]) }).parse(data),
  )
  .handler(async ({ data, context }) => requestBuild(context.supabase, data.storeId, data.platform, context.userId));
