import { createFileRoute } from "@tanstack/react-router";

/**
 * Ödeal ödeme sonucu bildirimi (callback).
 * Gelen veriye güvenilmez: statü her zaman Ödeal'in check-status servisinden doğrulanır.
 * Mükerrer bildirimler externalId üzerinden idempotent işlenir.
 */
export const Route = createFileRoute("/api/public/odeal-callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: Record<string, unknown> = {};
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const externalId = typeof payload["externalId"] === "string" ? payload["externalId"] : null;
        const providerId = payload["id"] != null ? String(payload["id"]) : null;
        if (!externalId) return new Response("Bad request", { status: 400 });

        const [{ supabaseAdmin }, { checkPaymentStatus }, { restoreAfterPayment }] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/lib/odeal.server"),
          import("@/lib/billing-lifecycle.server"),
        ]);

        const { data: payment } = await supabaseAdmin
          .from("invoice_payments")
          .select("id, invoice_id, store_id, status, provider_payment_id")
          .eq("external_id", externalId)
          .maybeSingle();
        if (!payment) return new Response("ok");
        if (payment.status === "COMPLETED") return new Response("ok");

        let status = "PENDING";
        try {
          const verified = await checkPaymentStatus({
            id: providerId ?? payment.provider_payment_id,
            externalId,
          });
          status = verified.status;
        } catch {
          return new Response("ok");
        }

        await supabaseAdmin
          .from("invoice_payments")
          .update({
            status,
            provider_payment_id: providerId ?? payment.provider_payment_id,
            unique_key: typeof payload["uniqueKey"] === "string" ? payload["uniqueKey"] : null,
            reason: typeof payload["reason"] === "string" ? payload["reason"] : null,
            raw_callback: payload as never,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id);

        if (status === "COMPLETED") {
          await supabaseAdmin
            .from("invoices")
            .update({ status: "paid", paid_at: new Date().toISOString() })
            .eq("id", payment.invoice_id)
            .neq("status", "paid");
          await restoreAfterPayment(supabaseAdmin, payment.store_id);
        }

        return new Response("ok");
      },
    },
  },
});
