import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Zamanlanmış tedarikçi besleme senkronizasyonu (XML / CSV / API).
 * `next_run_at` zamanı gelmiş aktif beslemeleri sırayla çalıştırır.
 * Yalnızca LOVABLE_CRON_SECRET ile çağrılabilir.
 */
export const Route = createFileRoute("/api/public/cron/feed-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runSupplierFeed } = await import("@/lib/dropshipping.server");

        const { data: feeds, error } = await supabaseAdmin
          .from("supplier_feeds")
          .select("*")
          .eq("is_active", true)
          .neq("schedule", "manual")
          .not("next_run_at", "is", null)
          .lte("next_run_at", new Date().toISOString())
          .limit(25);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const results: { feedId: string; ok: boolean; error?: string }[] = [];
        for (const feed of feeds ?? []) {
          try {
            await runSupplierFeed(supabaseAdmin as never, feed as never, "scheduled");
            results.push({ feedId: feed.id, ok: true });
          } catch (err) {
            results.push({
              feedId: feed.id,
              ok: false,
              error: err instanceof Error ? err.message : "bilinmeyen hata",
            });
          }
        }

        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});
