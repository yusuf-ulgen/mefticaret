import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Zamanlanmış görev tetikleyicisi: günlük mağaza istatistiklerini (ciro, sipariş,
 * yeni müşteri, terk edilmiş sepet) yeniden hesaplar. Saat başı çalışan pg_cron
 * görevinin manuel/harici muadili — yalnızca LOVABLE_CRON_SECRET ile çağrılabilir.
 */
export const Route = createFileRoute("/api/public/cron/daily-rollup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const day = new Date().toISOString().slice(0, 10);

        const { data, error } = await supabaseAdmin.rpc("rollup_store_daily_stats", {
          target_day: day,
        });
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json({ ok: true, day, stores: data ?? 0 });
      },
    },
  },
});
