import { createFileRoute } from "@tanstack/react-router";

import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Hızlı indeksleme tetikleyicisi: tüm pazarlama sayfaları ve yayınlanmış mağaza
 * vitrin adreslerini IndexNow (Bing, Yandex, Seznam) uçlarına bildirir.
 * Yalnızca LOVABLE_CRON_SECRET ile çağrılabilir.
 */
export const Route = createFileRoute("/api/public/indexnow")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const url = new URL(request.url);
        const forwarded =
          url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
        const origin = forwarded ? `https://${forwarded}` : url.origin;

        const { submitToIndexNow } = await import("@/lib/indexnow.server");
        try {
          const result = await submitToIndexNow(origin);
          return Response.json({ ok: true, ...result });
        } catch (error) {
          return Response.json(
            { error: error instanceof Error ? error.message : "indexnow hatası" },
            { status: 500 },
          );
        }
      },
    },
  },
});
