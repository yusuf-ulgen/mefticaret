import { createFileRoute } from "@tanstack/react-router";

import { EventName, verifyWebhook, type PaddleEnv } from "@/lib/paddle.server";

/**
 * Ödeme sağlayıcısı (Paddle) webhook ucu.
 * Güvenlik: her istekte sağlayıcı imzası doğrulanır; oturum/JWT kullanılmaz.
 */

async function handle(request: Request, env: PaddleEnv): Promise<void> {
  const event = await verifyWebhook(request, env);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { applySubscriptionEvent, recordCompletedTransaction } = await import(
    "@/lib/paddle-subscriptions.server"
  );

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionUpdated:
    case EventName.SubscriptionActivated:
    case EventName.SubscriptionCanceled:
    case EventName.SubscriptionPastDue:
      await applySubscriptionEvent(supabaseAdmin as never, env, event.data as never);
      break;
    case EventName.TransactionCompleted:
      await recordCompletedTransaction(supabaseAdmin as never, env, event.data as never);
      break;
    default:
      break;
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const env = (new URL(request.url).searchParams.get("env") ?? "sandbox") as PaddleEnv;
        try {
          await handle(request, env);
          return Response.json({ received: true });
        } catch (error) {
          console.error("Paddle webhook error", error);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
