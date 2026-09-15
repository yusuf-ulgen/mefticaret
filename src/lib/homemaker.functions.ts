import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Kolay Panel'e özel sunucu işlemleri.
 * Kargo/teslim kodu sunucuda üretilir; istemciden gelen koda güvenilmez.
 */

const ALPHABET = "ACDEFGHJKLMNPRTUVWXYZ2346789";

function generateCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
  return `MEF-${body.slice(0, 4)}-${body.slice(4, 8)}`;
}

/**
 * Kağıtsız teslim kodu üretir: siparişe yazılır, sevkiyat kaydı açılır ve
 * sipariş "kargolandı" durumuna geçer. Yetki RLS ile doğrulanır.
 */
export const createPickupCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, store_id, order_number, tracking_number")
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Sipariş bulunamadı veya yetkiniz yok");

    const code = order.tracking_number || generateCode();
    const carrier = "Mefticaret Kodlu Teslim";

    const { data: updated, error } = await supabase
      .from("orders")
      .update({
        tracking_number: code,
        shipping_carrier: carrier,
        status: "shipped",
        fulfillment_status: "fulfilled",
      } as never)
      .eq("id", order.id)
      .select("id, tracking_number, status")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Bu siparişi güncelleme yetkiniz yok");

    await supabase.from("shipments").insert({
      store_id: order.store_id,
      order_id: order.id,
      carrier,
      tracking_number: code,
      status: "in_transit",
      shipped_at: new Date().toISOString(),
    } as never);

    await supabase.from("order_events").insert({
      order_id: order.id,
      store_id: order.store_id,
      actor_id: userId,
      kind: "status",
      message: `Teslim kodu oluşturuldu: ${code}`,
    } as never);

    return { code, carrier };
  });
