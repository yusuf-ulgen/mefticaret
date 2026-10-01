import { createFileRoute } from "@tanstack/react-router";

/**
 * Tedarikçi satın alma siparişi iyzico dönüşü. Token, tedarikçinin kendi
 * iyzico hesabından doğrulanmadan ödeme işlenmez.
 */
export const Route = createFileRoute("/api/public/pay/supplier-iyzico/$poId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const origin = new URL(request.url).origin;
        const poId = params.poId;
        if (!/^[0-9a-f-]{36}$/i.test(poId)) return new Response("bad request", { status: 400 });
        const form = await request.formData().catch(() => null);
        const token = String(form?.get("token") ?? "");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as never as { from: (t: string) => any };
        const { data: po } = await db.from("purchase_orders").select("id, store_id, supplier_id").eq("id", poId).maybeSingle();
        if (!po) return new Response("not found", { status: 404 });

        if (token && po.supplier_id) {
          const lib = await import("@/lib/supplier-workflow.server");
          const pay = await lib.loadSupplierPaymentSettings(db, po.supplier_id);
          if (pay?.provider === "iyzico") {
            const [order] = await lib.loadPurchaseOrders(db, { ids: [po.id] }, 1);
            const gw = await import("@/lib/store-gateways.server");
            const result = await gw.verifyIyzicoPayment(pay.settings, token, po.id);
            if (order && result.ok && result.amount + 0.01 >= order.total) {
              await lib.applyPurchaseOrderPayment(db, po.id, "iyzico", result.amount, result.reference);
            }
          }
        }
        return new Response(null, {
          status: 303,
          headers: { Location: `${origin}/store/${po.store_id}/purchasing?po=${po.id}` },
        });
      },
    },
  },
});
