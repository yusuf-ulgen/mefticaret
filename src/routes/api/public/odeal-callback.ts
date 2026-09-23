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

        // Bildirim yalnızca tetikleyicidir; kayda geçen her alan Ödeal'in
        // doğrulama yanıtından gelir, çağırandan gelen alanlar yazılmaz.
        let verified: Awaited<ReturnType<typeof checkPaymentStatus>>;
        try {
          verified = await checkPaymentStatus({
            id: providerId ?? payment.provider_payment_id,
            externalId,
          });
        } catch {
          return new Response("ok");
        }
        const status = verified.status;
        const verifiedRecord = verified as unknown as Record<string, unknown>;
        const verifiedId = verifiedRecord["id"] != null ? String(verifiedRecord["id"]) : null;
        const verifiedUniqueKey =
          typeof verifiedRecord["uniqueKey"] === "string" ? (verifiedRecord["uniqueKey"] as string) : null;
        const verifiedReason =
          typeof verifiedRecord["reason"] === "string" ? (verifiedRecord["reason"] as string) : null;

        await supabaseAdmin
          .from("invoice_payments")
          .update({
            status,
            provider_payment_id: verifiedId ?? payment.provider_payment_id,
            unique_key: verifiedUniqueKey,
            reason: verifiedReason,
            raw_callback: verifiedRecord as never,
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
