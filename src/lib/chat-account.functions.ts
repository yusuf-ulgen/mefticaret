import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function limit(key: string, max: number, windowSeconds: number) {
  const { consumeRateLimit } = await import("@/lib/rate-limit.server");
  const r = await consumeRateLimit(key, { limit: max, windowSeconds });
  if (r && (r as { allowed?: boolean }).allowed === false) throw new Error("Çok hızlı işlem yaptınız, biraz bekleyin.");
}

/** Telefonu E.164 rakamlarına çevirir (Türkiye varsayılan). İstemcideki ile aynı olmalı. */
export function normalizePhone(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = "90" + d.slice(1);
  if (d.length === 10 && d.startsWith("5")) d = "90" + d;
  return d;
}
async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`mefti-chat:${s}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const privacy = z.enum(["everyone", "contacts", "nobody"]);
const settingsSchema = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.]{3,24}$/, "Kullanıcı adı 3-24 karakter; harf, rakam, _ ve . olabilir.")
    .nullable()
    .optional(),
  bio: z.string().trim().max(140).nullable().optional(),
  store_url: z
    .string()
    .trim()
    .max(200)
    .regex(/^https:\/\//, "Mağaza linki https:// ile başlamalı.")
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  user_type: z.enum(["seller", "customer"]).optional(),
  phone: z.string().trim().max(24).optional(),
  last_seen_privacy: privacy.optional(),
  photo_privacy: privacy.optional(),
  online_privacy: privacy.optional(),
  notifications_enabled: z.boolean().optional(),
  sound: z.enum(["pop", "chime", "ding", "none"]).optional(),
  vibrate: z.boolean().optional(),
  consent: z.boolean().optional(),
});

export type ChatSettings = {
  handle: string | null;
  bio: string | null;
  store_url: string | null;
  user_type: "seller" | "customer";
  has_phone: boolean;
  last_seen_privacy: "everyone" | "contacts" | "nobody";
  photo_privacy: "everyone" | "contacts" | "nobody";
  online_privacy: "everyone" | "contacts" | "nobody";
  notifications_enabled: boolean;
  sound: "pop" | "chime" | "ding" | "none";
  vibrate: boolean;
  consent_at: string | null;
};

export const getChatSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatSettings> => {
    const { data } = await (context.supabase as any).from("chat_user_settings").select("*").eq("user_id", context.userId).maybeSingle();
    return {
      handle: data?.handle ?? null,
      bio: data?.bio ?? null,
      store_url: data?.store_url ?? null,
      user_type: data?.user_type ?? "customer",
      has_phone: Boolean(data?.phone_hash),
      last_seen_privacy: data?.last_seen_privacy ?? "everyone",
      photo_privacy: data?.photo_privacy ?? "everyone",
      online_privacy: data?.online_privacy ?? "everyone",
      notifications_enabled: data?.notifications_enabled ?? true,
      sound: data?.sound ?? "pop",
      vibrate: data?.vibrate ?? true,
      consent_at: data?.consent_at ?? null,
    };
  });

export const saveChatSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    await limit(`chat_settings:${context.userId}`, 30, 60);
    const { phone, consent, ...rest } = data;
    const row: Record<string, unknown> = { user_id: context.userId };
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) row[k] = v === "" ? null : v;
    if (phone !== undefined) {
      const n = normalizePhone(phone);
      row["phone_hash"] = n.length >= 10 ? await sha256(n) : null;
    }
    if (consent) row["consent_at"] = new Date().toISOString();
    const admin = await adminClient();
    if (row["handle"]) {
      const { data: taken } = await admin.from("chat_user_settings").select("user_id").eq("handle", row["handle"]).maybeSingle();
      if (taken && taken.user_id !== context.userId) throw new Error("Bu kullanıcı adı alınmış.");
    }
    const { error } = await admin.from("chat_user_settings").upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.code === "23505" ? "Bu kullanıcı adı alınmış." : error.message);
    return { ok: true };
  });

export type ChatUserCard = {
  id: string;
  name: string;
  avatarUrl: string | null;
  role: "admin" | "seller" | "customer";
  handle: string | null;
  bio: string | null;
  storeName: string | null;
  storeUrl: string | null;
  blocked: boolean;
};

async function buildCards(admin: any, me: string, ids: string[]): Promise<ChatUserCard[]> {
  if (!ids.length) return [];
  const [{ data: profiles }, { data: settings }, { data: stores }, { data: blocks }, { myDisplayRole }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, avatar_url").in("id", ids),
    admin.from("chat_user_settings").select("user_id, handle, bio, store_url, photo_privacy").in("user_id", ids),
    admin.from("store_users").select("user_id, stores(name)").in("user_id", ids).in("role", ["owner", "admin"]),
    admin.from("chat_blocks").select("blocked_id").eq("blocker_id", me).in("blocked_id", ids),
    import("./chat.server"),
  ]);
  const set = new Map<string, any>((settings ?? []).map((s: any) => [s.user_id, s]));
  const store = new Map<string, string>();
  for (const s of stores ?? []) if (s.stores?.name && !store.has(s.user_id)) store.set(s.user_id, s.stores.name);
  const blocked = new Set((blocks ?? []).map((b: any) => b.blocked_id));
  return Promise.all(
    (profiles ?? []).map(async (p: any) => {
      const s = set.get(p.id);
      return {
        id: p.id,
        name: p.full_name || (p.email ? String(p.email).split("@")[0] : "Kullanıcı"),
        avatarUrl: s?.photo_privacy === "nobody" ? null : p.avatar_url ?? null,
        role: await myDisplayRole(admin, p.id),
        handle: s?.handle ?? null,
        bio: s?.bio ?? null,
        storeName: store.get(p.id) ?? null,
        storeUrl: s?.store_url ?? null,
        blocked: blocked.has(p.id),
      };
    }),
  );
}

/** Profil kartı — yalnızca konuşabildiğiniz veya sohbet ettiğiniz kişiler için. */
export const getChatUserCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const { allowedContacts } = await import("./chat.server");
    const allowed = await allowedContacts(admin, context.userId);
    if (!allowed.has(data.userId)) {
      const { data: mine } = await admin.from("chat_participants").select("conversation_id").eq("user_id", context.userId);
      const ids = (mine ?? []).map((r: any) => r.conversation_id);
      const { count } = ids.length
        ? await admin.from("chat_participants").select("user_id", { count: "exact", head: true }).eq("user_id", data.userId).in("conversation_id", ids)
        : { count: 0 };
      if (!count) throw new Error("Bu kişinin profiline erişemezsiniz.");
    }
    const [card] = await buildCards(admin, context.userId, [data.userId]);
    if (!card) throw new Error("Kullanıcı bulunamadı.");
    return card;
  });

/** @kullanıcıadı (QR kod) ile kişi bulur. */
export const findChatUserByHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ handle: z.string().trim().toLowerCase().regex(/^@?[a-z0-9_.]{3,24}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    await limit(`chat_handle:${context.userId}`, 30, 60);
    const admin = await adminClient();
    const { data: row } = await admin.from("chat_user_settings").select("user_id").eq("handle", data.handle.replace(/^@/, "")).maybeSingle();
    if (!row || row.user_id === context.userId) throw new Error("Bu kullanıcı adıyla kimse bulunamadı.");
    const [card] = await buildCards(admin, context.userId, [row.user_id]);
    if (!card) throw new Error("Bu kullanıcı adıyla kimse bulunamadı.");
    return card;
  });

/** Rehberdeki (cihazda özetlenmiş) telefonları eşleştirir. */
export const matchChatContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ phones: z.array(z.string().max(24)).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    await limit(`chat_contacts:${context.userId}`, 5, 3600);
    const hashes = [...new Set(await Promise.all(data.phones.map((p) => normalizePhone(p)).filter((p) => p.length >= 10).map(sha256)))];
    if (!hashes.length) return [] as ChatUserCard[];
    const admin = await adminClient();
    const { data: rows } = await admin.from("chat_user_settings").select("user_id").in("phone_hash", hashes).limit(200);
    const ids = (rows ?? []).map((r: any) => r.user_id).filter((id: string) => id !== context.userId);
    return (await buildCards(admin, context.userId, ids)).filter((c) => !c.blocked);
  });

/** QR / kullanıcı adı / rehber ile bulunan kişiyle birebir sohbet açar. */
export const startChatByHandle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), handle: z.string().trim().toLowerCase().max(25).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const me = context.userId;
    await limit(`chat_start:${me}`, 30, 3600);
    const admin = await adminClient();
    const { data: s } = await admin.from("chat_user_settings").select("user_id, handle, phone_hash").eq("user_id", data.userId).maybeSingle();
    // Yalnızca kendini bulunabilir yapan (kullanıcı adı veya telefon eklemiş) kişilerle.
    if (!s || (!s.handle && !s.phone_hash)) throw new Error("Bu kişiyle sohbet başlatılamıyor.");
    if (data.userId === me) throw new Error("Kendinizle sohbet başlatamazsınız.");
    const { data: blk } = await admin
      .from("chat_blocks")
      .select("blocker_id")
      .or(`and(blocker_id.eq.${me},blocked_id.eq.${data.userId}),and(blocker_id.eq.${data.userId},blocked_id.eq.${me})`);
    if (blk?.length) throw new Error("Bu kişiyle mesajlaşma engellendi.");
    const { data: mine } = await admin.from("chat_participants").select("conversation_id").eq("user_id", me);
    const convIds = (mine ?? []).map((r: any) => r.conversation_id);
    if (convIds.length) {
      const { data: shared } = await admin
        .from("chat_participants")
        .select("conversation_id, chat_conversations!inner(kind)")
        .eq("user_id", data.userId)
        .in("conversation_id", convIds)
        .neq("chat_conversations.kind", "group");
      if (shared?.length) return { id: shared[0].conversation_id as string };
    }
    const { myDisplayRole } = await import("./chat.server");
    const [myRole, peerRole] = await Promise.all([myDisplayRole(admin, me), myDisplayRole(admin, data.userId)]);
    const { data: conv, error } = await admin
      .from("chat_conversations")
      .insert({ kind: myRole === "admin" || peerRole === "admin" ? "support" : "direct", created_by: me, store_id: null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const { error: pErr } = await admin.from("chat_participants").insert([
      { conversation_id: conv.id, user_id: me, role: "owner", display_role: myRole },
      { conversation_id: conv.id, user_id: data.userId, role: "member", display_role: peerRole },
    ]);
    if (pErr) throw new Error(pErr.message);
    return { id: conv.id as string };
  });

export const setChatBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), blocked: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("Kendinizi engelleyemezsiniz.");
    const sb = context.supabase as any;
    const { error } = data.blocked
      ? await sb.from("chat_blocks").upsert({ blocker_id: context.userId, blocked_id: data.userId }, { onConflict: "blocker_id,blocked_id" })
      : await sb.from("chat_blocks").delete().eq("blocker_id", context.userId).eq("blocked_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listChatBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context.supabase as any).from("chat_blocks").select("blocked_id").eq("blocker_id", context.userId);
    const admin = await adminClient();
    return buildCards(admin, context.userId, (data ?? []).map((r: any) => r.blocked_id));
  });

export const reportChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        messageId: z.string().uuid(),
        reason: z.enum(["spam", "abuse", "fraud", "inappropriate", "other"]),
        note: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await limit(`chat_report:${context.userId}`, 20, 3600);
    // RLS: yalnızca üyesi olduğunuz sohbetlerin mesajları okunabilir.
    const { data: msg } = await (context.supabase as any)
      .from("chat_messages")
      .select("id, sender_id, body, kind")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!msg) throw new Error("Mesaj bulunamadı.");
    if (msg.sender_id === context.userId) throw new Error("Kendi mesajınızı şikayet edemezsiniz.");
    const admin = await adminClient();
    const { error } = await admin.from("chat_reports").insert({
      reporter_id: context.userId,
      message_id: msg.id,
      reported_user_id: msg.sender_id,
      reason: data.reason,
      note: data.note || null,
      message_snapshot: msg.kind === "text" ? String(msg.body ?? "").slice(0, 4000) : `[${msg.kind}]`,
    });
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true };
  });

/** Satıcı: hesabın üyesi olduğu mağazalar arasında ad/link ile eşleşme. */
export const matchMyStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().trim().min(2).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const { data: rows } = await admin.from("store_users").select("role, stores(id, name, slug)").eq("user_id", context.userId);
    const needle = data.q
      .toLocaleLowerCase("tr")
      .replace(/^https?:\/\//, "")
      .replace(/^(www\.)?mefticaret\.com\/s\//, "")
      .replace(/\/.*$/, "");
    return (rows ?? [])
      .map((r: any) => r.stores)
      .filter(Boolean)
      .filter((s: any) => s.slug.toLowerCase() === needle || String(s.name).toLocaleLowerCase("tr").includes(needle))
      .map((s: any) => ({ id: s.id as string, name: s.name as string, url: `https://mefticaret.com/s/${s.slug}` }));
  });

