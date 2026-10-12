import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { callProvider, loadStoreAiSettings, monthlyTokenUsage, type ChatMessage } from "@/lib/ai.server";
import {
  INSTAGRAM_GRAPH_VERSION,
  INSTAGRAM_SCOPES,
  classifyIntent,
  deriveSegment,
  matchKeyword,
  renderTemplate,
  type IgMatchType,
} from "@/lib/instagram";

/**
 * Instagram DM & Social Inbox servis katmanı (yalnızca sunucu).
 *
 * Akış: Meta webhook → `instagram_events` kuyruğu (idempotent, dış kimlik tekil)
 * → cron worker → yorum kuralı motoru / DM işleyici → `omni_conversations`
 * (Mesaj Merkezi ile aynı gelen kutusu) + `instagram_interactions` denetim izi.
 *
 * Erişim anahtarları `instagram_credentials` tablosunda tutulur; tablonun
 * authenticated politikası yoktur, yani panel istemcisi anahtarları hiç görmez.
 */

type Client = SupabaseClient<Database>;
type Admin = Client;

export type IgAccount = Database["public"]["Tables"]["instagram_accounts"]["Row"];
export type IgRule = Database["public"]["Tables"]["instagram_comment_rules"]["Row"];

const GRAPH = `https://graph.facebook.com/${INSTAGRAM_GRAPH_VERSION}`;

/* ------------------------------------------------------------------ */
/* Meta uygulama yapılandırması                                        */
/* ------------------------------------------------------------------ */

export function metaAppConfig() {
  return {
    appId: process.env["META_APP_ID"] ?? null,
    appSecret: process.env["META_APP_SECRET"] ?? null,
  };
}

/** Instagram Professional OAuth2 onay adresi. */
export function buildInstagramOAuthUrl(redirectUri: string, state: string): string {
  const { appId } = metaAppConfig();
  if (!appId) throw new Error("Meta uygulama kimliği (META_APP_ID) tanımlı değil.");
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
  return url.toString();
}

