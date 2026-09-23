import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/** Dijital sipariş ödemesi onaylanınca alıcıya indirme sayfasını WhatsApp'tan yollar.
 * Mağazanın WhatsApp Business hesabı yoksa mesaj kuyruğa alınır ve satıcı panelden elle gönderir. */
export async function notifyDigitalOrderPaid(db: SupabaseClient<Database>, orderId: string) {
  const { data: order } = await db
    .from("orders")
    .select("id, store_id, order_number, is_digital, customer_phone, customer_email, customer_name, stores(slug, name)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order?.is_digital || !order.customer_phone || !order.customer_email) return { sent: false };
  const store = order.stores as unknown as { slug: string; name: string } | null;
  if (!store) return { sent: false };

  let digits = order.customer_phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `9${digits}`;
  else if (digits.length === 10) digits = `90${digits}`;
  if (digits.length < 11) return { sent: false };

  const link = `https://mefticaret.com/s/${store.slug}/order?no=${encodeURIComponent(order.order_number)}&email=${encodeURIComponent(order.customer_email)}`;
  const body = `Merhaba ${order.customer_name ?? ""}, ${store.name} — ${order.order_number} numaralı dijital siparişinizin ödemesi onaylandı. Dosyanızı buradan indirebilirsiniz: ${link}`;
  try {
    const { sendWhatsAppMessage } = await import("@/lib/whatsapp.server");
    const result = await sendWhatsAppMessage(db as never, {
      storeId: order.store_id,
      waId: digits,
      body,
      contactName: order.customer_name,
    });
    await db.from("order_events").insert({
      order_id: order.id,
      store_id: order.store_id,
      kind: "note",
      message:
        result.status === "sent"
          ? "İndirme bağlantısı WhatsApp ile gönderildi"
          : `İndirme bağlantısı WhatsApp ile gönderilemedi: ${result.error ?? "bilinmeyen"}`,
      meta: { digital_delivery: true, status: result.status },
    } as never);
    return { sent: result.status === "sent" };
  } catch (cause) {
    console.error("digital whatsapp", cause);
    return { sent: false };
  }
}
