import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { loadStoreAiSettings, monthlyTokenUsage, callProvider, type ChatMessage } from "@/lib/ai.server";
import {
  TIKTOK_SCOPES,
  classifyTtIntent,
  deriveTtSegment,
  matchTtKeyword,
  renderTtTemplate,
  type TtMatchType,
} from "@/lib/tiktok";

/**
 * TikTok DM & Social Inbox servis katmanı (yalnızca sunucu).
 *
 * Akış: TikTok webhook → `tiktok_events` kuyruğu (idempotent, dış kimlik tekil)
 * → cron worker → yorum/canlı yayın kural motoru veya DM işleyici
 * → `omni_conversations` (Mesaj Merkezi ile aynı gelen kutusu)
 * + `tiktok_interactions` denetim izi.
 *
 * Erişim anahtarları `tiktok_credentials` tablosunda tutulur; tablonun
 * authenticated politikası yoktur, yani panel istemcisi anahtarları hiç görmez.
 */

type Client = SupabaseClient<Database>;
type Admin = Client;

export type TtAccount = Database["public"]["Tables"]["tiktok_accounts"]["Row"];
export type TtRule = Database["public"]["Tables"]["tiktok_comment_rules"]["Row"];

const OPEN_API = "https://open.tiktokapis.com/v2";
const GATEWAY = "https://connector-gateway.lovable.dev/tiktok";

/* ------------------------------------------------------------------ */
/* Uygulama yapılandırması                                             */
/* ------------------------------------------------------------------ */

export function tiktokAppConfig() {
  return {
    clientKey: process.env["TIKTOK_CLIENT_KEY"] ?? null,
    clientSecret: process.env["TIKTOK_CLIENT_SECRET"] ?? null,
    /** Lovable connector gateway kullanılıyorsa dolu olur. */
    connectorKey: process.env["TIKTOK_API_KEY"] ?? null,
    lovableKey: process.env["LOVABLE_API_KEY"] ?? null,
  };
}

function useGateway(): boolean {
  const config = tiktokAppConfig();
  return Boolean(config.connectorKey && config.lovableKey);
}

