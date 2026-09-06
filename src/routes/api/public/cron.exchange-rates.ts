import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Zamanlanmış görev: kur güncelleme. Sıklık parametresi ile saatlik / 6 saatlik /
 * günlük mağazalar toplu güncellenir. Yalnızca LOVABLE_CRON_SECRET ile çağrılabilir.
 */
export const Route = createFileRoute("/api/public/cron/exchange-rates")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const url = new URL(request.url);
        const requested = (url.searchParams.get("frequency") ?? "hourly,six_hourly,daily")
          .split(",")
          .map((value) => value.trim());
        const allowed = ["hourly", "six_hourly", "daily"] as const;
        const frequencies = allowed.filter((value) => requested.includes(value));
        if (frequencies.length === 0) {
          return Response.json({ error: "Geçersiz frequency değeri" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncDueStores } = await import("@/lib/exchange-rates.server");

        try {
          const result = await syncDueStores(supabaseAdmin, [...frequencies]);
          return Response.json({
            ok: true,
            frequencies,
            stores: result.stores,
            updated: result.results.reduce((sum, row) => sum + row.updated.length, 0),
            failedOver: result.results.filter((row) => row.failedOver).length,
          });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "Kur güncellemesi başarısız" },
            { status: 500 },
          );
        }
      },
    },
  },
});
