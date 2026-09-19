import { createFileRoute } from "@tanstack/react-router";

/**
 * E-posta açılma takibi: 1x1 şeffaf piksel. Token bilinen bir gönderime
 * karşılık gelmezse de aynı piksel döner (bilgi sızdırmamak için).
 */

const PIXEL = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/wcAAwAB/1qN5AAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

function pixelResponse() {
  return new Response(PIXEL, {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store, no-cache, must-revalidate, private",
    },
  });
}

export const Route = createFileRoute("/api/public/email/open/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const token = String(params.token ?? "").replace(/\.png$/i, "");
        if (!/^[a-f0-9]{16,64}$/i.test(token)) return pixelResponse();

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: send } = await supabaseAdmin
            .from("email_sends")
            .select("id, store_id, campaign_id, variant_id, opened_at")
            .eq("token", token)
            .maybeSingle();
          if (!send) return pixelResponse();

          if (!send.opened_at) {
            await supabaseAdmin
              .from("email_sends")
              .update({ opened_at: new Date().toISOString() })
              .eq("id", send.id);
            if (send.variant_id) {
              const { data: variant } = await supabaseAdmin
                .from("email_campaign_variants")
                .select("open_count")
                .eq("id", send.variant_id)
                .maybeSingle();
              await supabaseAdmin
                .from("email_campaign_variants")
                .update({ open_count: (variant?.open_count ?? 0) + 1 })
                .eq("id", send.variant_id);
            }
          }

          await supabaseAdmin.from("email_events").insert({
            store_id: send.store_id,
            campaign_id: send.campaign_id,
            send_id: send.id,
            kind: "open",
            user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
          });
        } catch {
          // Takip hatası e-posta deneyimini bozmamalı.
        }

        return pixelResponse();
      },
    },
  },
});
