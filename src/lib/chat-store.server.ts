/**
 * Mağaza sohbet kanalları: her mağazanın ekip kanalı (store_team) ve
 * her müşteri için mağazanın ortak gelen kutusu (store_inbox).
 * Üyelik her zaman sunucuda, store_users kaydından türetilir; başka mağazalar asla eklenmez.
 */
type Admin = any;

async function teamOf(admin: Admin, storeId: string): Promise<string[]> {
  const { data } = await admin.from("store_users").select("user_id").eq("store_id", storeId).limit(300);
  return [...new Set<string>((data ?? []).map((r: any) => r.user_id))];
}

/** Konuşmanın katılımcılarını istenen listeye eşitler (fazlaları çıkarır, eksikleri ekler). */
async function syncMembers(admin: Admin, convId: string, wanted: Map<string, "seller" | "customer">) {
  const { data: cur } = await admin.from("chat_participants").select("user_id").eq("conversation_id", convId);
  const have = new Set<string>((cur ?? []).map((r: any) => r.user_id));
  const extra = [...have].filter((id) => !wanted.has(id));
  if (extra.length) await admin.from("chat_participants").delete().eq("conversation_id", convId).in("user_id", extra);
  const add = [...wanted].filter(([id]) => !have.has(id));
  if (add.length)
    await admin.from("chat_participants").insert(
      add.map(([id, role]) => ({ conversation_id: convId, user_id: id, role: "member", display_role: role })),
    );
}

async function ensureConv(admin: Admin, kind: "store_team" | "store_inbox", storeId: string, createdBy: string, title: string | null) {
  let q = admin.from("chat_conversations").select("id").eq("kind", kind).eq("store_id", storeId);
  if (kind === "store_inbox") q = q.eq("created_by", createdBy);
  const { data: found } = await q.maybeSingle();
  if (found) return found.id as string;
  const { data, error } = await admin
    .from("chat_conversations")
    .insert({ kind, store_id: storeId, created_by: createdBy, title })
    .select("id")
    .single();
  if (error) {
    const { data: again } = await q.maybeSingle();
    if (again) return again.id as string;
    throw new Error(error.message);
  }
  return data.id as string;
}

/** Kullanıcının mağaza kanallarını hazırlar ve artık üyesi olmadığı mağaza kanallarından çıkarır. */
export async function syncStoreChannels(admin: Admin, me: string) {
  const { data: su } = await admin.from("store_users").select("store_id").eq("user_id", me).limit(20);
  const myStores = [...new Set<string>((su ?? []).map((r: any) => r.store_id))];

  // Eski mağazaların kanallarından çık (kendi açtığı müşteri kutusu hariç).
  const { data: mine } = await admin
    .from("chat_participants")
    .select("conversation_id, chat_conversations!inner(kind, store_id, created_by)")
    .eq("user_id", me)
    .in("chat_conversations.kind", ["store_team", "store_inbox"]);
  const stale = (mine ?? [])
    .filter((r: any) => {
      const c = r.chat_conversations;
      if (c.kind === "store_inbox" && c.created_by === me) return false;
      return !myStores.includes(c.store_id);
    })
    .map((r: any) => r.conversation_id);
  if (stale.length) await admin.from("chat_participants").delete().eq("user_id", me).in("conversation_id", stale);

  for (const storeId of myStores) {
    const team = await teamOf(admin, storeId);
    const teamId = await ensureConv(admin, "store_team", storeId, me, null);
    await syncMembers(admin, teamId, new Map(team.map((id) => [id, "seller" as const])));

    const { data: inboxes } = await admin
      .from("chat_conversations")
      .select("id, created_by")
      .eq("kind", "store_inbox")
      .eq("store_id", storeId)
      .limit(500);
    const { data: joined } = await admin
      .from("chat_participants")
      .select("conversation_id")
      .eq("user_id", me)
      .in("conversation_id", (inboxes ?? []).map((i: any) => i.id));
    const has = new Set((joined ?? []).map((j: any) => j.conversation_id));
    const missing = (inboxes ?? []).filter((i: any) => !has.has(i.id));
    if (missing.length)
      await admin.from("chat_participants").insert(
        missing.map((i: any) => ({ conversation_id: i.id, user_id: me, role: "member", display_role: "seller" })),
      );
  }
}

/** Müşteri → mağaza ortak gelen kutusu. Yalnız o mağazanın müşterisi açabilir. */
export async function openStoreInbox(admin: Admin, me: string, storeId: string) {
  const { data: cust } = await admin.from("customers").select("id").eq("store_id", storeId).eq("user_id", me).limit(1);
  if (!cust?.length) throw new Error("Bu mağazaya mesaj gönderemezsiniz.");
  const id = await ensureConv(admin, "store_inbox", storeId, me, null);
  const team = await teamOf(admin, storeId);
  const wanted = new Map<string, "seller" | "customer">(team.map((u) => [u, "seller"]));
  wanted.set(me, "customer");
  await syncMembers(admin, id, wanted);
  return id;
}
