import { createFileRoute } from "@tanstack/react-router";

/**
 * PayTR ödeme bildirimi (Bildirim URL). Satıcı bu adresi PayTR panelinde
 * tanımlar. İmza mağazanın merchant_key/merchant_salt değerleriyle doğrulanır;
 * PayTR yanıt olarak düz "OK" bekler.
 */
export const Route = createFileRoute("/api/public/pay/paytr/$storeId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const form = await request.formData().catch(() => null);
        const p = {
          merchant_oid: String(form?.get("merchant_oid") ?? ""),
          status: String(form?.get("status") ?? ""),
          total_amount: String(form?.get("total_amount") ?? ""),
          hash: String(form?.get("hash") ?? ""),
        };
        if (!/^[0-9a-f-]{36}$/i.test(params.storeId) || !p.merchant_oid || !p.hash) {
          return new Response("bad request", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as never as import("@supabase/supabase-js").SupabaseClient<
          import("@/integrations/supabase/types").Database
        >;
        const gw = await import("@/lib/store-gateways.server");
        const settings = await gw.loadGatewaySettings(db, params.storeId, "paytr-pay");
        if (!settings || !gw.verifyPaytrHash(settings, p)) {
          return new Response("PAYTR notification failed: bad hash", { status: 400 });
        }

        const orderId = gw.orderIdFromPaytrOid(p.merchant_oid);
        if (orderId && p.status === "success") {
          const { data: order } = await db
            .from("orders")
            .select("id, store_id, grand_total")
            .eq("id", orderId)
            .maybeSingle();
          const amount = Number(p.total_amount) / 100;
          if (order && order.store_id === params.storeId && amount + 0.01 >= Number(order.grand_total)) {
            await gw.applyGatewayPayment(db, order.id, "paytr", amount, p.merchant_oid);
          }
        }
        return new Response("OK", { headers: { "Content-Type": "text/plain" } });
      },
    },
  },
});
