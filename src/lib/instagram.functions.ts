import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { IG_MATCH_TYPES } from "@/lib/instagram";

/**
 * Instagram DM & Social Inbox server function'ları.
 * Erişim anahtarları yalnızca sunucu tarafında (`supabaseAdmin`) işlenir ve
 * hiçbir yanıtla istemciye dönmez.
 */

const storeScope = z.object({ storeId: z.string().uuid() });

/** OAuth onay adresini üretir (Meta uygulama bilgileri gerekli). */
export const getInstagramOAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.extend({ redirectUri: z.string().url() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: store, error } = await context.supabase
      .from("stores")
      .select("id")
      .eq("id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

    const { buildInstagramOAuthUrl, metaAppConfig } = await import("@/lib/instagram.server");
    if (!metaAppConfig().appId) {
      throw new Error(
        "Meta uygulama bilgileri henüz tanımlı değil. Bağlantıyı erişim anahtarını girerek de tamamlayabilirsin.",
      );
    }
    return { url: buildInstagramOAuthUrl(data.redirectUri, data.storeId) };
  });

/** OAuth kodunu anahtara çevirir ve hesabı bağlar. */
export const completeInstagramOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope.extend({ code: z.string().min(4), redirectUri: z.string().url() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: store, error } = await context.supabase
      .from("stores")
      .select("id")
      .eq("id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

    const [{ supabaseAdmin }, { exchangeInstagramCode, upsertInstagramAccount }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/instagram.server"),
    ]);
    const credentials = await exchangeInstagramCode(data.code, data.redirectUri);
    const account = await upsertInstagramAccount(supabaseAdmin, data.storeId, credentials);
    return { id: account.id, igUsername: account.ig_username, status: account.status };
  });

/** Erişim anahtarını elle girerek hesabı bağlar (Meta uygulama incelemesi öncesi). */
export const connectInstagramManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        igUserId: z.string().trim().min(3),
        igUsername: z.string().trim().min(1).nullable().default(null),
        pageId: z.string().trim().min(3).nullable().default(null),
        accessToken: z.string().trim().min(20),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: store, error } = await context.supabase
      .from("stores")
      .select("id")
      .eq("id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

    const [{ supabaseAdmin }, { upsertInstagramAccount }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/instagram.server"),
    ]);
    const account = await upsertInstagramAccount(supabaseAdmin, data.storeId, {
      igUserId: data.igUserId,
      igUsername: data.igUsername,
      pageId: data.pageId,
      accessToken: data.accessToken,
    });
    return { id: account.id, igUsername: account.ig_username, verifyToken: account.verify_token };
  });

/** Hesap ayarlarını (otomatik DM, otonom AI, güven eşiği) günceller. */
export const updateInstagramSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        autoCommentDmEnabled: z.boolean().optional(),
        autonomousAiEnabled: z.boolean().optional(),
        aiConfidenceThreshold: z.number().min(0.1).max(1).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.autoCommentDmEnabled !== undefined)
      patch["auto_comment_dm_enabled"] = data.autoCommentDmEnabled;
    if (data.autonomousAiEnabled !== undefined)
      patch["autonomous_ai_enabled"] = data.autonomousAiEnabled;
    if (data.aiConfidenceThreshold !== undefined)
      patch["ai_confidence_threshold"] = data.aiConfidenceThreshold;

    const { error } = await context.supabase
      .from("instagram_accounts")
      .update(patch as never)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const disconnectInstagram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("instagram_accounts")
      .delete()
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ruleInput = storeScope.extend({
  ruleId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  keywords: z.array(z.string().trim().min(1)).max(40).default([]),
  matchType: z.enum(IG_MATCH_TYPES).default("contains"),
  targetPostId: z.string().trim().max(64).nullable().default(null),
  productId: z.string().uuid().nullable().default(null),
  dmTemplate: z.string().trim().min(4).max(1000),
  publicReply: z.string().trim().max(300).default(""),
  sendProductCard: z.boolean().default(true),
  replyToComment: z.boolean().default(true),
  priority: z.number().int().min(1).max(999).default(100),
  isActive: z.boolean().default(true),
});

export const saveInstagramRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => ruleInput.parse(data))
  .handler(async ({ data, context }) => {
    const payload = {
      store_id: data.storeId,
      name: data.name,
      keywords: data.keywords,
      match_type: data.matchType,
      target_post_id: data.targetPostId,
      product_id: data.productId,
      dm_template: data.dmTemplate,
      public_reply: data.publicReply,
      send_product_card: data.sendProductCard,
      reply_to_comment: data.replyToComment,
      priority: data.priority,
      is_active: data.isActive,
    };

    const { data: row, error } = data.ruleId
      ? await context.supabase
          .from("instagram_comment_rules")
          .update(payload)
          .eq("id", data.ruleId)
          .eq("store_id", data.storeId)
          .select("*")
          .single()
      : await context.supabase
          .from("instagram_comment_rules")
          .insert(payload)
          .select("*")
          .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteInstagramRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.extend({ ruleId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("instagram_comment_rules")
      .delete()
      .eq("id", data.ruleId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Kural motorunu gerçek gönderim yapmadan test eder. */
export const testInstagramRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.extend({ comment: z.string().trim().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: rules, error } = await context.supabase
      .from("instagram_comment_rules")
      .select("*")
      .eq("store_id", data.storeId)
      .eq("is_active", true)
      .order("priority", { ascending: true });
    if (error) throw new Error(error.message);

    const { matchKeyword, renderTemplate } = await import("@/lib/instagram");
    for (const rule of rules ?? []) {
      const matched = matchKeyword(data.comment, rule.keywords, rule.match_type as never);
      if (matched) {
        return {
          matched: true,
          ruleName: rule.name,
          keyword: matched,
          dm: renderTemplate(rule.dm_template, { name: "test_kullanici", keyword: matched }),
          publicReply: rule.reply_to_comment ? rule.public_reply : null,
        };
      }
    }
    return { matched: false, ruleName: null, keyword: null, dm: null, publicReply: null };
  });

/** DM panelinin sağ sütunu için 360° müşteri profili. */
export const getSocialCrmProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeScope.extend({ conversationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { loadSocialCrmProfile } = await import("@/lib/instagram.server");
    return loadSocialCrmProfile(context.supabase, data.storeId, data.conversationId);
  });

/** AI yanıt önerisi üretir (otomatik göndermez). */
export const suggestInstagramReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({ conversationId: z.string().uuid(), text: z.string().trim().min(1).max(2000) })
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

    const [{ supabaseAdmin }, { generateIgReply }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/instagram.server"),
    ]);
    return generateIgReply(supabaseAdmin, {
      storeId: data.storeId,
      conversationId: data.conversationId,
      text: data.text,
    });
  });

/** Instagram DM gönderir ve gelen kutusuna kaydeder. */
export const sendInstagramMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    storeScope
      .extend({
        conversationId: z.string().uuid(),
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
    if (!conversation?.external_id) throw new Error("Görüşmenin Instagram kimliği bulunamadı");

    const [{ supabaseAdmin }, { sendInstagramDm }, { recordOutboundMessage }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/instagram.server"),
      import("@/lib/omni.server"),
    ]);

    const sent = await sendInstagramDm(supabaseAdmin, {
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