/** KVKK md. 11 — kişisel mesaj verilerinin dışa aktarımı (JSON). */
export const exportMyChatData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await limit(`chat_export:${context.userId}`, 3, 3600);
    const admin = await adminClient();
    const me = context.userId;
    const [profile, settings, parts, messages, blocks, reports] = await Promise.all([
      admin.from("profiles").select("full_name, email, avatar_url, created_at").eq("id", me).maybeSingle(),
      admin.from("chat_user_settings").select("handle, bio, store_url, user_type, last_seen_privacy, photo_privacy, online_privacy, notifications_enabled, sound, vibrate, consent_at, created_at").eq("user_id", me).maybeSingle(),
      admin.from("chat_participants").select("conversation_id, joined_at:created_at, muted, archived").eq("user_id", me),
      admin.from("chat_messages").select("id, conversation_id, kind, body, attachment_name, created_at, deleted_at").eq("sender_id", me).order("created_at").limit(20000),
      admin.from("chat_blocks").select("blocked_id, created_at").eq("blocker_id", me),
      admin.from("chat_reports").select("message_id, reason, note, status, created_at").eq("reporter_id", me),
    ]);
    return JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        note: "KVKK md. 11 kapsamında Mefticaret Mesajlar verileriniz.",
        profile: profile.data,
        settings: settings.data,
        conversations: parts.data ?? [],
        sent_messages: messages.data ?? [],
        blocked_users: blocks.data ?? [],
        reports: reports.data ?? [],
      },
      null,
      2,
    );
  });

