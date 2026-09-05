import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * TikTok olay kuyruğu worker'ı: bekleyen webhook olaylarını işler
 * (yorum/canlı yayın → DM kural motoru, gelen DM kaydı, otonom AI yanıtı).
 * Yalnızca LOVABLE_CRON_SECRET ile çağrılabilir.
 */
export const Route = createFileRoute("/api/public/cron/tiktok-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const [{ supabaseAdmin }, { processTiktokEvents }] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/lib/tiktok.server"),
        ]);

        try {
          const result = await processTiktokEvents(supabaseAdmin, 25);
          return Response.json({ ok: true, ...result });
        } catch (cause) {
          return Response.json(
            { error: cause instanceof Error ? cause.message : "unknown_error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
