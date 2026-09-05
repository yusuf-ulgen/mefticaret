import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Facebook Marketplace otomatik eşitleme worker'ı: eşitleme zamanı gelen
 * mağazaların ürünlerini Item API ile günceller.
 * Yalnızca LOVABLE_CRON_SECRET ile çağrılabilir.
 */
export const Route = createFileRoute("/api/public/cron/fb-marketplace-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const [{ supabaseAdmin }, { runDueMarketplaceSyncs }] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/lib/facebook-marketplace.server"),
        ]);

        try {
          const result = await runDueMarketplaceSyncs(supabaseAdmin, 10);
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
