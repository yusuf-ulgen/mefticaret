import { createFileRoute } from "@tanstack/react-router";

/**
 * Meta Instagram webhook uç noktası.
 *
 * GET  → hub.challenge doğrulaması (mağazanın verify_token'ı ile)
 * POST → x-hub-signature-256 HMAC doğrulaması, ardından olayları kuyruğa alır.
 *
 * İşleme burada yapılmaz: Meta 10 saniyede yanıt bekler, ağır iş cron
 * worker'ında (`/api/public/cron/instagram-events`) yürütülür.
 */
export const Route = createFileRoute("/api/public/instagram/$storeId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: account } = await supabaseAdmin
          .from("instagram_accounts")
          .select("verify_token")
          .eq("store_id", params.storeId)
          .maybeSingle();

        if (mode === "subscribe" && account?.verify_token && token === account.verify_token) {
          return new Response(challenge ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request, params }) => {
        const rawBody = await request.text();

        const [{ supabaseAdmin }, instagram] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/lib/instagram.server"),
        ]);

        const valid = await instagram.verifyInstagramSignature(
          rawBody,
          request.headers.get("x-hub-signature-256"),
        );
        if (!valid) return new Response("Invalid signature", { status: 401 });

        let body: unknown;
        try {
          body = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { data: account } = await supabaseAdmin
          .from("instagram_accounts")
          .select("id")
          .eq("store_id", params.storeId)
          .maybeSingle();
        if (!account) return new Response("Not found", { status: 404 });

        try {
          const events = instagram.parseWebhookPayload(body);
          const queued = await instagram.enqueueInstagramEvents(
            supabaseAdmin,
            params.storeId,
            events,
          );
          return Response.json({ ok: true, queued });
        } catch (cause) {
          // Meta yeniden denemesin diye 200 döner; hata kuyruk kaydında izlenir.
          return Response.json({
            ok: false,
            error: cause instanceof Error ? cause.message : "unknown_error",
          });
        }
      },
    },
  },
});