async function graphJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${GRAPH}${path}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Meta Graph API hatası (${response.status}): ${text.slice(0, 400)}`);
  }
  return JSON.parse(text) as T;
}

/** Yetkilendirme kodunu uzun ömürlü sayfa/Instagram anahtarına çevirir. */
export async function exchangeInstagramCode(code: string, redirectUri: string) {
  const { appId, appSecret } = metaAppConfig();
  if (!appId || !appSecret) throw new Error("Meta uygulama bilgileri tanımlı değil.");

  const short = await graphJson<{ access_token: string; expires_in?: number }>(
    `/oauth/access_token?client_id=${appId}&client_secret=${appSecret}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`,
  );

  const long = await graphJson<{ access_token: string; expires_in?: number }>(
    `/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}` +
      `&client_secret=${appSecret}&fb_exchange_token=${short.access_token}`,
  );

  const pages = await graphJson<{
    data: { id: string; name: string; access_token: string; instagram_business_account?: { id: string } }[];
  }>(`/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${long.access_token}`);

  const page = pages.data.find((item) => item.instagram_business_account?.id);
  if (!page?.instagram_business_account) {
    throw new Error("Sayfaya bağlı bir Instagram Professional hesabı bulunamadı.");
  }

  const profile = await graphJson<{ id: string; username?: string }>(
    `/${page.instagram_business_account.id}?fields=id,username&access_token=${page.access_token}`,
  );

  return {
    igUserId: profile.id,
    igUsername: profile.username ?? null,
    pageId: page.id,
    pageName: page.name,
    accessToken: page.access_token,
    expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null,
  };
}

/* ------------------------------------------------------------------ */
/* Hesap & anahtar yönetimi                                           */
/* ------------------------------------------------------------------ */

export async function getInstagramAccount(client: Client, storeId: string) {
  const { data, error } = await client
    .from("instagram_accounts")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertInstagramAccount(
  admin: Admin,
  storeId: string,
  input: {
    igUserId: string;
    igUsername: string | null;
    pageId: string | null;
    pageName?: string | null;
    accessToken: string;
    expiresAt?: string | null;
  },
) {
  const existing = await getInstagramAccount(admin, storeId);

  const payload = {
    store_id: storeId,
    ig_user_id: input.igUserId,
    ig_username: input.igUsername,
    page_id: input.pageId,
    page_name: input.pageName ?? null,
    scopes: [...INSTAGRAM_SCOPES],
    status: "connected",
    status_message: "Hesap bağlı, webhook olayları dinleniyor.",
    token_expires_at: input.expiresAt ?? null,
  };

  const { data: account, error } = existing
    ? await admin
        .from("instagram_accounts")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single()
    : await admin.from("instagram_accounts").insert(payload).select("*").single();
  if (error) throw new Error(error.message);

  const { error: credentialError } = await admin.from("instagram_credentials").upsert(
    {
      store_id: storeId,
      account_id: account.id,
      access_token: input.accessToken,
      expires_at: input.expiresAt ?? null,
    },
    { onConflict: "account_id" },
  );
  if (credentialError) throw new Error(credentialError.message);

  return account;
}

async function loadToken(admin: Admin, accountId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("instagram_credentials")
    .select("access_token")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.access_token ?? null;
}

/* ------------------------------------------------------------------ */
/* Webhook doğrulama & kuyruk                                          */
/* ------------------------------------------------------------------ */

/** Meta `x-hub-signature-256` imzasını sabit zamanlı karşılaştırır. */
export async function verifyInstagramSignature(
  rawBody: string,
  headerValue: string | null,
): Promise<boolean> {
  const { appSecret } = metaAppConfig();
  if (!appSecret) return false;
  if (!headerValue?.startsWith("sha256=")) return false;

  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const provided = headerValue.slice("sha256=".length);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
}

type QueuedEvent = {
  storeId: string | null;
  eventType: string;
  externalId: string | null;
  payload: Record<string, unknown>;
};

/** Webhook gövdesini ayrıştırıp kuyruğa alınacak olaylara böler. */
export function parseWebhookPayload(body: unknown): QueuedEvent[] {
  const events: QueuedEvent[] = [];
  const entries = (body as { entry?: unknown[] } | null)?.entry;
  if (!Array.isArray(entries)) return events;

  for (const entry of entries) {
    const igId = String((entry as { id?: unknown }).id ?? "");
    const messaging = (entry as { messaging?: unknown[] }).messaging;
    if (Array.isArray(messaging)) {
      for (const item of messaging) {
        const event = item as {
          sender?: { id?: string };
          message?: { mid?: string; text?: string; reply_to?: { story?: unknown } };
        };
        if (!event.message?.mid) continue;
        events.push({
          storeId: null,
          eventType: event.message.reply_to?.story ? "story_reply" : "message",
          externalId: event.message.mid,
          payload: { igId, event },
        });
      }
    }

    const changes = (entry as { changes?: unknown[] }).changes;
    if (Array.isArray(changes)) {
      for (const change of changes) {
        const item = change as { field?: string; value?: Record<string, unknown> };
        if (!item.value) continue;
        const field = item.field === "mentions" ? "mention" : "comment";
        events.push({
          storeId: null,
          eventType: field,
          externalId: (item.value["id"] as string | undefined) ?? null,
          payload: { igId, value: item.value },
        });
      }
    }
  }

  return events;
}

/** Olayları kuyruğa alır; aynı dış kimlik tekrar gelirse yok sayılır (idempotent). */
export async function enqueueInstagramEvents(
  admin: Admin,
  storeId: string | null,
  events: QueuedEvent[],
): Promise<number> {
  if (events.length === 0) return 0;
  const rows = events.map((event) => ({
    store_id: storeId,
    event_type: event.eventType,
    external_id: event.externalId,
    payload: event.payload as never,
  }));
  const { data, error } = await admin
    .from("instagram_events")
    .upsert(rows, { onConflict: "event_type,external_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/* ------------------------------------------------------------------ */
/* Ürün bağlantıları                                                   */
/* ------------------------------------------------------------------ */

type ProductLink = {
  title: string;
  price: number;
  currency: string;
  inStock: boolean;
  url: string;
  cartUrl: string;
};

async function buildProductLink(
  admin: Admin,
  storeId: string,
  productId: string,
): Promise<ProductLink | null> {
  const [{ data: store }, { data: product }] = await Promise.all([
    admin.from("stores").select("slug").eq("id", storeId).maybeSingle(),
    admin
      .from("products")
      .select("id, title, slug, base_price, currency, track_inventory")
      .eq("id", productId)
      .eq("store_id", storeId)
      .maybeSingle(),
  ]);
  if (!store || !product) return null;

  const { data: variants } = await admin
    .from("product_variants")
    .select("stock")
    .eq("product_id", product.id);
  const stock = (variants ?? []).reduce((total, row) => total + (row.stock ?? 0), 0);

  const base = process.env["PUBLIC_SITE_URL"] ?? "https://mefticaret.lovable.app";
  const url = `${base}/s/${store.slug}/p/${product.slug}`;
  return {
    title: product.title,
    price: Number(product.base_price ?? 0),
    currency: product.currency ?? "TRY",
    inStock: !product.track_inventory || stock > 0,
    url,
    cartUrl: `${url}?add=1`,
  };
}

/* ------------------------------------------------------------------ */
/* Gönderim                                                            */
/* ------------------------------------------------------------------ */

/** Instagram Messaging API üzerinden DM gönderir. */
export async function sendInstagramDm(
  admin: Admin,
  input: { storeId: string; recipientId: string; text: string },
): Promise<{ status: "sent" | "queued" | "failed"; error: string | null; externalId: string | null }> {
  const account = await getInstagramAccount(admin, input.storeId);
  if (!account) return { status: "queued", error: "Instagram hesabı bağlı değil", externalId: null };

  const token = await loadToken(admin, account.id);
  if (!token) return { status: "queued", error: "Erişim anahtarı tanımlı değil", externalId: null };

  try {
    const result = await graphJson<{ message_id?: string }>(`/${account.ig_user_id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipient: { id: input.recipientId },
        message: { text: input.text },
        access_token: token,
      }),
    });
    return { status: "sent", error: null, externalId: result.message_id ?? null };
  } catch (cause) {
    return {
      status: "failed",
      error: cause instanceof Error ? cause.message : "bilinmeyen hata",
      externalId: null,
    };
  }
}

