import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getChatPushKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ key: process.env["CHAT_VAPID_PUBLIC_KEY"] ?? null }));

/** Gönderen, kendi yeni mesajı için diğer üyelerin telefonlarına bildirim yollar. */
export const sendChatPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ messageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: m } = await supabase
      .from("chat_messages")
      .select("id, conversation_id, sender_id, kind, body, attachment_name, created_at")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!m || m.sender_id !== userId) return { sent: 0 };
    if (Date.now() - new Date(m.created_at).getTime() > 5 * 60_000) return { sent: 0 };

    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");
    const { sendWebPush } = await import("./web-push.server");
    const now = Date.now();
    const { data: parts } = await admin
      .from("chat_participants")
      .select("user_id, muted, mute_until")
      .eq("conversation_id", m.conversation_id)
      .neq("user_id", userId);
    let ids = (parts ?? [])
      .filter((p) => !p.muted && !(p.mute_until && new Date(p.mute_until).getTime() > now))
      .map((p) => p.user_id);
    if (!ids.length) return { sent: 0 };
    const { data: off } = await admin.from("chat_user_settings").select("user_id").in("user_id", ids).eq("notifications_enabled", false);
    const offSet = new Set((off ?? []).map((o) => o.user_id));
    ids = ids.filter((i) => !offSet.has(i));
    if (!ids.length) return { sent: 0 };

    const [{ data: subs }, { data: prof }, { data: conv }] = await Promise.all([
      admin.from("chat_push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", ids).limit(200),
      admin.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
      admin.from("chat_conversations").select("title").eq("id", m.conversation_id).maybeSingle(),
    ]);
    const name = prof?.full_name || (prof?.email ? String(prof.email).split("@")[0] : "Mefticaret");
    const text =
      m.kind === "audio" ? "🎤 Sesli mesaj" : m.kind === "image" ? "📷 Fotoğraf" : m.kind === "file" ? `📎 ${m.attachment_name ?? "Dosya"}` : (m.body ?? "").slice(0, 140);
    const payload = {
      title: conv?.title ? `${name} · ${conv.title}` : name,
      body: text,
      tag: m.conversation_id,
      url: `/mesajlar?c=${m.conversation_id}`,
    };
    let sent = 0;
    const gone: string[] = [];
    await Promise.all(
      (subs ?? []).map(async (s) => {
        const r = await sendWebPush(s, payload);
        if (r === "ok") sent++;
        if (r === "gone") gone.push(s.id);
      }),
    );
    if (gone.length) await admin.from("chat_push_subscriptions").delete().in("id", gone);
    return { sent };
  });
