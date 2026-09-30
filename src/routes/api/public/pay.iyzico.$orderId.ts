import { createFileRoute } from "@tanstack/react-router";

/**
 * iyzico Checkout Form dönüşü. Gelen token iyzico'dan doğrulanmadan ödeme
 * işlenmez; müşteri her durumda sipariş durumu sayfasına yönlendirilir.
 */
export const Route = createFileRoute("/api/public/pay/iyzico/$orderId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const origin = new URL(request.url).origin;
        const form = await request.formData().catch(() => null);
        const token = String(form?.get("token") ?? "");
        const orderId = params.orderId;
        if (!/^[0-9a-f-]{36}$/i.test(orderId)) return new Response("bad request", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as never as import("@supabase/supabase-js").SupabaseClient<
          import("@/integrations/supabase/types").Database
        >;
        const { data: order } = await db
          .from("orders")
          .select("id, store_id, order_number, customer_email, grand_total, stores(slug)")
          .eq("id", orderId)
          .maybeSingle();
        if (!order) return new Response("not found", { status: 404 });
        const slug = (order.stores as { slug?: string } | null)?.slug ?? "";
        // Müşteri e-postası yönlendirme adresine yazılmaz; müşteri sipariş sayfasında e-postasını girer.
        const back = `${origin}/s/${encodeURIComponent(slug)}/order?no=${encodeURIComponent(order.order_number)}`;

        if (token) {
          const gw = await import("@/lib/store-gateways.server");
          const settings = await gw.loadGatewaySettings(db, order.store_id, "iyzico-pay");
          if (settings) {
            const result = await gw.verifyIyzicoPayment(settings, token, order.id);
            if (result.ok && result.amount + 0.01 >= Number(order.grand_total)) {
              await gw.applyGatewayPayment(db, order.id, "iyzico", result.amount, result.reference);
            }
          }
        }
        // Response.redirect değişmez başlık üretir; güvenlik başlığı eklenince 500 veriyordu.
        return new Response(null, { status: 303, headers: { Location: back } });
      },
    },
  },
});
