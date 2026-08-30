import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Zamanlanmış görev: her mağaza için günlük ciro/sipariş/müşteri istatistiklerini
 * toplar (store_daily_stats) ve uzun süredir dokunulmamış sepetleri bildirir.
 * Yalnızca LOVABLE_CRON_SECRET taşıyan çağrılar kabul edilir.
 */
export const Route = createFileRoute("/api/public/cron/daily-rollup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const today = new Date();
        const day = today.toISOString().slice(0, 10);
        const dayStart = `${day}T00:00:00.000Z`;
        const dayEnd = `${day}T23:59:59.999Z`;

        const { data: stores, error: storesError } = await supabaseAdmin
          .from("stores")
          .select("id")
          .in("status", ["active", "draft"]);
        if (storesError) {
          return Response.json({ error: storesError.message }, { status: 500 });
        }

        let processed = 0;

        for (const store of stores ?? []) {
          const [orders, customers, carts] = await Promise.all([
            supabaseAdmin
              .from("orders")
              .select("grand_total")
              .eq("store_id", store.id)
              .gte("placed_at", dayStart)
              .lte("placed_at", dayEnd),
            supabaseAdmin
              .from("customers")
              .select("id")
              .eq("store_id", store.id)
              .gte("created_at", dayStart)
              .lte("created_at", dayEnd),
            supabaseAdmin
              .from("abandoned_carts")
              .select("id")
              .eq("store_id", store.id)
              .is("recovered_order_id", null)
              .gte("last_seen_at", dayStart)
              .lte("last_seen_at", dayEnd),
          ]);

          if (orders.error || customers.error || carts.error) continue;

          const revenue = (orders.data ?? []).reduce(
            (sum, row) => sum + Number(row.grand_total ?? 0),
            0,
          );
          const ordersCount = (orders.data ?? []).length;

          const { error: upsertError } = await supabaseAdmin
            .from("store_daily_stats")
            .upsert(
              {
                store_id: store.id,
                stat_date: day,
                revenue,
                orders_count: ordersCount,
                new_customers: (customers.data ?? []).length,
                abandoned_carts: (carts.data ?? []).length,
              },
              { onConflict: "store_id,stat_date" },
            );
          if (upsertError) continue;

          processed += 1;
        }

        return Response.json({ ok: true, day, stores: processed });
      },
    },
  },
});
