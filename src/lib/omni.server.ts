import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { callProvider, loadStoreAiSettings, monthlyTokenUsage, type ChatMessage } from "@/lib/ai.server";
import { OMNI_CHANNEL_LABELS, type OmniAutoReplyKind, isOmniChannel } from "@/lib/omni";

type Client = SupabaseClient<Database>;

/** Yeni giden mesaj kaydeder, görüşme özetini ve ilk cevap süresini günceller. */
export async function recordOutboundMessage(
  client: Client,
  options: {
    storeId: string;
    conversationId: string;
    body: string;
    sentBy?: string | null;
    isAi?: boolean;
    attachments?: unknown;
  },
): Promise<Database["public"]["Tables"]["omni_messages"]["Row"]> {
  const { data: conversation, error: convError } = await client
    .from("omni_conversations")
    .select("id, created_at, first_response_seconds, message_count")
    .eq("id", options.conversationId)
    .eq("store_id", options.storeId)
    .maybeSingle();
  if (convError) throw new Error(convError.message);
  if (!conversation) throw new Error("Görüşme bulunamadı");

  const { data: message, error } = await client
    .from("omni_messages")
    .insert({
      store_id: options.storeId,
      conversation_id: options.conversationId,
      direction: "outbound",
      body: options.body,
      status: "sent",
      sent_by: options.sentBy ?? null,
      is_ai: options.isAi ?? false,
      attachments: (options.attachments as never) ?? [],
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  let firstResponseSeconds = conversation.first_response_seconds;
  if (firstResponseSeconds == null) {
    const { data: firstInbound } = await client
      .from("omni_messages")
      .select("created_at")
      .eq("conversation_id", options.conversationId)
      .eq("direction", "inbound")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (firstInbound) {
      firstResponseSeconds = Math.max(
        0,
        Math.round((Date.now() - new Date(firstInbound.created_at).getTime()) / 1000),
      );
    }
  }

  const { error: updateError } = await client
    .from("omni_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: options.body.slice(0, 200),
      message_count: (conversation.message_count ?? 0) + 1,
      first_response_seconds: firstResponseSeconds,
      status: "pending",
    })
    .eq("id", options.conversationId)
    .eq("store_id", options.storeId);
  if (updateError) throw new Error(updateError.message);

  return message;
}

/** Görüşmeye bağlı müşteri kaydı ve son siparişi bulmaya çalışır (isim/handle/e-posta eşleşmesiyle). */
export async function enrichConversationCustomer(
  client: Client,
  storeId: string,
  conversation: { participant_name: string | null; participant_handle: string; customer_id: string | null },
) {
  let customer: Database["public"]["Tables"]["customers"]["Row"] | null = null;

  if (conversation.customer_id) {
    const { data } = await client
      .from("customers")
      .select("*")
      .eq("id", conversation.customer_id)
      .eq("store_id", storeId)
      .maybeSingle();
    customer = data ?? null;
  }

  if (!customer) {
    const handle = conversation.participant_handle;
    const name = conversation.participant_name;
    const isEmail = handle.includes("@");
    let query = client.from("customers").select("*").eq("store_id", storeId).limit(1);
    if (isEmail) {
      query = query.eq("email", handle);
    } else if (name) {
      query = query.ilike("full_name", `%${name}%`);
    } else {
      query = query.eq("phone", handle);
    }
    const { data } = await query.maybeSingle();
    customer = data ?? null;
  }

  let lastOrder: Database["public"]["Tables"]["orders"]["Row"] | null = null;
  if (customer) {
    const { data } = await client
      .from("orders")
      .select("*")
      .eq("store_id", storeId)
      .eq("customer_id", customer.id)
      .order("placed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastOrder = data ?? null;
  } else if (conversation.participant_handle.includes("@")) {
    const { data } = await client
      .from("orders")
      .select("*")
      .eq("store_id", storeId)
      .eq("customer_email", conversation.participant_handle)
      .order("placed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastOrder = data ?? null;
  }

  let abandonedCart: Database["public"]["Tables"]["abandoned_carts"]["Row"] | null = null;
  if (customer?.email) {
    const { data } = await client
      .from("abandoned_carts")
      .select("*")
      .eq("store_id", storeId)
      .eq("customer_email", customer.email)
      .is("recovered_order_id", null)
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    abandonedCart = data ?? null;
  }

  return { customer, lastOrder, abandonedCart };
}

/** Kural tabanlı otomatik cevap: karşılama, mesai dışı, sipariş durumu sorgusu. */
export async function resolveAutoReply(
  client: Client,
  storeId: string,
  options: { kind: OmniAutoReplyKind },
): Promise<{ body: string } | null> {
  const { data: rule, error } = await client
    .from("omni_auto_replies")
    .select("*")
    .eq("store_id", storeId)
    .eq("kind", options.kind)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!rule) return null;

  if (options.kind === "off_hours" && rule.working_hours) {
    const hours = rule.working_hours as { start?: number; end?: number } | null;
    if (hours?.start != null && hours?.end != null) {
      const currentHour = new Date().getHours();
      const withinHours = currentHour >= hours.start && currentHour < hours.end;
      if (withinHours) return null;
    }
  }

  return { body: rule.body };
}

/** Görüşme bağlamına dayalı AI cevap önerisi üretir (Lovable AI gateway veya seçili sağlayıcı). */
export async function suggestAiReplyForConversation(
  client: Client,
  options: { storeId: string; userId: string; conversationId: string },
): Promise<{ text: string; totalTokens: number }> {
  const { data: conversation, error: convError } = await client
    .from("omni_conversations")
    .select("*")
    .eq("id", options.conversationId)
    .eq("store_id", options.storeId)
    .maybeSingle();
  if (convError) throw new Error(convError.message);
  if (!conversation) throw new Error("Görüşme bulunamadı");

  const { data: history, error: historyError } = await client
    .from("omni_messages")
    .select("direction, body, created_at")
    .eq("conversation_id", options.conversationId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (historyError) throw new Error(historyError.message);

  const settings = await loadStoreAiSettings(client, options.storeId);
  if (!settings.isEnabled) throw new Error("Bu mağaza için AI kullanımı kapalı");

  const used = await monthlyTokenUsage(client, options.storeId);
  if (settings.monthlyTokenLimit > 0 && used >= settings.monthlyTokenLimit) {
    throw new Error("Bu ay için AI token limitiniz doldu.");
  }

  const { customer, lastOrder } = await enrichConversationCustomer(client, options.storeId, conversation);

  const channelName = isOmniChannel(conversation.channel)
    ? OMNI_CHANNEL_LABELS[conversation.channel]
    : conversation.channel;

  const contextLines = [
    `Kanal: ${channelName}`,
    `Müşteri: ${conversation.participant_name ?? conversation.participant_handle}`,
    customer ? `Toplam sipariş sayısı: ${customer.orders_count}, toplam harcama: ${customer.total_spent}` : "Kayıtlı müşteri bulunamadı.",
    lastOrder
      ? `Son sipariş: ${lastOrder.order_number}, durum: ${lastOrder.status}, kargo: ${lastOrder.fulfillment_status}${lastOrder.tracking_number ? `, takip no: ${lastOrder.tracking_number}` : ""}`
      : "Aktif sipariş bulunamadı.",
  ].join("\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Sen bir e-ticaret mağazasının müşteri hizmetleri temsilcisisin. Kısa, samimi ve çözüm odaklı Türkçe yanıt ver. Uydurma bilgi verme; sadece verilen bağlamı kullan.",
    },
    { role: "system", content: contextLines },
    ...[...(history ?? [])].reverse().map((row) => ({
      role: row.direction === "outbound" ? ("assistant" as const) : ("user" as const),
      content: row.body,
    })),
  ];

  const result = await callProvider({
    purpose: "text",
    charge: { storeId: options.storeId, userId: options.userId, task: "omni_reply" },
    messages,
    temperature: settings.creativity,
    maxTokens: 500,
  });

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("ai_generations").insert({
    store_id: options.storeId,
    user_id: options.userId,
    task: "omni_reply_suggestion",
    provider_code: settings.providerCode,
    model: settings.model,
    prompt: contextLines.slice(0, 8000),
    output: result.text.slice(0, 20000),
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    total_tokens: result.inputTokens + result.outputTokens,
    duration_ms: 0,
    status: "success",
  });

  return { text: result.text, totalTokens: result.inputTokens + result.outputTokens };
}

const REQUIRED_CREDENTIAL_FIELDS: Record<string, string[]> = {
  instagram: ["page_id", "access_token"],
  tiktok: ["app_id", "access_token"],
  messenger: ["page_id", "access_token"],
  telegram: ["bot_token"],
  live_chat: ["widget_key"],
  email: ["inbox_address"],
  marketplace: ["seller_id", "api_key"],
  whatsapp: ["phone_number_id", "access_token"],
};

/** Kanal hesabının kimlik bilgilerini kontrol eder; canlı bir dış API çağrısı yapmaz. */
export function evaluateChannelAccountStatus(
  channel: string,
  credentials: Record<string, unknown>,
): { status: "connected" | "error"; statusMessage: string } {
  const required = REQUIRED_CREDENTIAL_FIELDS[channel] ?? [];
  const missing = required.filter((field) => !credentials[field] || String(credentials[field]).trim() === "");

  if (missing.length > 0) {
    return {
      status: "error",
      statusMessage: `Eksik kimlik bilgisi: ${missing.join(", ")}`,
    };
  }

  if (channel === "instagram" || channel === "messenger") {
    return {
      status: "connected",
      statusMessage: "Kimlik bilgileri kayıtlı, Meta uygulama incelemesi bekleniyor.",
    };
  }

  if (channel === "tiktok" || channel === "marketplace") {
    return {
      status: "connected",
      statusMessage: "Kimlik bilgileri kayıtlı, sağlayıcı onayı bekleniyor.",
    };
  }

  return { status: "connected", statusMessage: "Kimlik bilgileri kayıtlı." };
}