/** Hesabı ve tüm mesajları kalıcı siler. Mağaza sahipleri önce mağazayı devretmeli/silmeli. */
export const deleteMyChatAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ confirm: z.literal("SİL") }).parse(d))
  .handler(async ({ context }) => {
    const me = context.userId;
    await limit(`chat_delete:${me}`, 3, 3600);
    const admin = await adminClient();
    const { data: owned } = await admin.from("store_users").select("store_id").eq("user_id", me).eq("role", "owner").limit(1);
    if (owned?.length) throw new Error("Sahibi olduğunuz bir mağaza var. Önce mağazayı silin veya devredin.");
    const { data: files } = await admin.from("chat_messages").select("attachment_path").eq("sender_id", me).not("attachment_path", "is", null).limit(5000);
    const paths = (files ?? []).map((f: any) => f.attachment_path).filter(Boolean);
    for (let i = 0; i < paths.length; i += 100) await admin.storage.from("chat-media").remove(paths.slice(i, i + 100));
    await admin.from("chat_messages").delete().eq("sender_id", me);
    await admin.from("chat_participants").delete().eq("user_id", me);
    await admin.from("chat_presence").delete().eq("user_id", me);
    const { error } = await admin.auth.admin.deleteUser(me);
    if (error) throw new Error("Hesap silinemedi: " + error.message);
    return { ok: true };
  });
