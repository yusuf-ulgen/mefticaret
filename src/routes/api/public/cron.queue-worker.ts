import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Arka plan iş kuyruğu worker'ı: zamanı gelmiş işleri atomik olarak kilitler ve
 * yürütür. Ağır işler böylece kullanıcı isteğinin dışında çalışır.
 * Yalnızca LOVABLE_CRON_SECRET ile çağrılabilir.
 */
export const Route = createFileRoute("/api/public/cron/queue-worker")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const [{ supabaseAdmin }, { processQueue }] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/lib/queue.server"),
        ]);

        try {
          const result = await processQueue(supabaseAdmin, { limit: 20 });
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
