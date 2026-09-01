import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

/**
 * WhatsApp Business Cloud API entegrasyon katmanı.
 * Erişim anahtarı (WHATSAPP_ACCESS_TOKEN) tanımlı değilse mesajlar kuyruğa
 * alınır; böylece mimari, hesap bağlanmadan da uçtan uca çalışır.
 */

const GRAPH_VERSION = "v20.0";

export type WhatsAppAccount = Database["public"]["Tables"]["whatsapp_accounts"]["Row"];

export async function getAccount(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertConversation(
  supabase: Client,
  storeId: string,
  waId: string,
  contactName: string | null,
) {
  const { data: existing } = await supabase
    .from("whatsapp_conversations")
    .select("*")
    .eq("store_id", storeId)
    .eq("wa_id", waId)
    .maybeSingle();

  if (existing) return existing;

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("store_id", storeId)
    .eq("phone", waId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("whatsapp_conversations")
    .insert({
      store_id: storeId,
      wa_id: waId,
      contact_name: contactName,
      customer_id: customer?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function callGraph(
  account: WhatsAppAccount,
  token: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${account.phone_number_id}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    },
  );

  const json = (await response.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(json.error?.message ?? `WhatsApp API hatası (${response.status})`);
  }
  return json.messages?.[0]?.id ?? null;
}

/** Serbest metin ya da onaylı şablon mesajı gönderir. */
export async function sendWhatsAppMessage(
  supabase: Client,
  input: {
    storeId: string;
    waId: string;
    body: string;
    templateName?: string | null;
    templateLanguage?: string;
    contactName?: string | null;
    customerId?: string | null;
  },
) {
  const account = await getAccount(supabase, input.storeId);
  const conversation = await upsertConversation(
    supabase,
    input.storeId,
    input.waId,
    input.contactName ?? null,
  );

  const token = process.env["WHATSAPP_ACCESS_TOKEN"];
  let status: Database["public"]["Enums"]["message_delivery_status"] = "queued";
  let waMessageId: string | null = null;
  let error: string | null = null;

  if (account && token) {
    try {
      waMessageId = await callGraph(account, token, {
        to: input.waId,
        ...(input.templateName
          ? {
              type: "template",
              template: {
                name: input.templateName,
                language: { code: input.templateLanguage ?? "tr" },
              },
            }
          : { type: "text", text: { body: input.body, preview_url: true } }),
      });
      status = "sent";
    } catch (cause) {
      status = "failed";
      error = cause instanceof Error ? cause.message : "bilinmeyen hata";
    }
  } else {
    error = account
      ? "WhatsApp erişim anahtarı tanımlı değil, mesaj kuyruğa alındı"
      : "WhatsApp Business hesabı bağlı değil, mesaj kuyruğa alındı";
  }

  const { data: message, error: insertError } = await supabase
    .from("whatsapp_messages")
    .insert({
      conversation_id: conversation.id,
      store_id: input.storeId,
      direction: "outbound",
      wa_message_id: waMessageId,
      message_type: input.templateName ? "template" : "text",
      body: input.body,
      template_name: input.templateName ?? null,
      status,
      payload: error ? { note: error } : {},
    })
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);

  await supabase
    .from("whatsapp_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: input.body.slice(0, 160),
    })
    .eq("id", conversation.id);

  return { message, conversation, status, error };
}

/** Gelen mesajı kaydeder, gerekiyorsa otomatik cevabı gönderir. */
export async function handleInboundMessage(
  supabase: Client,
  storeId: string,
  input: { waId: string; contactName: string | null; body: string; waMessageId: string | null; type: string },
) {
  const conversation = await upsertConversation(supabase, storeId, input.waId, input.contactName);

  await supabase.from("whatsapp_messages").insert({
    conversation_id: conversation.id,
    store_id: storeId,
    direction: "inbound",
    wa_message_id: input.waMessageId,
    message_type: input.type,
    body: input.body,
    status: "delivered",
  });

  await supabase
    .from("whatsapp_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: input.body.slice(0, 160),
      unread_count: conversation.unread_count + 1,
      status: "open",
    })
    .eq("id", conversation.id);

  const account = await getAccount(supabase, storeId);
  if (!account?.auto_reply_enabled) return { conversation, autoReplied: false };

  const { data: replies } = await supabase
    .from("whatsapp_auto_replies")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const text = input.body.toLowerCase().trim();
  const match = (replies ?? []).find((reply) => {
    const keyword = reply.keyword.toLowerCase().trim();
    if (reply.match_type === "exact") return text === keyword;
    if (reply.match_type === "starts_with") return text.startsWith(keyword);
    return text.includes(keyword);
  });

  if (!match) return { conversation, autoReplied: false };

  await sendWhatsAppMessage(supabase, {
    storeId,
    waId: input.waId,
    body: match.reply_body,
    contactName: input.contactName,
  });

  return { conversation, autoReplied: true };
}

/** Meta durum güncellemelerini (sent/delivered/read/failed) işler. */
export async function applyStatusUpdate(
  supabase: Client,
  storeId: string,
  waMessageId: string,
  status: string,
) {
  const mapped: Database["public"]["Enums"]["message_delivery_status"] =
    status === "read"
      ? "read"
      : status === "delivered"
        ? "delivered"
        : status === "failed"
          ? "failed"
          : "sent";

  await supabase
    .from("whatsapp_messages")
    .update({ status: mapped })
    .eq("store_id", storeId)
    .eq("wa_message_id", waMessageId);
}
