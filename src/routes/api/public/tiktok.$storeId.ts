import { createFileRoute } from "@tanstack/react-router";

/**
 * TikTok webhook uç noktası.
 *
 * GET  → TikTok abonelik doğrulaması (mağazanın verify_token'ı ile challenge yankılanır)
 * POST → `TikTok-Signature` HMAC doğrulaması, ardından olayları kuyruğa alır.
 *
 * İşleme burada yapılmaz: TikTok hızlı yanıt bekler, ağır iş cron worker'ında
 * (`/api/public/cron/tiktok-events`) yürütülür.
 */
export const Route = createFileRoute("/api/public/tiktok/$storeId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("verify_token") ?? url.searchParams.get("token");
        const challenge = url.searchParams.get("challenge") ?? url.searchParams.get("hub.challenge");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: account } = await supabaseAdmin
          .from("tiktok_accounts")
          .select("verify_token")
          .eq("store_id", params.storeId)
          .maybeSingle();

        if (account?.verify_token && token === account.verify_token) {
          return new Response(challenge ?? "ok", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request, params }) => {
        const rawBody = await request.text();

        const [{ supabaseAdmin }, tiktok] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/lib/tiktok.server"),
        ]);

        const valid = await tiktok.verifyTiktokSignature(
          rawBody,
          request.headers.get("tiktok-signature"),
        );
        if (!valid) return new Response("Invalid signature", { status: 401 });

        let body: unknown;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { data: account } = await supabaseAdmin
          .from("tiktok_accounts")
          .select("id")
          .eq("store_id", params.storeId)
          .maybeSingle();
        if (!account) return new Response("Not found", { status: 404 });

        try {
          const events = tiktok.parseTiktokWebhookPayload(body);
          const queued = await tiktok.enqueueTiktokEvents(supabaseAdmin, params.storeId, events);
          return Response.json({ ok: true, queued });
        } catch (cause) {
          // TikTok yeniden denemesin diye 200 döner; hata kuyruk kaydında izlenir.
          return Response.json({
            ok: false,
            error: cause instanceof Error ? cause.message : "unknown_error",
          });
        }
      },
    },
  },
});
