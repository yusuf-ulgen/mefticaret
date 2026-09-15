import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Aras Kargo gönderi işlemleri. Yetki RLS ile doğrulanır; kimlik bilgileri
 * yalnızca sunucuda okunur, istemciden gelen takip numarasına güvenilmez.
 */

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** Siparişi Aras Kargo'ya gönderir ve sevkiyat kaydı açar. */
export const sendOrderToAras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ orderId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, store_id, order_number, customer_name, customer_phone, shipping_address, grand_total, currency, payment_status, order_items(id, title, quantity)",
      )
      .eq("id", data.orderId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (!order) throw new Error("Sipariş bulunamadı veya yetkiniz yok");

    const address = (order.shipping_address ?? {}) as Record<string, unknown>;
    const receiverName = text(address["full_name"]) || text(order.customer_name);
    const line = [text(address["line1"]), text(address["line2"])].filter(Boolean).join(" ");
    const city = text(address["city"]);
    const town = text(address["district"]) || text(address["state"]) || city;
    const phone = (text(address["phone"]) || text(order.customer_phone)).replace(/\D/g, "");

    if (!receiverName) throw new Error("Alıcı adı eksik. Sipariş bilgilerini tamamlayın.");
    if (!line || !city) throw new Error("Teslimat adresi eksik. Adres ve şehir zorunludur.");
    if (phone.length < 10) throw new Error("Alıcı telefonu eksik veya geçersiz.");

    const { data: existing } = await supabase
      .from("shipments")
      .select("id, tracking_number, note, status")
      .eq("order_id", order.id)
      .eq("carrier", "Aras Kargo")
      .maybeSingle();
    if (existing) {
      throw new Error("Bu sipariş için zaten bir Aras Kargo gönderisi var.");
    }

    const integrationCode = `MEF${order.order_number}`.replace(/[^A-Za-z0-9-]/g, "").slice(0, 40);
    const pieceCount = Math.max(
      1,
      (order.order_items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0),
    );
    const description = (order.order_items ?? [])
      .map((item) => `${item.quantity} x ${item.title}`)
      .join(", ")
      .slice(0, 200);

    const { createArasOrder, arasTrackingUrl, ARAS_CARRIER } = await import("@/lib/aras.server");

    const result = await createArasOrder({
      integrationCode,
      receiverName,
      receiverAddress: line,
      receiverPhone: phone,
      receiverCity: city,
      receiverTown: town,
      pieceCount: Math.min(pieceCount, 99),
      description: description || `Sipariş ${order.order_number}`,
      ...(order.payment_status !== "paid"
        ? { codAmount: Number(order.grand_total), codCurrency: order.currency }
        : {}),
    });

    const { data: shipment, error: insertError } = await supabase
      .from("shipments")
      .insert({
        store_id: order.store_id,
        order_id: order.id,
        carrier: ARAS_CARRIER,
        tracking_number: result.trackingNumber,
        tracking_url: arasTrackingUrl(result.trackingNumber, integrationCode),
        status: "pending",
        note: integrationCode,
      } as never)
      .select("id")
      .single();
    if (insertError) throw new Error(insertError.message);

    await supabase
      .from("orders")
      .update({
        shipping_carrier: ARAS_CARRIER,
        ...(result.trackingNumber ? { tracking_number: result.trackingNumber } : {}),
        status: "packed",
      } as never)
      .eq("id", order.id);

    await supabase.from("order_events").insert({
      order_id: order.id,
      store_id: order.store_id,
      actor_id: userId,
      kind: "shipment",
      message: `Aras Kargo gönderisi oluşturuldu (${integrationCode})`,
      meta: { shipment_id: shipment.id, tracking_number: result.trackingNumber },
    } as never);

    return {
      integrationCode,
      trackingNumber: result.trackingNumber,
      trackingUrl: arasTrackingUrl(result.trackingNumber, integrationCode),
    };
  });

/** Mağazanın bekleyen Aras gönderilerini sorgular ve durumlarını günceller. */
export const refreshArasTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { syncArasShipments } = await import("@/lib/aras.server");
    return syncArasShipments(context.supabase, { storeId: data.storeId, limit: 25 });
  });
