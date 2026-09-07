import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Zamanlanmış görev: abonelik yenileme hatırlatıcıları (7/3/1 gün) ve
 * ödemesi gecikmiş mağazalar için kademeli kısıtlama.
 * Yalnızca LOVABLE_CRON_SECRET ile çağrılabilir.
 */
export const Route = createFileRoute("/api/public/cron/subscription-renewal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const [{ supabaseAdmin }, { processBillingLifecycle }] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/lib/billing-lifecycle.server"),
        ]);

        try {
          const result = await processBillingLifecycle(supabaseAdmin);
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
