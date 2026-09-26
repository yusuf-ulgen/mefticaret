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

/** Konuşulabilecek kişileri arar. */
export const searchChatContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ q: z.string().trim().max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { allowedContacts } = await import("./chat.server");
    const all = [...(await allowedContacts(await adminClient(), context.userId)).values()];
    const q = data.q.toLocaleLowerCase("tr");
    return all
      .filter((c) => !q || c.name.toLocaleLowerCase("tr").includes(q) || (c.email ?? "").toLowerCase().includes(q))
      .slice(0, 40);
  });

/** Birebir veya grup sohbeti başlatır (varsa mevcut birebiri döner). */
export const startChatConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userIds: z.array(z.string().uuid()).min(1).max(30),
        title: z.string().trim().max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const me = context.userId;
    await limit(`chat_start:${me}`, 30, 3600);
    const admin = await adminClient();
    const { allowedContacts, myDisplayRole } = await import("./chat.server");
    const allowed = await allowedContacts(admin, me);
    const targets = [...new Set(data.userIds)].filter((id) => id !== me);
    if (!targets.length || targets.some((id) => !allowed.has(id))) throw new Error("Bu kişilerle sohbet başlatamazsınız.");

    const group = targets.length > 1;
    if (!group) {
      const { data: mine } = await admin.from("chat_participants").select("conversation_id").eq("user_id", me);
      const convIds = (mine ?? []).map((r: any) => r.conversation_id);
      if (convIds.length) {
        const { data: shared } = await admin
          .from("chat_participants")
          .select("conversation_id, chat_conversations!inner(kind)")
          .eq("user_id", targets[0])
          .in("conversation_id", convIds)
          .neq("chat_conversations.kind", "group");
        if (shared?.length) return { id: shared[0].conversation_id as string };
      }
    }

    const first = allowed.get(targets[0])!;
    const myRole = await myDisplayRole(admin, me);
    const kind = group ? "group" : first.role === "admin" || myRole === "admin" ? "support" : "direct";
    const { data: conv, error } = await admin
      .from("chat_conversations")
      .insert({ kind, title: group ? data.title || "Yeni grup" : null, created_by: me, store_id: first.storeId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const rows = [
      { conversation_id: conv.id, user_id: me, role: "owner", display_role: myRole },
      ...targets.map((id) => ({ conversation_id: conv.id, user_id: id, role: "member", display_role: allowed.get(id)!.role })),
    ];
    const { error: pErr } = await admin.from("chat_participants").insert(rows);
    if (pErr) throw new Error(pErr.message);
    return { id: conv.id as string };
  });

/** Kendi mesajını siler ("Bu mesaj silindi" olarak kalır). */
export const deleteChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient();
    const { data: row } = await admin.from("chat_messages").select("sender_id, attachment_path").eq("id", data.id).maybeSingle();
    if (!row || row.sender_id !== context.userId) throw new Error("Yalnızca kendi mesajınızı silebilirsiniz.");
    if (row.attachment_path) await admin.storage.from("chat-media").remove([row.attachment_path]);
    await admin
      .from("chat_messages")
      .update({ deleted_at: new Date().toISOString(), body: null, attachment_path: null, attachment_name: null })
      .eq("id", data.id);
    return { ok: true };
  });

/** Mesaj gönderim hız sınırı (dakikada 60). */
export const checkChatSendLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await limit(`chat_send:${context.userId}`, 60, 60);
    return { ok: true };
  });
