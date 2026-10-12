import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Zamanlanmış görev: bekleyen/yolda olan Aras Kargo gönderilerinin durumunu sorgular,
 * takip numarası ve teslim bilgisini günceller. Yalnızca LOVABLE_CRON_SECRET ile çağrılabilir.
 */
export const Route = createFileRoute("/api/public/cron/aras-tracking")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { syncActiveShipments } = await import("@/lib/shipment-tracking.server");
          const result = await syncActiveShipments(supabaseAdmin as never, { limit: 100 });
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
