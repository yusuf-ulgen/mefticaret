import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

/**
 * Vitrin siparişleri için kart tahsilatı (Mefpay / QNBpay).
 *
 * Kurallar:
 * - Tutar yalnızca sunucuda `orders.grand_total` üzerinden okunur; istemci tutar belirlemez.
 * - Sipariş erişimi sipariş numarası + e-posta eşleşmesiyle doğrulanır.
 * - Ödeme "başarılı" kabul edilmesi yalnızca QNBpay durum teyidi sonrası olur.
 */

type Admin = SupabaseClient<Database>;

export const orderCardPaymentSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  orderNumber: z.string().trim().min(3).max(40),
  email: z.string().trim().email().max(200),
});

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Admin;
}

/** Sipariş için QNBpay ödeme bağlantısı üretir. */
export async function startOrderCardPayment(
  input: z.infer<typeof orderCardPaymentSchema>,
): Promise<{ link: string }> {
  const db = await admin();

  const { data: store } = await db
    .from("stores")
    .select("id, name, status")
    .eq("slug", input.slug)
    .maybeSingle();
  if (!store || store.status !== "active") throw new Error("Mağaza bulunamadı veya yayında değil");

  const { data: settings } = await db
    .from("store_settings")
    .select("payment_mode")
    .eq("store_id", store.id)
    .maybeSingle();
  if (settings?.payment_mode !== "mefpay") throw new Error("Bu mağazada kartla ödeme kapalı");

  const { data: order, error } = await db
    .from("orders")
    .select("id, order_number, grand_total, currency, payment_status, customer_name")
    .eq("store_id", store.id)
    .eq("order_number", input.orderNumber)
    .ilike("customer_email", input.email)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("Sipariş bulunamadı");
  if (order.payment_status === "paid") throw new Error("Bu siparişin ödemesi alınmış");

  const amount = Number(order.grand_total);
  if (!(amount > 0)) throw new Error("Bu sipariş için çevrimiçi ödeme alınamıyor");

  const { createOrderCheckout } = await import("@/lib/qnbpay-admin.server");
  const result = await createOrderCheckout({
    orderId: order.id,
    storeId: store.id,
    orderNumber: order.order_number,
    amount,
    currency: order.currency,
    buyerName: order.customer_name ?? "Musteri",
  });

  await db.from("order_events").insert({
    order_id: order.id,
    store_id: store.id,
    kind: "payment",
    message: "Kart ile ödeme bağlantısı oluşturuldu",
    meta: { provider: "qnbpay", invoiceRef: result.invoiceRef },
  });

  return { link: result.link };
}

/** Ödemesi teyit edilen işlemi siparişe uygular. */
export async function markOrderPaidFromTransaction(
  db: Admin,
  transaction: { id: string; store_id: string | null; amount: number | string | null; request_summary: unknown },
): Promise<{ handled: boolean }> {
  const summary = (transaction.request_summary ?? {}) as Record<string, unknown>;
  const orderId = typeof summary["orderId"] === "string" ? summary["orderId"] : null;
  if (!orderId || !transaction.store_id) return { handled: false };

  const { data: order } = await db
    .from("orders")
    .select("id, store_id, order_number, payment_status, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.store_id !== transaction.store_id) return { handled: false };
  if (order.payment_status === "paid") return { handled: true };

  await db
    .from("orders")
    .update({
      payment_status: "paid",
      status: ["pending", "awaiting_payment"].includes(order.status) ? "paid" : order.status,
    })
    .eq("id", order.id);

  await db.from("order_events").insert({
    order_id: order.id,
    store_id: order.store_id,
    kind: "payment",
    message: "Kart ödemesi onaylandı",
    meta: { provider: "qnbpay", amount: Number(transaction.amount ?? 0) },
  });

  await db.from("payments").insert({
    store_id: order.store_id,
    order_id: order.id,
    provider: "qnbpay",
    method: "card",
    status: "paid",
    amount: Number(transaction.amount ?? 0),
    captured_at: new Date().toISOString(),
    provider_reference: transaction.id,
  } as never);

  // Dijital siparişte indirme bağlantısı WhatsApp'tan otomatik gönderilir (hata ödemeyi etkilemez).
  const { notifyDigitalOrderPaid } = await import("@/lib/digital-delivery.server");
  await notifyDigitalOrderPaid(db as never, order.id);

  const { dispatchCustomerEvent } = await import("@/lib/customer-notify.server");
  await dispatchCustomerEvent(order.id, "ORDER_CONFIRMED", {}, db as never);

  return { handled: true };
}
