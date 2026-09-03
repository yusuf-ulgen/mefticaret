import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OMNI_AUTO_REPLY_KINDS, OMNI_CHANNELS, OMNI_CONVERSATION_STATUSES } from "@/lib/omni";

/**
 * Omni-Channel Mesaj Merkezi: tüm kanallardan gelen görüşmeler, giden mesajlar,
 * hızlı cevaplar, otomatik cevap kuralları ve kanal hesabı yönetimi.
 */

export const sendOmniMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        conversationId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
        isAi: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { recordOutboundMessage } = await import("@/lib/omni.server");
    const message = await recordOutboundMessage(context.supabase, {
      storeId: data.storeId,
      conversationId: data.conversationId,
      body: data.body,
      sentBy: context.user.id,
      isAi: data.isAi,
    });
    return message;
  });

export const markConversationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), conversationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("omni_conversations")
      .update({ unread_count: 0 })
      .eq("id", data.conversationId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        conversationId: z.string().uuid(),
        assignedTo: z.string().uuid().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("omni_conversations")
      .update({ assigned_to: data.assignedTo })
      .eq("id", data.conversationId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setConversationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        conversationId: z.string().uuid(),
        status: z.enum(OMNI_CONVERSATION_STATUSES),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("omni_conversations")
      .update({ status: data.status })
      .eq("id", data.conversationId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setConversationTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        conversationId: z.string().uuid(),
        tags: z.array(z.string().trim().min(1).max(40)).max(20),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("omni_conversations")
      .update({ tags: data.tags })
      .eq("id", data.conversationId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveInternalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        conversationId: z.string().uuid(),
        note: z.string().trim().max(2000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("omni_conversations")
      .update({ internal_note: data.note || null })
      .eq("id", data.conversationId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertQuickReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        replyId: z.string().uuid().optional(),
        title: z.string().trim().min(1).max(80),
        body: z.string().trim().min(1).max(1000),
        sortOrder: z.number().int().min(0).max(999).default(0),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      store_id: data.storeId,
      title: data.title,
      body: data.body,
      sort_order: data.sortOrder,
    };
    const { data: reply, error } = await (data.replyId
      ? context.supabase
          .from("omni_quick_replies")
          .update(payload)
          .eq("id", data.replyId)
          .eq("store_id", data.storeId)
      : context.supabase.from("omni_quick_replies").insert(payload)
    )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return reply;
  });

export const deleteQuickReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), replyId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("omni_quick_replies")
      .delete()
      .eq("id", data.replyId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveAutoReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        replyId: z.string().uuid().optional(),
        kind: z.enum(OMNI_AUTO_REPLY_KINDS),
        body: z.string().trim().min(1).max(1500),
        isActive: z.boolean().default(true),
        workingHoursStart: z.number().int().min(0).max(23).optional(),
        workingHoursEnd: z.number().int().min(0).max(23).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const workingHours =
      data.workingHoursStart != null && data.workingHoursEnd != null
        ? { start: data.workingHoursStart, end: data.workingHoursEnd }
        : {};
    const payload = {
      store_id: data.storeId,
      kind: data.kind,
      body: data.body,
      is_active: data.isActive,
      working_hours: workingHours as never,
    };
    const { data: reply, error } = await (data.replyId
      ? context.supabase
          .from("omni_auto_replies")
          .update(payload)
          .eq("id", data.replyId)
          .eq("store_id", data.storeId)
      : context.supabase.from("omni_auto_replies").insert(payload)
    )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return reply;
  });

export const saveChannelAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        accountId: z.string().uuid().optional(),
        channel: z.enum(OMNI_CHANNELS),
        accountName: z.string().trim().min(1).max(120),
        externalId: z.string().trim().max(120).optional(),
        credentials: z.record(z.string(), z.string()).default({}),
        isActive: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { evaluateChannelAccountStatus } = await import("@/lib/omni.server");
    const evaluation = evaluateChannelAccountStatus(data.channel, data.credentials);

    const payload = {
      store_id: data.storeId,
      channel: data.channel,
      account_name: data.accountName,
      external_id: data.externalId ?? null,
      credentials: data.credentials as never,
      is_active: data.isActive,
      status: evaluation.status,
      status_message: evaluation.statusMessage,
      last_synced_at: new Date().toISOString(),
    };

    const { data: account, error } = await (data.accountId
      ? context.supabase
          .from("omni_channel_accounts")
          .update(payload)
          .eq("id", data.accountId)
          .eq("store_id", data.storeId)
      : context.supabase.from("omni_channel_accounts").insert(payload)
    )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return account;
  });

