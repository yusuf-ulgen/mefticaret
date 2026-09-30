import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * WhatsApp Business yönetimi: hesap bağlama, giden mesaj, şablon bildirimleri
 * ve otomatik cevap kuralları.
 */

/**
 * Giden mesaj yetkisi: yalnızca mağaza yöneticileri (sahip/admin) ya da platform
 * yöneticisi mesaj gönderebilir; kötüye kullanımı sınırlamak için hız sınırı var.
 */
async function assertManager(supabase: unknown, storeId: string, userId: string) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(supabase as never, storeId, userId);
}

/** Alıcılar yalnızca mağazanın kendi WhatsApp görüşmeleri veya müşterileri olabilir. */
async function assertKnownRecipients(supabase: unknown, storeId: string, waIds: string[]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const digits = (v: string) => v.replace(/\D/g, "");
  const wanted = Array.from(new Set(waIds.map(digits)));
  const { data: convs } = await supabaseAdmin
    .from("whatsapp_conversations")
    .select("wa_id")
    .eq("store_id", storeId)
    .in("wa_id", Array.from(new Set([...waIds, ...wanted])));
  const known = new Set((convs ?? []).map((c: { wa_id: string }) => digits(c.wa_id)));
  const missing = wanted.filter((w) => !known.has(w));
  if (missing.length) {
    const { data: customers } = await supabaseAdmin
      .from("customers")
      .select("phone")
      .eq("store_id", storeId)
      .not("phone", "is", null)
      .limit(5000);
    for (const c of (customers ?? []) as { phone: string | null }[]) {
      const d = digits(c.phone ?? "");
      if (d) known.add(d);
    }
  }
  void supabase;
  const unknown = wanted.filter((w) => !known.has(w) && ![...known].some((k) => k.endsWith(w.slice(-10)) && w.length >= 10));
  if (unknown.length) throw new Error("Alıcı bu mağazanın müşterisi veya görüşmesi değil");
}

async function limitOutbound(storeId: string, userId: string, count: number) {
  const { consumeRateLimit } = await import("@/lib/rate-limit.server");
  const limit = await consumeRateLimit(`whatsapp_send:${storeId}:${userId}`, {
    limit: 400,
    windowSeconds: 3600,
  });
  if (!limit.allowed || count > 200) {
    throw new Error("Çok fazla mesaj gönderimi denendi. Bir süre sonra tekrar deneyin.");
  }
}

export const saveWhatsAppAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        displayPhone: z.string().trim().min(6).max(30),
        phoneNumberId: z.string().trim().min(3).max(64),
        wabaId: z.string().trim().max(64).optional(),
        businessName: z.string().trim().max(120).optional(),
        autoReplyEnabled: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: account, error } = await context.supabase
      .from("whatsapp_accounts")
      .upsert(
        {
          store_id: data.storeId,
          display_phone: data.displayPhone,
          phone_number_id: data.phoneNumberId,
          waba_id: data.wabaId ?? null,
          business_name: data.businessName ?? null,
          auto_reply_enabled: data.autoReplyEnabled,
          status: "connected",
        },
        { onConflict: "store_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return account;
  });

export const sendWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        waId: z.string().trim().min(6).max(30),
        body: z.string().trim().min(1).max(3000),
        templateName: z.string().trim().max(120).optional(),
        contactName: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, data.storeId, context.userId);
    await assertKnownRecipients(context.supabase, data.storeId, [data.waId]);
    await limitOutbound(data.storeId, context.userId, 1);
    const { sendWhatsAppMessage } = await import("@/lib/whatsapp.server");
    const result = await sendWhatsAppMessage(context.supabase, {
      storeId: data.storeId,
      waId: data.waId,
      body: data.body,
      templateName: data.templateName ?? null,
      contactName: data.contactName ?? null,
    });
    return { status: result.status, error: result.error };
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), conversationId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("whatsapp_conversations")
      .update({ unread_count: 0 })
      .eq("id", data.conversationId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveAutoReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        replyId: z.guid().optional(),
        keyword: z.string().trim().min(2).max(80),
        matchType: z.enum(["contains", "exact", "starts_with"]).default("contains"),
        replyBody: z.string().trim().min(2).max(1000),
        isActive: z.boolean().default(true),
        sortOrder: z.number().int().min(0).max(999).default(0),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      store_id: data.storeId,
      keyword: data.keyword,
      match_type: data.matchType,
      reply_body: data.replyBody,
      is_active: data.isActive,
      sort_order: data.sortOrder,
    };

    const { data: reply, error } = await (data.replyId
      ? context.supabase
          .from("whatsapp_auto_replies")
          .update(payload)
          .eq("id", data.replyId)
          .eq("store_id", data.storeId)
      : context.supabase.from("whatsapp_auto_replies").insert(payload)
    )
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return reply;
  });

export const deleteAutoReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), replyId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("whatsapp_auto_replies")
      .delete()
      .eq("id", data.replyId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Sipariş / kargo bildirimini WhatsApp üzerinden gönderir. */
export const sendOrderNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        orderId: z.guid(),
        kind: z.enum(["order", "shipment"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: order, error } = await supabase
      .from("orders")
      .select("order_number, customer_phone, customer_name, grand_total, currency, tracking_number, shipping_carrier")
      .eq("id", data.orderId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Sipariş bulunamadı");
    if (!order.customer_phone) throw new Error("Siparişte telefon numarası yok");

    const body =
      data.kind === "order"
        ? `Merhaba ${order.customer_name ?? "değerli müşterimiz"}, ${order.order_number} numaralı siparişiniz alındı. Tutar: ${order.grand_total} ${order.currency}.`
        : `Merhaba ${order.customer_name ?? "değerli müşterimiz"}, ${order.order_number} numaralı siparişiniz kargoya verildi. ${order.shipping_carrier ?? ""} ${order.tracking_number ?? ""}`.trim();

    const { sendWhatsAppMessage } = await import("@/lib/whatsapp.server");
    const result = await sendWhatsAppMessage(supabase, {
      storeId: data.storeId,
      waId: order.customer_phone,
      body,
      contactName: order.customer_name ?? null,
    });
    return { status: result.status, error: result.error };
  });

/** Toplu kampanya: seçilen görüşmelere aynı mesajı gönderir. */
export const sendWhatsAppCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        body: z.string().trim().min(2).max(3000),
        templateName: z.string().trim().max(120).optional(),
        waIds: z.array(z.string().trim().min(6).max(30)).min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, data.storeId, context.userId);
    await assertKnownRecipients(context.supabase, data.storeId, data.waIds);
    await limitOutbound(data.storeId, context.userId, data.waIds.length);
    const { sendWhatsAppMessage } = await import("@/lib/whatsapp.server");
    let sent = 0;
    let failed = 0;
    for (const waId of data.waIds) {
      try {
        const result = await sendWhatsAppMessage(context.supabase, {
          storeId: data.storeId,
          waId,
          body: data.body,
          templateName: data.templateName ?? null,
        });
        if (result.status === "failed") failed += 1;
        else sent += 1;
      } catch {
        failed += 1;
      }
    }
    return { sent, failed };
  });
