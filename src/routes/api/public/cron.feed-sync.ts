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

        const { runExportFeed } = await import("@/lib/xml-export.server");
        const origin = new URL(request.url).origin;
        const storeCache = new Map<string, { name: string; slug: string; currency: string | null } | null>();

        const results: { feedId: string; ok: boolean; error?: string }[] = [];
        for (const feed of feeds ?? []) {
          try {
            const row = feed as Record<string, any>;
            if (row["direction"] === "export") {
              const storeId = String(row["store_id"]);
              if (!storeCache.has(storeId)) {
                const { data: store } = await supabaseAdmin
                  .from("stores")
                  .select("name, slug, currency")
                  .eq("id", storeId)
                  .maybeSingle();
                storeCache.set(storeId, (store as never) ?? null);
              }
              const store = storeCache.get(storeId);
              if (!store) throw new Error("Mağaza bulunamadı");
              await runExportFeed(
                supabaseAdmin as never,
                feed as never,
                {
                  storeName: store.name,
                  storeSlug: store.slug,
                  storeCurrency: store.currency ?? "TRY",
                  origin,
                },
                "scheduled",
              );
            } else {
              await runSupplierFeed(supabaseAdmin as never, feed as never, "scheduled");
            }
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