export const testChannelAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.string().uuid(), accountId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: account, error } = await context.supabase
      .from("omni_channel_accounts")
      .select("*")
      .eq("id", data.accountId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!account) throw new Error("Kanal hesabı bulunamadı");

    const { evaluateChannelAccountStatus } = await import("@/lib/omni.server");
    const evaluation = evaluateChannelAccountStatus(
      account.channel,
      (account.credentials as Record<string, unknown>) ?? {},
    );

    const { data: updated, error: updateError } = await context.supabase
      .from("omni_channel_accounts")
      .update({
        status: evaluation.status,
        status_message: evaluation.statusMessage,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", data.accountId)
      .eq("store_id", data.storeId)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);
    return updated;
  });

export const suggestAiReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.string().uuid(), conversationId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { suggestAiReplyForConversation } = await import("@/lib/omni.server");
    return suggestAiReplyForConversation(context.supabase, {
      storeId: data.storeId,
      userId: context.user.id,
      conversationId: data.conversationId,
    });
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        channel: z.enum(OMNI_CHANNELS),
        participantName: z.string().trim().min(1).max(120),
        participantHandle: z.string().trim().min(1).max(160),
        initialMessage: z.string().trim().min(1).max(2000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: conversation, error } = await context.supabase
      .from("omni_conversations")
      .insert({
        store_id: data.storeId,
        channel: data.channel,
        participant_name: data.participantName,
        participant_handle: data.participantHandle,
        status: "open",
        last_message_preview: data.initialMessage?.slice(0, 200) ?? null,
        message_count: data.initialMessage ? 1 : 0,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (data.initialMessage) {
      const { error: msgError } = await context.supabase.from("omni_messages").insert({
        store_id: data.storeId,
        conversation_id: conversation.id,
        direction: "inbound",
        body: data.initialMessage,
        status: "delivered",
      });
      if (msgError) throw new Error(msgError.message);
    }

    return conversation;
  });

export const sendProductCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ storeId: z.string().uuid(), conversationId: z.string().uuid(), productId: z.string().uuid() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: store, error: storeError } = await context.supabase
      .from("stores")
      .select("slug")
      .eq("id", data.storeId)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Mağaza bulunamadı");

    const { data: product, error } = await context.supabase
      .from("products")
      .select("title, slug, base_price, currency")
      .eq("id", data.productId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!product) throw new Error("Ürün bulunamadı");

    const origin = process.env["APP_ORIGIN"] ?? "";
    const url = `${origin}/s/${store.slug}/p/${product.slug}`;
    const body = `${product.title} — ${product.base_price} ${product.currency}\n${url}`;

    const { recordOutboundMessage } = await import("@/lib/omni.server");
    return recordOutboundMessage(context.supabase, {
      storeId: data.storeId,
      conversationId: data.conversationId,
      body,
      sentBy: context.user.id,
    });
  });

export const sendCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ storeId: z.string().uuid(), conversationId: z.string().uuid(), discountId: z.string().uuid() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: discount, error } = await context.supabase
      .from("discounts")
      .select("code, type, value, title")
      .eq("id", data.discountId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!discount) throw new Error("Kupon bulunamadı");

    const body = `${discount.title ?? "İndirim kuponu"}: ${discount.code} kodunu kullanarak ${discount.value}${discount.type === "percentage" ? "%" : ""} indirim kazanabilirsiniz.`;

    const { recordOutboundMessage } = await import("@/lib/omni.server");
    return recordOutboundMessage(context.supabase, {
      storeId: data.storeId,
      conversationId: data.conversationId,
      body,
      sentBy: context.user.id,
    });
  });

export const sendOrderLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ storeId: z.string().uuid(), conversationId: z.string().uuid(), orderId: z.string().uuid() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: store, error: storeError } = await context.supabase
      .from("stores")
      .select("slug")
      .eq("id", data.storeId)
      .maybeSingle();
    if (storeError) throw new Error(storeError.message);
    if (!store) throw new Error("Mağaza bulunamadı");

    const { data: order, error } = await context.supabase
      .from("orders")
      .select("order_number, status, tracking_number")
      .eq("id", data.orderId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Sipariş bulunamadı");

    const origin = process.env["APP_ORIGIN"] ?? "";
    const url = `${origin}/s/${store.slug}/account`;
    const body = `${order.order_number} numaralı siparişinizin durumu: ${order.status}${order.tracking_number ? ` (Takip no: ${order.tracking_number})` : ""}. Detaylar: ${url}`;

    const { recordOutboundMessage } = await import("@/lib/omni.server");
    return recordOutboundMessage(context.supabase, {
      storeId: data.storeId,
      conversationId: data.conversationId,
      body,
      sentBy: context.user.id,
    });
  });
