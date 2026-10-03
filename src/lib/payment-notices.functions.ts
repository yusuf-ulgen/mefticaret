import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ödeme Bildirimleri: havale/EFT ile ödeme bekleyen siparişlerin satıcı
 * tarafından onaylanması veya reddedilmesi. Yazma, oturum açmış personelin
 * RLS bağlamında yapılır; başka mağazanın siparişine dokunulamaz.
 */
const schema = z.object({
  storeId: z.guid(),
  orderId: z.guid(),
  action: z.enum(["confirm", "reject"]),
});

export const resolvePaymentNoticeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, status, payment_status")
      .eq("id", data.orderId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Sipariş bulunamadı.");
    if (order.payment_status !== "pending") throw new Error("Bu siparişin ödemesi zaten işlenmiş.");

    const patch =
      data.action === "confirm"
        ? {
            payment_status: "paid" as const,
            status: order.status === "pending" || order.status === "awaiting_payment" ? ("paid" as const) : order.status,
          }
        : { payment_status: "failed" as const };

    const { error: updateError } = await supabase
      .from("orders")
      .update(patch)
      .eq("id", order.id)
      .eq("store_id", data.storeId);
    if (updateError) throw new Error(updateError.message);

    await supabase.from("order_events").insert({
      order_id: order.id,
      store_id: data.storeId,
      kind: data.action === "confirm" ? "payment_confirmed" : "payment_rejected",
      message: data.action === "confirm" ? "Havale/EFT ödemesi satıcı tarafından onaylandı" : "Ödeme bildirimi reddedildi",
      meta: { source: "payment_notices" },
    });
    return { ok: true };
  });
