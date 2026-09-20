import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Oyunlaştırma sunucu uçları (mantık gamification.server.ts içinde). */

const storeId = z.guid();

const prizeSchema = z.object({
  label: z.string().trim().min(1).max(60),
  value: z.number().min(0).max(100000),
  weight: z.number().min(1).max(1000),
});

export const fetchGamificationCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId }).parse(data))
  .handler(async ({ data, context }) => {
    const { listGamificationCampaigns } = await import("@/lib/gamification.server");
    return listGamificationCampaigns(context.supabase, data.storeId);
  });

export const saveGamificationCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId,
        id: z.guid().nullish(),
        kind: z.enum(["spin_wheel", "scratch_card"]),
        name: z.string().trim().min(2).max(120),
        isActive: z.boolean(),
        headline: z.string().trim().min(2).max(120),
        ctaLabel: z.string().trim().min(1).max(40),
        prizes: z.array(prizeSchema).min(2).max(12),
        discountType: z.enum(["percent", "amount"]),
        codePrefix: z.string().trim().min(2).max(8),
        codeValidDays: z.number().int().min(1).max(365),
        maxPlaysPerEmail: z.number().int().min(1).max(10),
        showDelaySeconds: z.number().int().min(0).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { saveGamificationCampaign } = await import("@/lib/gamification.server");
    const { storeId: store, ...input } = data;
    return saveGamificationCampaign({
      client: context.supabase,
      storeId: store,
      userId: context.userId,
      input,
    });
  });

export const deleteGamificationCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId, id: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { deleteGamificationCampaign } = await import("@/lib/gamification.server");
    return deleteGamificationCampaign({
      client: context.supabase,
      storeId: data.storeId,
      userId: context.userId,
      id: data.id,
    });
  });

/** Vitrin: aktif kampanya bilgisi (ödül olasılıkları gizli). */
export const fetchStorefrontGame = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ storeSlug: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getActiveGamificationCampaign } = await import("@/lib/gamification.server");
    return getActiveGamificationCampaign(supabaseAdmin as never, data.storeSlug);
  });

/** Vitrin: ödülü sunucuda çeker, indirim kodunu üretir. Hız sınırlıdır. */
export const playStorefrontGame = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        storeSlug: z.string().trim().min(1).max(120),
        campaignId: z.guid(),
        email: z.string().trim().email().max(180),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { consumeRateLimit, clientIp, RATE_LIMITS, recordSecurityEvent } = await import(
      "@/lib/rate-limit.server"
    );
    const { getRequest } = await import("@tanstack/react-start/server");
    const request = getRequest();
    const ip = clientIp(request);
    const limit = await consumeRateLimit(`gamification:${data.storeSlug}:${ip}`, RATE_LIMITS.public_form);
    if (!limit.allowed) {
      await recordSecurityEvent({
        kind: "gamification_play_rate_limited",
        severity: "warning",
        request,
        meta: { slug: data.storeSlug },
      });
      throw new Error("Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { playGamification } = await import("@/lib/gamification.server");
    return playGamification({
      client: supabaseAdmin as never,
      storeSlug: data.storeSlug,
      campaignId: data.campaignId,
      email: data.email,
    });
  });
