import { createFileRoute } from "@tanstack/react-router";

/**
 * WhatsApp Business Cloud API webhook'u.
 * GET  → Meta doğrulama (hub.challenge), mağazanın verify_token'ı ile eşleşmeli.
 * POST → gelen mesajlar ve durum güncellemeleri.
 */
export const Route = createFileRoute("/api/public/whatsapp/$storeId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: account } = await supabaseAdmin
          .from("whatsapp_accounts")
          .select("verify_token")
          .eq("store_id", params.storeId)
          .maybeSingle();

        if (mode !== "subscribe" || !account || !token || token !== account.verify_token) {
          return new Response("Forbidden", { status: 403 });
        }
        return new Response(challenge ?? "", { status: 200 });
      },

      POST: async ({ request, params }) => {
        const raw = await request.text();

        // Meta imza doğrulaması (X-Hub-Signature-256). İmza doğrulanmadan hiçbir
        // yük işlenmez; böylece sahte mesaj/durum enjeksiyonu engellenir.
        const appSecret = process.env["WHATSAPP_APP_SECRET"];
        if (!appSecret) {
          return new Response("Webhook not configured", { status: 503 });
        }

        const header = request.headers.get("x-hub-signature-256") ?? "";
        const { createHmac, timingSafeEqual } = await import("crypto");
        const expected = `sha256=${createHmac("sha256", appSecret).update(raw, "utf8").digest("hex")}`;
        const got = Buffer.from(header);
        const want = Buffer.from(expected);
        if (got.length !== want.length || !timingSafeEqual(got, want)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: any;
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad request", { status: 400 });
        }


        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: account } = await supabaseAdmin
          .from("whatsapp_accounts")
          .select("phone_number_id")
          .eq("store_id", params.storeId)
          .maybeSingle();
        if (!account) return new Response("Not found", { status: 404 });

        const { handleInboundMessage, applyStatusUpdate } = await import("@/lib/whatsapp.server");

        try {
          for (const entry of payload?.entry ?? []) {
            for (const change of entry?.changes ?? []) {
              const value = change?.value ?? {};
              if (value?.metadata?.phone_number_id && value.metadata.phone_number_id !== account.phone_number_id) {
                continue;
              }

              const contactName = value?.contacts?.[0]?.profile?.name ?? null;

              for (const message of value?.messages ?? []) {
                await handleInboundMessage(supabaseAdmin, params.storeId, {
                  waId: message?.from ?? "",
                  contactName,
                  body:
                    message?.text?.body ??
                    message?.button?.text ??
                    message?.interactive?.button_reply?.title ??
                    `[${message?.type ?? "mesaj"}]`,
                  waMessageId: message?.id ?? null,
                  type: message?.type ?? "text",
                });
              }

              for (const status of value?.statuses ?? []) {
                if (status?.id && status?.status) {
                  await applyStatusUpdate(supabaseAdmin, params.storeId, status.id, status.status);
                }
              }
            }
          }
        } catch (cause) {
          return Response.json(
            { error: cause instanceof Error ? cause.message : "unknown_error" },
            { status: 500 },
          );
        }

        return Response.json({ ok: true });
      },
    },
  },
});
