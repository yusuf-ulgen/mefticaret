import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Sunucu tarafı yetki yardımcıları.
 * Servis rolü (RLS bypass) ile yazma yapan server function'lar, RLS'te
 * `app_private.can_manage_store` ile korunan işlemler için bu yardımcıyı
 * kullanmalıdır; yalnızca üyelik kontrolü yeterli değildir.
 */

const MANAGER_ROLES = new Set(["owner", "admin"]);

/** Kullanıcının mağaza için yönetici (sahip/admin) veya platform admin olduğunu doğrular. */
export async function assertStoreManager(
  supabase: SupabaseClient<Database>,
  storeId: string,
  userId: string,
): Promise<void> {
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, owner_id")
    .eq("id", storeId)
    .maybeSingle();
  if (storeError) throw new Error(storeError.message);
  if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
  if (store.owner_id === userId) return;

  const { data: membership, error: memberError } = await supabase
    .from("store_users")
    .select("role")
    .eq("store_id", storeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (memberError) throw new Error(memberError.message);
  if (membership && MANAGER_ROLES.has(membership.role)) return;

  const { data: platformRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "platform_admin")
    .maybeSingle();
  if (platformRole) return;

  throw new Error("Bu işlem için mağaza yöneticisi yetkisi gerekir");
}
