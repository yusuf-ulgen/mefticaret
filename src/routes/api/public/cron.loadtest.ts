import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Otomatik stres testi orkestratörü.
 * Aktif turu bir adım ilerletir; tur bitince sonraki turu (varsayılan 3 saat)
 * planlar. Yalnızca LOVABLE_CRON_SECRET ile çağrılabilir.
 */
export const Route = createFileRoute("/api/public/cron/loadtest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { advanceLoadTestCycle } = await import("@/lib/loadtest.server");
        try {
          const result = await advanceLoadTestCycle(request);
          return Response.json({ ok: true, ...result });
        } catch (error) {
          const message = error instanceof Error ? error.message : "bilinmeyen hata";
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
