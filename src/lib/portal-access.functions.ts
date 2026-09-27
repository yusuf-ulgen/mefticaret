import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PortalKey = "merchant" | "handmade" | "supplier" | "inbox";

export type PortalAccess = {
  merchant: boolean;
  handmade: boolean;
  supplier: boolean;
  inbox: boolean;
  kolayStoreId: string | null;
  /** Kullanıcının varsayılan (ilk yetkili) portalı. */
  primary: PortalKey;
};

/**
 * Kullanıcının hangi giriş kapılarına (portal) yetkili olduğunu sunucuda,
 * kendi oturumu ve RLS altında hesaplar. Tarayıcıdan gelen rol bilgisine güvenilmez.
 * Bir kişi birden fazla role sahip olabilir.
 */
export const getPortalAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalAccess> => {
    const { supabase, userId } = context;
    const [roles, owned, member, suppliers] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("stores").select("id, store_kind").eq("owner_id", userId),
      supabase.from("store_users").select("store_id, stores(store_kind)").eq("user_id", userId),
      supabase
        .from("suppliers")
        .select("id")
        .eq("portal_user_id", userId)
        .eq("portal_enabled", true)
        .limit(1),
    ]);

    const roleSet = new Set((roles.data ?? []).map((r) => r.role as string));
    const isAdmin = roleSet.has("platform_admin");
    const stores = [
      ...(owned.data ?? []).map((s) => ({ id: s.id as string, kind: s.store_kind as string | null })),
      ...((member.data ?? []) as { store_id: string; stores: { store_kind: string | null } | null }[]).map(
        (m) => ({ id: m.store_id, kind: m.stores?.store_kind ?? null }),
      ),
    ];
    const corporate = stores.some((s) => s.kind !== "micro");
    const micro = stores.find((s) => s.kind === "micro") ?? null;

    const merchant = isAdmin || roleSet.has("seller") || roleSet.has("agency") || corporate;
    const handmade = roleSet.has("home_maker") || Boolean(micro);
    const supplier = (suppliers.data ?? []).length > 0;
    // Mesajlar her oturum sahibine açıktır; kişi kapsamı sohbet sunucu işlevlerinde sınırlanır.
    const inbox = true;

    const primary: PortalKey = merchant ? "merchant" : handmade ? "handmade" : supplier ? "supplier" : "inbox";
    return { merchant, handmade, supplier, inbox, kolayStoreId: micro?.id ?? null, primary };
  });
