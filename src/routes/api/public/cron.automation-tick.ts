import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Zamanlanmış görev: bekleme süresi dolmuş otomasyon adımlarını ilerletir.
 * Yalnızca LOVABLE_CRON_SECRET ile çağrılabilir.
 */
export const Route = createFileRoute("/api/public/cron/automation-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const [{ supabaseAdmin }, { processDueRuns }] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/lib/automation-engine.server"),
        ]);

        try {
          const result = await processDueRuns(supabaseAdmin, 100);
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
