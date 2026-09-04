import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Günlük otomatik SEO AI turu: aktif mağazaları denetler, güvenli düzeltmeleri
 * uygular ve eksik meta verileri gerçek katalog/blog verisine dayanarak üretir.
 * Yalnızca LOVABLE_CRON_SECRET ile çağrılabilir.
 */
export const Route = createFileRoute("/api/public/cron/seo-ai")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const { runSeoAiCycle } = await import("@/lib/seo-ai.server");
        try {
          const result = await runSeoAiCycle({ trigger: "cron" });
          return Response.json({ ok: true, ...result });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "seo ai hatası" },
            { status: 500 },
          );
        }
      },
    },
  },
});