/** Yorumun altına herkese açık yanıt bırakır. */
export async function replyToInstagramComment(
  admin: Admin,
  input: { storeId: string; commentId: string; message: string },
): Promise<{ status: "sent" | "queued" | "failed"; error: string | null }> {
  const account = await getInstagramAccount(admin, input.storeId);
  if (!account) return { status: "queued", error: "Instagram hesabı bağlı değil" };
  const token = await loadToken(admin, account.id);
  if (!token) return { status: "queued", error: "Erişim anahtarı tanımlı değil" };

  try {
    await graphJson(`/${input.commentId}/replies`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: input.message, access_token: token }),
    });
    return { status: "sent", error: null };
  } catch (cause) {
    return { status: "failed", error: cause instanceof Error ? cause.message : "bilinmeyen hata" };
  }
}

/* ------------------------------------------------------------------ */
/* Gelen kutusu görüşmesi                                              */
/* ------------------------------------------------------------------ */

async function upsertIgConversation(
  admin: Admin,
  storeId: string,
  input: { igUserId: string; username: string | null },
) {
  const { data: existing } = await admin
    .from("omni_conversations")
    .select("*")
    .eq("store_id", storeId)
    .eq("channel", "instagram")
    .eq("external_id", input.igUserId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await admin
    .from("omni_conversations")
    .insert({
      store_id: storeId,
      channel: "instagram",
      external_id: input.igUserId,
      participant_handle: input.username ?? input.igUserId,
      participant_name: input.username,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function recordInbound(
  admin: Admin,
  storeId: string,
  conversationId: string,
  input: { body: string; externalId: string | null },
) {
  const { error } = await admin.from("omni_messages").insert({
    store_id: storeId,
    conversation_id: conversationId,
    direction: "inbound",
    body: input.body,
    status: "delivered",
    external_id: input.externalId,
  });
  if (error) throw new Error(error.message);

  const { data: conversation } = await admin
    .from("omni_conversations")
    .select("message_count, unread_count")
    .eq("id", conversationId)
    .maybeSingle();

  await admin
    .from("omni_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: input.body.slice(0, 200),
      message_count: (conversation?.message_count ?? 0) + 1,
      unread_count: (conversation?.unread_count ?? 0) + 1,
      status: "open",
    })
    .eq("id", conversationId);
}

/* ------------------------------------------------------------------ */
/* CRM profili                                                         */
/* ------------------------------------------------------------------ */

/** DM panelinin sağ sütununda gösterilecek 360° müşteri profili. */
export async function loadSocialCrmProfile(
  client: Client,
  storeId: string,
  conversationId: string,
) {
  const { data: conversation, error } = await client
    .from("omni_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!conversation) throw new Error("Görüşme bulunamadı");

  let customer: Database["public"]["Tables"]["customers"]["Row"] | null = null;
  if (conversation.customer_id) {
    const { data } = await client
      .from("customers")
      .select("*")
      .eq("id", conversation.customer_id)
      .maybeSingle();
    customer = data ?? null;
  }
  if (!customer && conversation.participant_name) {
    const { data } = await client
      .from("customers")
      .select("*")
      .eq("store_id", storeId)
      .ilike("full_name", `%${conversation.participant_name}%`)
      .limit(1)
      .maybeSingle();
    customer = data ?? null;
  }

  const orders = customer
    ? (
        await client
          .from("orders")
          .select("id, order_number, status, fulfillment_status, grand_total, currency, tracking_number, created_at")
          .eq("store_id", storeId)
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(5)
      ).data ?? []
    : [];

  const openCarts = customer?.email
    ? (
        await client
          .from("abandoned_carts")
          .select("id, total, currency, item_count, last_seen_at")
          .eq("store_id", storeId)
          .eq("customer_email", customer.email)
          .is("recovered_order_id", null)
          .order("last_seen_at", { ascending: false })
          .limit(3)
      ).data ?? []
    : [];

  const segment = deriveSegment({
    ordersCount: customer?.orders_count ?? 0,
    totalSpent: Number(customer?.total_spent ?? 0),
    lastActivityAt: customer?.last_activity_at ?? null,
  });

  return {
    conversation,
    customer,
    orders,
    openCarts,
    segment,
    lifetimeValue: Number(customer?.total_spent ?? 0),
    averageOrderValue:
      customer && customer.orders_count > 0
        ? Number(customer.total_spent) / customer.orders_count
        : 0,
  };
}

/* ------------------------------------------------------------------ */
/* AI yanıt                                                            */
/* ------------------------------------------------------------------ */

/** DM için AI yanıtı üretir; otonom modda güven eşiği kontrol edilir. */
export async function generateIgReply(
  admin: Admin,
  options: { storeId: string; conversationId: string; text: string },
): Promise<{ text: string; intent: string; confidence: number }> {
  const settings = await loadStoreAiSettings(admin, options.storeId);
  const { intent, confidence } = classifyIntent(options.text);
  if (!settings.isEnabled) throw new Error("Bu mağaza için AI kullanımı kapalı");

  const used = await monthlyTokenUsage(admin, options.storeId);
  if (settings.monthlyTokenLimit > 0 && used >= settings.monthlyTokenLimit) {
    throw new Error("Bu ay için AI token limitiniz doldu.");
  }

  const profile = await loadSocialCrmProfile(admin, options.storeId, options.conversationId);
  const { data: history } = await admin
    .from("omni_messages")
    .select("direction, body")
    .eq("conversation_id", options.conversationId)
    .order("created_at", { ascending: false })
    .limit(10);

  const context = [
    `Kanal: Instagram DM`,
    `Tespit edilen niyet: ${intent}`,
    `Müşteri segmenti: ${profile.segment}`,
    profile.customer
      ? `Sipariş sayısı: ${profile.customer.orders_count}, yaşam boyu değer: ${profile.lifetimeValue}`
      : "Kayıtlı müşteri bulunamadı.",
    profile.orders[0]
      ? `Son sipariş: ${profile.orders[0].order_number} — durum ${profile.orders[0].status}` +
        (profile.orders[0].tracking_number ? `, takip no ${profile.orders[0].tracking_number}` : "")
      : "Aktif sipariş yok.",
    profile.openCarts[0] ? `Sepette bekleyen ${profile.openCarts[0].item_count} ürün var.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Sen bir e-ticaret mağazasının Instagram DM temsilcisisin. Kısa (en fazla 3 cümle), samimi ve emoji kullanan Türkçe yanıtlar yaz. Uydurma bilgi verme; yalnızca verilen bağlamı kullan. Bilmiyorsan bir temsilciye aktaracağını söyle.",
    },
    { role: "system", content: context },
    ...[...(history ?? [])].reverse().map((row) => ({
      role: row.direction === "outbound" ? ("assistant" as const) : ("user" as const),
      content: row.body,
    })),
  ];

  const result = await callProvider({
    purpose: "text",
    charge: { storeId: options.storeId, userId: null, task: "instagram_reply" },
    messages,
    temperature: settings.creativity,
    maxTokens: 400,
  });

  await admin.from("ai_generations").insert({
    store_id: options.storeId,
    task: "instagram_reply",
    provider_code: settings.providerCode,
    model: settings.model,
    prompt: context.slice(0, 8000),
    output: result.text.slice(0, 20000),
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    total_tokens: result.inputTokens + result.outputTokens,
    duration_ms: 0,
    status: "success",
  });

  return { text: result.text.trim(), intent, confidence };
}

/* ------------------------------------------------------------------ */
/* Olay işleyiciler                                                    */
/* ------------------------------------------------------------------ */

async function resolveStoreId(admin: Admin, igId: string): Promise<string | null> {
  if (!igId) return null;
  const { data } = await admin
    .from("instagram_accounts")
    .select("store_id")
    .or(`ig_user_id.eq.${igId},page_id.eq.${igId}`)
    .maybeSingle();
  return data?.store_id ?? null;
}

/** Yorum olayını kurallarla eşleştirir; DM ve herkese açık yanıtı gönderir. */
async function handleCommentEvent(admin: Admin, storeId: string, value: Record<string, unknown>) {
  const commentId = String(value["id"] ?? "");
  const text = String(value["text"] ?? "");
  const from = value["from"] as { id?: string; username?: string } | undefined;
  const mediaId = (value["media"] as { id?: string } | undefined)?.id ?? null;

  const account = await getInstagramAccount(admin, storeId);
  if (!account?.auto_comment_dm_enabled) {
    return { skipped: "otomatik yorum→DM kapalı" };
  }

  const { data: rules, error } = await admin
    .from("instagram_comment_rules")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("priority", { ascending: true });
  if (error) throw new Error(error.message);

  const rule = (rules ?? []).find((candidate) => {
    if (candidate.target_post_id && mediaId && candidate.target_post_id !== mediaId) return false;
    return matchKeyword(text, candidate.keywords, candidate.match_type as IgMatchType) !== null;
  });

  const matched = rule
    ? matchKeyword(text, rule.keywords, rule.match_type as IgMatchType)
    : null;

  if (!rule) {
    await admin.from("instagram_interactions").upsert(
      {
        store_id: storeId,
        kind: "comment",
        post_id: mediaId,
        comment_id: commentId,
        ig_user_id: from?.id ?? null,
        username: from?.username ?? null,
        text,
        dm_status: "skipped",
        reply_status: "skipped",
      },
      { onConflict: "comment_id", ignoreDuplicates: true },
    );
    return { matched: false };
  }

  const product = rule.product_id ? await buildProductLink(admin, storeId, rule.product_id) : null;
  const vars = {
    name: from?.username ?? "değerli müşterimiz",
    keyword: matched ?? "",
    product: product?.title ?? "",
    price: product ? `${product.price} ${product.currency}` : "",
    link: product?.url ?? "",
    cart: product?.cartUrl ?? "",
    stock: product ? (product.inStock ? "stokta" : "stokta değil") : "",
  };

  let dmBody = renderTemplate(rule.dm_template, vars);
  if (rule.send_product_card && product) {
    dmBody += `\n\n${product.title} — ${product.price} ${product.currency} (${vars.stock})\nÜrün: ${product.url}\nHemen sepete ekle: ${product.cartUrl}`;
  }

  let dmStatus: string = "skipped";
  let dmError: string | null = null;
  let conversationId: string | null = null;

  if (from?.id) {
    const conversation = await upsertIgConversation(admin, storeId, {
      igUserId: from.id,
      username: from.username ?? null,
    });
    conversationId = conversation.id;

    const sent = await sendInstagramDm(admin, {
      storeId,
      recipientId: from.id,
      text: dmBody,
    });
    dmStatus = sent.status;
    dmError = sent.error;

    await admin.from("omni_messages").insert({
      store_id: storeId,
      conversation_id: conversation.id,
      direction: "outbound",
      body: dmBody,
      status: sent.status,
      is_ai: false,
      external_id: sent.externalId,
      error: sent.error,
    });
  }

  let replyStatus: string = "skipped";
  if (rule.reply_to_comment && rule.public_reply.trim() && commentId) {
    const reply = await replyToInstagramComment(admin, {
      storeId,
      commentId,
      message: renderTemplate(rule.public_reply, vars),
    });
    replyStatus = reply.status;
  }

  await admin.from("instagram_interactions").upsert(
    {
      store_id: storeId,
      rule_id: rule.id,
      conversation_id: conversationId,
      kind: "comment",
      post_id: mediaId,
      comment_id: commentId,
      ig_user_id: from?.id ?? null,
      username: from?.username ?? null,
      text,
      matched_keyword: matched,
      dm_status: dmStatus,
      reply_status: replyStatus,
      error: dmError,
    },
    { onConflict: "comment_id" },
  );

  await admin
    .from("instagram_comment_rules")
    .update({
      triggered_count: rule.triggered_count + 1,
      dm_sent_count: rule.dm_sent_count + (dmStatus === "sent" ? 1 : 0),
    })
    .eq("id", rule.id);

  return { matched: true, ruleId: rule.id, dmStatus, replyStatus };
}

/** Gelen DM / hikâye yanıtını kaydeder, gerekiyorsa otonom AI yanıtı gönderir. */
async function handleMessageEvent(
  admin: Admin,
  storeId: string,
  eventType: string,
  event: Record<string, unknown>,
) {
  const sender = (event["sender"] as { id?: string } | undefined)?.id ?? null;
  const message = event["message"] as { mid?: string; text?: string } | undefined;
  if (!sender || !message?.text) return { skipped: "metin içermeyen mesaj" };

  const conversation = await upsertIgConversation(admin, storeId, {
    igUserId: sender,
    username: null,
  });
  await recordInbound(admin, storeId, conversation.id, {
    body: message.text,
    externalId: message.mid ?? null,
  });

  const account = await getInstagramAccount(admin, storeId);
  const { intent, confidence } = classifyIntent(message.text);

  await admin.from("instagram_interactions").insert({
    store_id: storeId,
    conversation_id: conversation.id,
    kind: eventType === "story_reply" ? "story_reply" : "dm",
    ig_user_id: sender,
    text: message.text,
    matched_keyword: intent,
    dm_status: "received",
    reply_status: "pending",
  });

  if (!account?.autonomous_ai_enabled) return { intent, autonomous: false };
  if (confidence < Number(account.ai_confidence_threshold ?? 0.7)) {
    return { intent, autonomous: false, reason: "güven eşiği altında" };
  }

  try {
    const reply = await generateIgReply(admin, {
      storeId,
      conversationId: conversation.id,
      text: message.text,
    });
    const sent = await sendInstagramDm(admin, { storeId, recipientId: sender, text: reply.text });
    await admin.from("omni_messages").insert({
      store_id: storeId,
      conversation_id: conversation.id,
      direction: "outbound",
      body: reply.text,
      status: sent.status,
      is_ai: true,
      external_id: sent.externalId,
      error: sent.error,
    });
    return { intent, autonomous: true, status: sent.status };
  } catch (cause) {
    return {
      intent,
      autonomous: false,
      reason: cause instanceof Error ? cause.message : "AI yanıtı üretilemedi",
    };
  }
}

/** Kuyruktaki bekleyen olayları sırayla işler (cron worker tarafından çağrılır). */
export async function processInstagramEvents(admin: Admin, limit = 25) {
  const { data: events, error } = await admin
    .from("instagram_events")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", 5)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const results: { id: string; ok: boolean; detail?: unknown }[] = [];

  for (const event of events ?? []) {
    const payload = (event.payload ?? {}) as Record<string, unknown>;
    try {
      const storeId =
        event.store_id ?? (await resolveStoreId(admin, String(payload["igId"] ?? "")));
      if (!storeId) throw new Error("Olayın mağazası eşleştirilemedi");

      const detail =
        event.event_type === "comment" || event.event_type === "mention"
          ? await handleCommentEvent(admin, storeId, (payload["value"] as Record<string, unknown>) ?? {})
          : await handleMessageEvent(
              admin,
              storeId,
              event.event_type,
              (payload["event"] as Record<string, unknown>) ?? {},
            );

      await admin
        .from("instagram_events")
        .update({
          status: "processed",
          store_id: storeId,
          attempts: event.attempts + 1,
          processed_at: new Date().toISOString(),
          error: null,
        })
        .eq("id", event.id);
      results.push({ id: event.id, ok: true, detail });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "bilinmeyen hata";
      const attempts = event.attempts + 1;
      await admin
        .from("instagram_events")
        .update({
          status: attempts >= 5 ? "failed" : "pending",
          attempts,
          error: message.slice(0, 1000),
        })
        .eq("id", event.id);
      results.push({ id: event.id, ok: false, detail: message });
    }
  }

  return { processed: results.length, results };
}
