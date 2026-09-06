import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { TT_MATCH_TYPES, TT_RULE_SOURCES } from "@/lib/tiktok";

/**
 * TikTok DM & Social Inbox server function'ları.
 * Erişim anahtarları yalnızca sunucu tarafında (`supabaseAdmin`) işlenir ve
 * hiçbir yanıtla istemciye dönmez.
 */

const storeScope = z.object({ storeId: z.guid() });

/** RLS üzerinden mağaza erişimini doğrular. */
async function assertStoreAccess(
  supabase: SupabaseClient<Database>,
  storeId: string,
  userId: string,
): Promise<void> {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(supabase, storeId, userId);
}


/** OAuth onay adresini üretir (TikTok uygulama bilgileri gerekli). */
export const getTiktokOAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.extend({ redirectUri: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId, context.userId);

    const { buildTiktokOAuthUrl, tiktokAppConfig } = await import("@/lib/tiktok.server");
    if (!tiktokAppConfig().clientKey) {
      throw new Error(
        "TikTok uygulama bilgileri henüz tanımlı değil. Bağlantıyı erişim anahtarını girerek de tamamlayabilirsin.",
      );
    }
    return { url: buildTiktokOAuthUrl(data.redirectUri, data.storeId) };
  });

/** OAuth kodunu anahtara çevirir ve hesabı bağlar. */
export const completeTiktokOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope.extend({ code: z.string().min(4), redirectUri: z.string().url() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId, context.userId);

    const [{ supabaseAdmin }, { exchangeTiktokCode, upsertTiktokAccount }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/tiktok.server"),
    ]);
    const credentials = await exchangeTiktokCode(data.code, data.redirectUri);
    const account = await upsertTiktokAccount(supabaseAdmin, data.storeId, credentials);
    return { id: account.id, username: account.username, status: account.status };
  });

/** Erişim anahtarını elle girerek hesabı bağlar (uygulama incelemesi öncesi). */
export const connectTiktokManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        openId: z.string().trim().min(3),
        username: z.string().trim().min(1).nullable().default(null),
        displayName: z.string().trim().min(1).nullable().default(null),
        accessToken: z.string().trim().min(20),
        refreshToken: z.string().trim().min(10).nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertStoreAccess(context.supabase, data.storeId, context.userId);

    const [{ supabaseAdmin }, { upsertTiktokAccount }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/tiktok.server"),
    ]);
    const account = await upsertTiktokAccount(supabaseAdmin, data.storeId, {
      openId: data.openId,
      username: data.username,
      displayName: data.displayName,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    });
    return { id: account.id, username: account.username, verifyToken: account.verify_token };
  });

/** Hesap ayarlarını (otomatik DM, canlı yayın, otonom AI, güven eşiği) günceller. */
export const updateTiktokSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        autoCommentDmEnabled: z.boolean().optional(),
        liveAutomationEnabled: z.boolean().optional(),
        autonomousAiEnabled: z.boolean().optional(),
        aiConfidenceThreshold: z.number().min(0.1).max(1).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.autoCommentDmEnabled !== undefined)
      patch["auto_comment_dm_enabled"] = data.autoCommentDmEnabled;
    if (data.liveAutomationEnabled !== undefined)
      patch["live_automation_enabled"] = data.liveAutomationEnabled;
    if (data.autonomousAiEnabled !== undefined)
      patch["autonomous_ai_enabled"] = data.autonomousAiEnabled;
    if (data.aiConfidenceThreshold !== undefined)
      patch["ai_confidence_threshold"] = data.aiConfidenceThreshold;

    const { error } = await context.supabase
      .from("tiktok_accounts")
      .update(patch as never)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectTiktok = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tiktok_accounts")
      .delete()
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ruleInput = storeScope.extend({
  ruleId: z.guid().optional(),
  name: z.string().trim().min(2).max(120),
  keywords: z.array(z.string().trim().min(1)).max(40).default([]),
  matchType: z.enum(TT_MATCH_TYPES).default("contains"),
  source: z.enum(TT_RULE_SOURCES).default("all"),
  targetVideoId: z.string().trim().max(64).nullable().default(null),
  productId: z.guid().nullable().default(null),
  dmTemplate: z.string().trim().min(4).max(1000),
  publicReply: z.string().trim().max(300).default(""),
  sendProductCard: z.boolean().default(true),
  replyToComment: z.boolean().default(true),
  pinProductCard: z.boolean().default(false),
  priority: z.number().int().min(1).max(999).default(100),
  isActive: z.boolean().default(true),
});

