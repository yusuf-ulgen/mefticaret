import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

/**
 * Vitrin kampanya ölçümü (oturum gerektirmez).
 * Anonim istemciler artık tabloya doğrudan yazmaz; olay burada doğrulanır,
 * IP + mağaza bazlı hız sınırına tabidir ve servis rolü istemcisiyle kaydedilir.
 */
export const trackStorefrontCampaignEvent = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        campaignId: z.string().uuid(),
        kind: z.enum(["view", "click"]),
        sessionId: z.string().trim().max(64).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { consumeRateLimit, clientIp, RATE_LIMITS } = await import("@/lib/rate-limit.server");
    const ip = clientIp(getRequest());
    const limit = await consumeRateLimit(
      `campaign-event:${data.storeId}:${ip}`,
      RATE_LIMITS.public_form,
    );
    if (!limit.allowed) return { ok: false as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Kampanya gerçekten bu mağazaya ait ve vitrinde yayında mı?
    const { data: campaign } = await supabaseAdmin
      .from("email_campaigns")
      .select("id, store_id, storefront_enabled, stores!inner(status)")
      .eq("id", data.campaignId)
      .eq("store_id", data.storeId)
      .maybeSingle();

    const storeStatus = (campaign as unknown as { stores?: { status?: string } } | null)?.stores
      ?.status;
    if (!campaign || !campaign.storefront_enabled || storeStatus !== "active") {
      return { ok: false as const };
    }

    await supabaseAdmin.from("campaign_storefront_events").insert({
      store_id: data.storeId,
      campaign_id: data.campaignId,
      kind: data.kind,
      session_id: data.sessionId ?? null,
    } as never);

    return { ok: true as const };
  });
