/**
 * Mesajlar uygulaması — kimin kiminle konuşabileceğini belirleyen yetki kapsamı.
 * Kurallar: platform yöneticisi ↔ satıcı; mağaza ekibi ↔ kendi mağazasının ekibi ve müşterileri;
 * müşteri ↔ alışveriş yaptığı mağazanın ekibi. Başka mağazalar asla görünmez.
 */

export type ChatContact = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  role: "admin" | "seller" | "customer";
  storeId: string | null;
  storeName: string | null;
};

type Admin = any;

async function isPlatformAdmin(admin: Admin, userId: string) {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "platform_admin")
    .maybeSingle();
  return Boolean(data);
}

/** Kullanıcının konuşabileceği kişileri döner (en fazla 300). */
export async function allowedContacts(admin: Admin, userId: string): Promise<Map<string, ChatContact>> {
  const out = new Map<string, ChatContact>();
  const put = (c: ChatContact) => {
    if (c.id !== userId && !out.has(c.id)) out.set(c.id, c);
  };

  const [meAdmin, memberships, customerRows] = await Promise.all([
    isPlatformAdmin(admin, userId),
    admin.from("store_users").select("store_id, stores(name)").eq("user_id", userId),
    admin.from("customers").select("store_id, stores(name)").eq("user_id", userId).limit(50),
  ]);

  const myStores: { id: string; name: string | null }[] = (memberships.data ?? []).map((r: any) => ({
    id: r.store_id,
    name: r.stores?.name ?? null,
  }));
  const shopStores: { id: string; name: string | null }[] = (customerRows.data ?? []).map((r: any) => ({
    id: r.store_id,
    name: r.stores?.name ?? null,
  }));

  const ids = new Set<string>();
  const meta = new Map<string, Omit<ChatContact, "name" | "email" | "avatarUrl" | "id">>();
  const note = (id: string | null, m: Omit<ChatContact, "name" | "email" | "avatarUrl" | "id">) => {
    if (!id || id === userId) return;
    ids.add(id);
    if (!meta.has(id) || m.role === "admin") meta.set(id, m);
  };

  // Platform yöneticileri: satıcılar yöneticilere yazabilir; yöneticiler tüm satıcılara.
  if (meAdmin) {
    const { data } = await admin
      .from("store_users")
      .select("user_id, store_id, stores(name)")
      .in("role", ["owner", "admin"])
      .limit(300);
    for (const r of data ?? []) note(r.user_id, { role: "seller", storeId: r.store_id, storeName: r.stores?.name ?? null });
  }
  if (myStores.length || meAdmin) {
    const { data } = await admin.from("user_roles").select("user_id").eq("role", "platform_admin").limit(20);
    for (const r of data ?? []) note(r.user_id, { role: "admin", storeId: null, storeName: "Mefticaret" });
  }

  if (myStores.length) {
    const storeIds = myStores.map((s) => s.id);
    const name = (id: string) => myStores.find((s) => s.id === id)?.name ?? null;
    const [team, customers] = await Promise.all([
      admin.from("store_users").select("user_id, store_id").in("store_id", storeIds).limit(300),
      admin.from("customers").select("user_id, store_id").in("store_id", storeIds).not("user_id", "is", null).limit(300),
    ]);
    for (const r of team.data ?? []) note(r.user_id, { role: "seller", storeId: r.store_id, storeName: name(r.store_id) });
    for (const r of customers.data ?? []) note(r.user_id, { role: "customer", storeId: r.store_id, storeName: name(r.store_id) });
  }

  if (shopStores.length) {
    const { data } = await admin
      .from("store_users")
      .select("user_id, store_id")
      .in("store_id", shopStores.map((s) => s.id))
      .in("role", ["owner", "admin", "support", "manager"])
      .limit(100);
    for (const r of data ?? [])
      note(r.user_id, {
        role: "seller",
        storeId: r.store_id,
        storeName: shopStores.find((s) => s.id === r.store_id)?.name ?? null,
      });
  }

  if (!ids.size) return out;
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, email, avatar_url")
    .in("id", [...ids].slice(0, 300));
  for (const p of profiles ?? []) {
    const m = meta.get(p.id)!;
    put({
      id: p.id,
      name: p.full_name || (p.email ? String(p.email).split("@")[0] : "Kullanıcı"),
      email: p.email ?? null,
      avatarUrl: p.avatar_url ?? null,
      ...m,
    });
  }
  return out;
}

export async function myDisplayRole(admin: Admin, userId: string): Promise<ChatContact["role"]> {
  if (await isPlatformAdmin(admin, userId)) return "admin";
  const { data } = await admin.from("store_users").select("store_id").eq("user_id", userId).limit(1);
  return data?.length ? "seller" : "customer";
}