export const saveTiktokRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ruleInput.parse(data))
  .handler(async ({ data, context }) => {
    const payload = {
      store_id: data.storeId,
      name: data.name,
      keywords: data.keywords,
      match_type: data.matchType,
      source: data.source,
      target_video_id: data.targetVideoId,
      product_id: data.productId,
      dm_template: data.dmTemplate,
      public_reply: data.publicReply,
      send_product_card: data.sendProductCard,
      reply_to_comment: data.replyToComment,
      pin_product_card: data.pinProductCard,
      priority: data.priority,
      is_active: data.isActive,
    };

    const { data: row, error } = data.ruleId
      ? await context.supabase
          .from("tiktok_comment_rules")
          .update(payload)
          .eq("id", data.ruleId)
          .eq("store_id", data.storeId)
          .select("*")
          .single()
      : await context.supabase.from("tiktok_comment_rules").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTiktokRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.extend({ ruleId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tiktok_comment_rules")
      .delete()
      .eq("id", data.ruleId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Kural motorunu gerçek gönderim yapmadan test eder. */
export const testTiktokRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        comment: z.string().trim().min(1),
        source: z.enum(["video", "live"]).default("video"),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: rules, error } = await context.supabase
      .from("tiktok_comment_rules")
      .select("*")
      .eq("store_id", data.storeId)
      .eq("is_active", true)
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);

    const { matchTtKeyword, renderTtTemplate } = await import("@/lib/tiktok");
    for (const rule of rules ?? []) {
      if (rule.source !== "all" && rule.source !== data.source) continue;
      const matched = matchTtKeyword(data.comment, rule.keywords, rule.match_type as never);
      if (matched) {
        return {
          matched: true,
          ruleName: rule.name,
          keyword: matched,
          dm: renderTtTemplate(rule.dm_template, { name: "tiktok_kullanici", keyword: matched }),
          publicReply: rule.reply_to_comment ? rule.public_reply : null,
        };
      }
    }
    return { matched: false, ruleName: null, keyword: null, dm: null, publicReply: null };
  });

/** TikTok DM panelinin sağ sütunu için 360° müşteri profili. */
export const getTiktokCrmProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.extend({ conversationId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadTiktokCrmProfile } = await import("@/lib/tiktok.server");
    return loadTiktokCrmProfile(context.supabase, data.storeId, data.conversationId);
  });

/** AI yanıt önerisi üretir (otomatik göndermez). */
export const suggestTiktokReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({ conversationId: z.guid(), text: z.string().trim().min(1).max(2000) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: conversation, error } = await context.supabase
      .from("omni_conversations")
      .select("id")
      .eq("id", data.conversationId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conversation) throw new Error("Görüşme bulunamadı");

    const [{ supabaseAdmin }, { generateTiktokReply }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/tiktok.server"),
    ]);
    return generateTiktokReply(supabaseAdmin, {
      storeId: data.storeId,
      conversationId: data.conversationId,
      text: data.text,
    });
  });

/** TikTok DM gönderir ve gelen kutusuna kaydeder. */
export const sendTiktokMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        conversationId: z.guid(),
        body: z.string().trim().min(1).max(2000),
        isAi: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: conversation, error } = await context.supabase
      .from("omni_conversations")
      .select("id, external_id")
      .eq("id", data.conversationId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conversation?.external_id) throw new Error("Görüşmenin TikTok kimliği bulunamadı");

    const [{ supabaseAdmin }, { sendTiktokDm }, { recordOutboundMessage }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/tiktok.server"),
      import("@/lib/omni.server"),
    ]);

    const sent = await sendTiktokDm(supabaseAdmin, {
      storeId: data.storeId,
      recipientId: conversation.external_id,
      text: data.body,
    });
    await recordOutboundMessage(context.supabase, {
      storeId: data.storeId,
      conversationId: data.conversationId,
      body: data.body,
      sentBy: context.userId,
      isAi: data.isAi,
    });
    return { status: sent.status, error: sent.error };
  });
