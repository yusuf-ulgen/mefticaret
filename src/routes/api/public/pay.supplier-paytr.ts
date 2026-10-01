import { createFileRoute } from "@tanstack/react-router";

/**
 * Tedarikçinin PayTR hesabından gelen ödeme bildirimi. İmza, tedarikçinin
 * kendi PayTR anahtarlarıyla doğrulanmadan hiçbir işlem yapılmaz.
 * Tedarikçi PayTR panelinde bildirim adresi olarak bu adresi girer.
 */
export const Route = createFileRoute("/api/public/pay/supplier-paytr")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData().catch(() => null);
        const p = {
          merchant_oid: String(form?.get("merchant_oid") ?? ""),
          status: String(form?.get("status") ?? ""),
          total_amount: String(form?.get("total_amount") ?? ""),
          hash: String(form?.get("hash") ?? ""),
        };
        const gw = await import("@/lib/store-gateways.server");
        const poId = gw.orderIdFromPaytrOid(p.merchant_oid);
        if (!poId || !p.hash) return new Response("bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as never as { from: (t: string) => any };
        const { data: po } = await db.from("purchase_orders").select("id, supplier_id").eq("id", poId).maybeSingle();
        if (!po?.supplier_id) return new Response("OK");
        const lib = await import("@/lib/supplier-workflow.server");
        const pay = await lib.loadSupplierPaymentSettings(db, po.supplier_id);
        if (!pay || pay.provider !== "paytr" || !gw.verifyPaytrHash(pay.settings, p)) {
          return new Response("invalid hash", { status: 401 });
        }
        if (p.status === "success") {
          const [order] = await lib.loadPurchaseOrders(db, { ids: [po.id] }, 1);
          const amount = Number(p.total_amount) / 100;
          if (order && amount + 0.01 >= order.total) {
            await lib.applyPurchaseOrderPayment(db, po.id, "paytr", amount, p.merchant_oid);
          }
        } else {
          await db.from("purchase_orders").update({ payment_status: "unpaid" }).eq("id", po.id).neq("payment_status", "paid");
        }
        return new Response("OK");
      },
    },
  },
});