/** TikTok Business OAuth2 onay adresi. */
export function buildTiktokOAuthUrl(redirectUri: string, state: string): string {
  const { clientKey } = tiktokAppConfig();
  if (!clientKey) throw new Error("TikTok uygulama anahtarı (TIKTOK_CLIENT_KEY) tanımlı değil.");
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("scope", TIKTOK_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * TikTok Open API çağrısı.
 * Bağlı bir Lovable connector varsa istek gateway üzerinden gider (token'ı
 * gateway enjekte eder); yoksa mağazanın kendi erişim anahtarı kullanılır.
 */
async function tiktokFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const config = tiktokAppConfig();
  const gateway = useGateway();
  const headers: Record<string, string> = { "content-type": "application/json" };

  if (gateway) {
    headers["Authorization"] = `Bearer ${config.lovableKey}`;
    headers["X-Connection-Api-Key"] = config.connectorKey as string;
  } else {
    if (!options.token) throw new Error("TikTok erişim anahtarı tanımlı değil.");
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const response = await fetch(`${gateway ? GATEWAY : OPEN_API}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`TikTok API hatası (${response.status}): ${text.slice(0, 400)}`);
  }
  const parsed = text ? (JSON.parse(text) as { error?: { code?: string; message?: string } }) : {};
  if (parsed.error?.code && parsed.error.code !== "ok") {
    throw new Error(`TikTok API hatası: ${parsed.error.message ?? parsed.error.code}`);
  }
  return parsed as T;
}

/** Yetkilendirme kodunu erişim/yenileme anahtarına çevirir ve profili okur. */
export async function exchangeTiktokCode(code: string, redirectUri: string) {
  const { clientKey, clientSecret } = tiktokAppConfig();
  if (!clientKey || !clientSecret) throw new Error("TikTok uygulama bilgileri tanımlı değil.");

  const tokenResponse = await fetch(`${OPEN_API}/oauth/token/`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }).toString(),
  });
  const tokenText = await tokenResponse.text();
  if (!tokenResponse.ok) {
    throw new Error(`TikTok token hatası (${tokenResponse.status}): ${tokenText.slice(0, 300)}`);
  }
  const token = JSON.parse(tokenText) as {
    access_token: string;
    refresh_token?: string;
    open_id: string;
    expires_in?: number;
    refresh_expires_in?: number;
    scope?: string;
  };

  let username: string | null = null;
  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  let unionId: string | null = null;
  try {
    const profile = await tiktokFetch<{
      data?: { user?: { union_id?: string; username?: string; display_name?: string; avatar_url?: string } };
    }>("/user/info/?fields=open_id,union_id,username,display_name,avatar_url", {
      token: token.access_token,
    });
    username = profile.data?.user?.username ?? null;
    displayName = profile.data?.user?.display_name ?? null;
    avatarUrl = profile.data?.user?.avatar_url ?? null;
    unionId = profile.data?.user?.union_id ?? null;
  } catch {
    // Profil alanları izin verilmemişse hesabı yine de bağlarız.
  }

  return {
    openId: token.open_id,
    unionId,
    username,
    displayName,
    avatarUrl,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresAt: token.expires_in
      ? new Date(Date.now() + token.expires_in * 1000).toISOString()
      : null,
    refreshExpiresAt: token.refresh_expires_in
      ? new Date(Date.now() + token.refresh_expires_in * 1000).toISOString()
      : null,
  };
}

/* ------------------------------------------------------------------ */
/* Hesap & anahtar yönetimi                                           */
/* ------------------------------------------------------------------ */

export async function getTiktokAccount(client: Client, storeId: string) {
  const { data, error } = await client
    .from("tiktok_accounts")
    .select("*")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertTiktokAccount(
  admin: Admin,
  storeId: string,
  input: {
    openId: string;
    unionId?: string | null;
    username?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: string | null;
    refreshExpiresAt?: string | null;
  },
) {
  const existing = await getTiktokAccount(admin, storeId);

  const payload = {
    store_id: storeId,
    open_id: input.openId,
    union_id: input.unionId ?? null,
    username: input.username ?? null,
    display_name: input.displayName ?? null,
    avatar_url: input.avatarUrl ?? null,
    scopes: [...TIKTOK_SCOPES],
    status: "connected",
    status_message: "Hesap bağlı, webhook olayları dinleniyor.",
    token_expires_at: input.expiresAt ?? null,
  };

  const { data: account, error } = existing
    ? await admin.from("tiktok_accounts").update(payload).eq("id", existing.id).select("*").single()
    : await admin.from("tiktok_accounts").insert(payload).select("*").single();
  if (error) throw new Error(error.message);

  const { error: credentialError } = await admin.from("tiktok_credentials").upsert(
    {
      store_id: storeId,
      account_id: account.id,
      access_token: input.accessToken,
      refresh_token: input.refreshToken ?? null,
      expires_at: input.expiresAt ?? null,
      refresh_expires_at: input.refreshExpiresAt ?? null,
    },
    { onConflict: "account_id" },
  );
  if (credentialError) throw new Error(credentialError.message);

  return account;
}

async function loadTiktokToken(admin: Admin, accountId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("tiktok_credentials")
    .select("access_token")
    .eq("account_id", accountId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.access_token ?? null;
}

/* ------------------------------------------------------------------ */
/* Webhook doğrulama & kuyruk                                          */
/* ------------------------------------------------------------------ */

/**
 * TikTok `TikTok-Signature: t=<timestamp>,s=<hmac>` başlığını doğrular.
 * HMAC-SHA256(client_secret, "<timestamp>.<rawBody>") sabit zamanlı karşılaştırılır.
 */
export async function verifyTiktokSignature(
  rawBody: string,
  headerValue: string | null,
): Promise<boolean> {
  const { clientSecret } = tiktokAppConfig();
  if (!clientSecret || !headerValue) return false;

  const parts = Object.fromEntries(
    headerValue
      .split(",")
      .map((chunk) => chunk.trim().split("="))
      .filter((pair): pair is [string, string] => pair.length === 2),
  );
  const timestamp = parts["t"];
  const provided = parts["s"];
  if (!timestamp || !provided) return false;

  // 5 dakikadan eski imzaları reddet (replay koruması).
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", clientSecret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
}

type QueuedEvent = {
  eventType: string;
  externalId: string | null;
  payload: Record<string, unknown>;
};

/**
 * TikTok webhook gövdesini kuyruğa alınacak olaylara böler.
 * Desteklenen `event` değerleri: direct_message.received, comment.created,
 * live.comment, live.gift, mention.created.
 */
export function parseTiktokWebhookPayload(body: unknown): QueuedEvent[] {
  const events: QueuedEvent[] = [];
  const root = body as Record<string, unknown> | null;
  if (!root) return events;

  const batch = Array.isArray(root["events"])
    ? (root["events"] as Record<string, unknown>[])
    : [root];

  for (const item of batch) {
    const name = String(item["event"] ?? item["event_type"] ?? "");
    const content =
      (item["content"] as Record<string, unknown> | undefined) ??
      (item["data"] as Record<string, unknown> | undefined) ??
      {};
    const parsed =
      typeof item["content"] === "string"
        ? (safeJson(item["content"] as string) ?? {})
        : content;

    const eventType =
      name.includes("direct_message") || name === "message"
        ? "message"
        : name.startsWith("live.comment") || name === "live_comment"
          ? "live_comment"
          : name.startsWith("live.gift") || name === "live_gift"
            ? "live_gift"
            : name.includes("mention")
              ? "mention"
              : name.includes("comment")
                ? "comment"
                : null;
    if (!eventType) continue;

    const externalId =
      (parsed["message_id"] as string | undefined) ??
      (parsed["comment_id"] as string | undefined) ??
      (parsed["id"] as string | undefined) ??
      null;

    events.push({
      eventType,
      externalId,
      payload: {
        openId: String(item["user_openid"] ?? item["open_id"] ?? parsed["open_id"] ?? ""),
        value: parsed,
      },
    });
  }

  return events;
}

function safeJson(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Olayları kuyruğa alır; aynı dış kimlik tekrar gelirse yok sayılır (idempotent). */
export async function enqueueTiktokEvents(
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
    .from("tiktok_events")
    .upsert(rows, { onConflict: "event_type,external_id", ignoreDuplicates: true })
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

async function resolveStoreIdByOpenId(admin: Admin, openId: string): Promise<string | null> {
  if (!openId) return null;
  const { data } = await admin
    .from("tiktok_accounts")
    .select("store_id")
    .eq("open_id", openId)
    .maybeSingle();
  return data?.store_id ?? null;
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

type SendResult = {
  status: "sent" | "queued" | "failed";
  error: string | null;
  externalId: string | null;
};

/** TikTok Direct Messages API üzerinden DM gönderir. */
export async function sendTiktokDm(
  admin: Admin,
  input: { storeId: string; recipientId: string; text: string },
): Promise<SendResult> {
  const account = await getTiktokAccount(admin, input.storeId);
  if (!account) return { status: "queued", error: "TikTok hesabı bağlı değil", externalId: null };

  const token = await loadTiktokToken(admin, account.id);
  if (!token && !useGateway()) {
    return { status: "queued", error: "Erişim anahtarı tanımlı değil", externalId: null };
  }

  try {
    const result = await tiktokFetch<{ data?: { message_id?: string } }>("/direct_message/send/", {
      method: "POST",
      token,
      body: {
        business_id: account.open_id,
        recipient_id: input.recipientId,
        message: { type: "text", text: input.text },
      },
    });
    return { status: "sent", error: null, externalId: result.data?.message_id ?? null };
  } catch (cause) {
    return {
      status: "failed",
      error: cause instanceof Error ? cause.message : "bilinmeyen hata",
      externalId: null,
    };
  }
}

/** Video yorumunun altına herkese açık yanıt bırakır. */
export async function replyToTiktokComment(
  admin: Admin,
  input: { storeId: string; commentId: string; videoId: string | null; message: string },
): Promise<{ status: "sent" | "queued" | "failed"; error: string | null }> {
  const account = await getTiktokAccount(admin, input.storeId);
  if (!account) return { status: "queued", error: "TikTok hesabı bağlı değil" };
  const token = await loadTiktokToken(admin, account.id);
  if (!token && !useGateway()) return { status: "queued", error: "Erişim anahtarı tanımlı değil" };

  try {
    await tiktokFetch("/video/comment/reply/", {
      method: "POST",
      token,
      body: {
        comment_id: input.commentId,
        video_id: input.videoId,
        text: input.message,
      },
    });
    return { status: "sent", error: null };
  } catch (cause) {
    return { status: "failed", error: cause instanceof Error ? cause.message : "bilinmeyen hata" };
  }
}

/**
 * Commercial Content API üzerinden video veya canlı yayına anlık ürün
 * yönlendirme kartı tetikler.
 */
export async function pushTiktokProductCard(
  admin: Admin,
  input: { storeId: string; videoId: string | null; liveRoomId: string | null; productUrl: string; title: string },
): Promise<{ status: "sent" | "queued" | "failed"; error: string | null }> {
  const account = await getTiktokAccount(admin, input.storeId);
  if (!account) return { status: "queued", error: "TikTok hesabı bağlı değil" };
  const token = await loadTiktokToken(admin, account.id);
  if (!token && !useGateway()) return { status: "queued", error: "Erişim anahtarı tanımlı değil" };

  try {
    await tiktokFetch("/commercial_content/showcase/", {
      method: "POST",
      token,
      body: {
        business_id: account.open_id,
        ...(input.videoId ? { video_id: input.videoId } : {}),
        ...(input.liveRoomId ? { room_id: input.liveRoomId } : {}),
        anchor: { title: input.title.slice(0, 60), url: input.productUrl },
      },
    });
    return { status: "sent", error: null };
  } catch (cause) {
    return { status: "failed", error: cause instanceof Error ? cause.message : "bilinmeyen hata" };
  }
}

/* ------------------------------------------------------------------ */
/* Gelen kutusu görüşmesi                                              */
/* ------------------------------------------------------------------ */

async function upsertTtConversation(
  admin: Admin,
  storeId: string,
  input: { tiktokUserId: string; username: string | null },
) {
  const { data: existing } = await admin
    .from("omni_conversations")
    .select("*")
    .eq("store_id", storeId)
    .eq("channel", "tiktok")
    .eq("external_id", input.tiktokUserId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await admin
    .from("omni_conversations")
    .insert({
      store_id: storeId,
      channel: "tiktok",
      external_id: input.tiktokUserId,
      participant_handle: input.username ?? input.tiktokUserId,
      participant_name: input.username,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function recordTtInbound(
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

/** TikTok DM panelinin sağ sütununda gösterilecek 360° müşteri profili. */
export async function loadTiktokCrmProfile(
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
  // @username ile müşteri eşleştirme (ad veya not alanında geçen kullanıcı adı).
  if (!customer && conversation.participant_handle) {
    const handle = conversation.participant_handle.replace(/^@/, "");
    const { data } = await client
      .from("customers")
      .select("*")
      .eq("store_id", storeId)
      .ilike("full_name", `%${handle}%`)
      .limit(1)
      .maybeSingle();
    customer = data ?? null;
  }

  const orders = customer
    ? ((
        await client
          .from("orders")
          .select(
            "id, order_number, status, fulfillment_status, grand_total, currency, tracking_number, created_at",
          )
          .eq("store_id", storeId)
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(5)
      ).data ?? [])
    : [];

  const returns = customer
    ? ((
        await client
          .from("return_requests")
          .select("id, status, reason, created_at")
          .eq("store_id", storeId)
          .eq("customer_id", customer.id)
          .order("created_at", { ascending: false })
          .limit(3)
      ).data ?? [])
    : [];

  const openCarts = customer?.email
    ? ((
        await client
          .from("abandoned_carts")
          .select("id, total, currency, item_count, last_seen_at")
          .eq("store_id", storeId)
          .eq("customer_email", customer.email)
          .is("recovered_order_id", null)
          .order("last_seen_at", { ascending: false })
          .limit(3)
      ).data ?? [])
    : [];

  const segment = deriveTtSegment({
    ordersCount: customer?.orders_count ?? 0,
    totalSpent: Number(customer?.total_spent ?? 0),
    lastActivityAt: customer?.last_activity_at ?? null,
  });

  return {
    conversation,
    customer,
    orders,
    returns,
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

/** TikTok kitlesine uygun, samimi ve satışa dönüştürücü AI yanıtı üretir. */
export async function generateTiktokReply(
  admin: Admin,
  options: { storeId: string; conversationId: string; text: string },
): Promise<{ text: string; intent: string; confidence: number }> {
  const settings = await loadStoreAiSettings(admin, options.storeId);
  const { intent, confidence } = classifyTtIntent(options.text);
  if (!settings.isEnabled) throw new Error("Bu mağaza için AI kullanımı kapalı");

  const used = await monthlyTokenUsage(admin, options.storeId);
  if (settings.monthlyTokenLimit > 0 && used >= settings.monthlyTokenLimit) {
    throw new Error("Bu ay için AI token limitiniz doldu.");
  }

  const profile = await loadTiktokCrmProfile(admin, options.storeId, options.conversationId);
  const { data: history } = await admin
    .from("omni_messages")
    .select("direction, body")
    .eq("conversation_id", options.conversationId)
    .order("created_at", { ascending: false })
    .limit(10);

  const context = [
    "Kanal: TikTok DM",
    `Tespit edilen niyet: ${intent}`,
    `Müşteri segmenti: ${profile.segment}`,
    `Yaşam boyu değer: ${profile.lifetimeValue}`,
    profile.orders.length > 0
      ? `Son sipariş: ${profile.orders[0]?.order_number} (${profile.orders[0]?.status}) kargo takip: ${profile.orders[0]?.tracking_number ?? "yok"}`
      : "Sipariş geçmişi yok",
    profile.returns.length > 0 ? `Açık iade talebi: ${profile.returns[0]?.status}` : "",
    profile.openCarts.length > 0
      ? `Terk edilmiş sepet: ${profile.openCarts[0]?.item_count} ürün / ${profile.openCarts[0]?.total}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "Sen bir Türk e-ticaret markasının TikTok müşteri temsilcisisin. TikTok kitlesine uygun " +
        "kısa, samimi, enerjik ve emoji kullanan bir tonda yaz. Asla uydurma fiyat, stok veya " +
        "kargo bilgisi verme; verilen bağlamdan yararlan. Satın almaya nazikçe yönlendir. " +
        "En fazla 3 kısa cümle kullan.",
    },
    { role: "system", content: `Müşteri bağlamı:\n${context}` },
    ...((history ?? [])
      .slice()
      .reverse()
      .map((row) => ({
        role: row.direction === "inbound" ? ("user" as const) : ("assistant" as const),
        content: row.body ?? "",
      })) satisfies ChatMessage[]),
    { role: "user", content: options.text },
  ];

  const result = await callProvider({
    purpose: "text",
    charge: { storeId: options.storeId, userId: null, task: "tiktok_reply" },
    messages,
    temperature: settings.creativity,
    maxTokens: 400,
  });

  await admin.from("ai_generations").insert({
    store_id: options.storeId,
    task: "tiktok_reply",
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
/* Kural motoru                                                        */
/* ------------------------------------------------------------------ */

/** Video veya canlı yayın yorumunu kural motorundan geçirir. */
async function handleTtCommentEvent(
  admin: Admin,
  storeId: string,
  eventType: string,
  value: Record<string, unknown>,
) {
  const account = await getTiktokAccount(admin, storeId);
  const isLive = eventType === "live_comment";
  if (isLive && account && !account.live_automation_enabled) {
    return { skipped: "canlı yayın otomasyonu kapalı" };
  }
  if (account && !account.auto_comment_dm_enabled) {
    return { skipped: "yorum otomasyonu kapalı" };
  }

  const text = String(value["text"] ?? value["comment_text"] ?? "");
  const commentId = (value["comment_id"] as string | undefined) ?? (value["id"] as string | undefined) ?? null;
  const videoId = (value["video_id"] as string | undefined) ?? null;
  const liveRoomId = (value["room_id"] as string | undefined) ?? null;
  const userId =
    (value["from_user_id"] as string | undefined) ??
    (value["user_id"] as string | undefined) ??
    (value["open_id"] as string | undefined) ??
    null;
  const username =
    (value["unique_id"] as string | undefined) ?? (value["username"] as string | undefined) ?? null;
  if (!text) return { skipped: "metin içermeyen yorum" };

  const { data: rules, error } = await admin
    .from("tiktok_comment_rules")
    .select("*")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .order("priority", { ascending: true });
  if (error) throw new Error(error.message);

  const rule = (rules ?? []).find((candidate) => {
    if (candidate.source === "live" && !isLive) return false;
    if (candidate.source === "video" && isLive) return false;
    if (candidate.target_video_id && videoId && candidate.target_video_id !== videoId) return false;
    return matchTtKeyword(text, candidate.keywords, candidate.match_type as TtMatchType) !== null;
  });

  const matched = rule ? matchTtKeyword(text, rule.keywords, rule.match_type as TtMatchType) : null;

  if (!rule) {
    await admin.from("tiktok_interactions").upsert(
      {
        store_id: storeId,
        kind: isLive ? "live_comment" : "comment",
        video_id: videoId,
        comment_id: commentId,
        live_room_id: liveRoomId,
        tiktok_user_id: userId,
        username,
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
    name: username ?? "dostum",
    keyword: matched ?? "",
    product: product?.title ?? "",
    price: product ? `${product.price} ${product.currency}` : "",
    link: product?.url ?? "",
    cart: product?.cartUrl ?? "",
    stock: product ? (product.inStock ? "stokta" : "stokta değil") : "",
  };

  let dmBody = renderTtTemplate(rule.dm_template, vars);
  if (rule.send_product_card && product) {
    dmBody += `\n\n${product.title} — ${product.price} ${product.currency} (${vars.stock})\nÜrün: ${product.url}\nHemen sepete ekle: ${product.cartUrl}`;
  }

  let dmStatus: string = "skipped";
  let dmError: string | null = null;
  let conversationId: string | null = null;

  if (userId) {
    const conversation = await upsertTtConversation(admin, storeId, {
      tiktokUserId: userId,
      username,
    });
    conversationId = conversation.id;

    const sent = await sendTiktokDm(admin, { storeId, recipientId: userId, text: dmBody });
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
    const reply = await replyToTiktokComment(admin, {
      storeId,
      commentId,
      videoId,
      message: renderTtTemplate(rule.public_reply, vars),
    });
    replyStatus = reply.status;
  }

  // Video/canlı yayına anlık ürün yönlendirme kartı.
  if (rule.pin_product_card && product && (videoId || liveRoomId)) {
    await pushTiktokProductCard(admin, {
      storeId,
      videoId,
      liveRoomId,
      productUrl: product.url,
      title: product.title,
    });
  }

  await admin.from("tiktok_interactions").upsert(
    {
      store_id: storeId,
      rule_id: rule.id,
      conversation_id: conversationId,
      kind: isLive ? "live_comment" : "comment",
      video_id: videoId,
      comment_id: commentId,
      live_room_id: liveRoomId,
      tiktok_user_id: userId,
      username,
      text,
      matched_keyword: matched,
      dm_status: dmStatus,
      reply_status: replyStatus,
      error: dmError,
    },
    { onConflict: "comment_id" },
  );

  await admin
    .from("tiktok_comment_rules")
    .update({
      triggered_count: rule.triggered_count + 1,
      dm_sent_count: rule.dm_sent_count + (dmStatus === "sent" ? 1 : 0),
    })
    .eq("id", rule.id);

  return { matched: true, ruleId: rule.id, dmStatus, replyStatus };
}

/** Gelen DM'i kaydeder, gerekiyorsa otonom AI yanıtı gönderir. */
async function handleTtMessageEvent(
  admin: Admin,
  storeId: string,
  value: Record<string, unknown>,
) {
  const sender =
    (value["from_user_id"] as string | undefined) ??
    (value["sender_id"] as string | undefined) ??
    (value["open_id"] as string | undefined) ??
    null;
  const text = String(value["text"] ?? (value["message"] as { text?: string } | undefined)?.text ?? "");
  const messageId = (value["message_id"] as string | undefined) ?? null;
  const username =
    (value["unique_id"] as string | undefined) ?? (value["username"] as string | undefined) ?? null;
  if (!sender || !text) return { skipped: "metin içermeyen mesaj" };

  const conversation = await upsertTtConversation(admin, storeId, {
    tiktokUserId: sender,
    username,
  });
  await recordTtInbound(admin, storeId, conversation.id, { body: text, externalId: messageId });

  const account = await getTiktokAccount(admin, storeId);
  const { intent, confidence } = classifyTtIntent(text);

  await admin.from("tiktok_interactions").insert({
    store_id: storeId,
    conversation_id: conversation.id,
    kind: "dm",
    tiktok_user_id: sender,
    username,
    text,
    matched_keyword: intent,
    dm_status: "received",
    reply_status: "pending",
  });

  if (!account?.autonomous_ai_enabled) return { intent, autonomous: false };
  if (confidence < Number(account.ai_confidence_threshold ?? 0.7)) {
    return { intent, autonomous: false, reason: "güven eşiği altında" };
  }

  try {
    const reply = await generateTiktokReply(admin, {
      storeId,
      conversationId: conversation.id,
      text,
    });
    const sent = await sendTiktokDm(admin, { storeId, recipientId: sender, text: reply.text });
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
export async function processTiktokEvents(admin: Admin, limit = 25) {
  const { data: events, error } = await admin
    .from("tiktok_events")
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
        event.store_id ?? (await resolveStoreIdByOpenId(admin, String(payload["openId"] ?? "")));
      if (!storeId) throw new Error("Olayın mağazası eşleştirilemedi");

      const value = (payload["value"] as Record<string, unknown>) ?? {};
      const detail =
        event.event_type === "message"
          ? await handleTtMessageEvent(admin, storeId, value)
          : event.event_type === "live_gift"
            ? { skipped: "hediye olayı yalnızca kayıt için" }
            : await handleTtCommentEvent(admin, storeId, event.event_type, value);

      await admin
        .from("tiktok_events")
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
        .from("tiktok_events")
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
