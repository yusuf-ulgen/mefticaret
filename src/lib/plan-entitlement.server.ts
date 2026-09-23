import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/**
 * Paket yetkisi sunucuda türetilir.
 *
 * Ücretli bir paket yalnızca gerçek ödeme akışıyla (QNBpay işlemi onaylandığında
 * `activatePlanFromTransaction`) ya da platform yöneticisi tarafından atanabilir.
 * Mağaza yöneticisinin istemciden gönderdiği paket kimliği tek başına yetki vermez.
 */
export async function assertPlanEntitlement(
  supabase: SupabaseClient<Database>,
  storeId: string,
  planId: string,
  userId: string,
): Promise<void> {
  const { data: plan, error } = await supabase
    .from("plans")
    .select("id, price_monthly, price_yearly")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!plan) throw new Error("Paket bulunamadı");

  const isFree = Number(plan.price_monthly ?? 0) <= 0 && Number(plan.price_yearly ?? 0) <= 0;
  if (isFree) return;

  const { data: platformRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "platform_admin")
    .maybeSingle();
  if (platformRole) return;

  // Ödeme akışı bu paketi zaten etkinleştirmişse (abonelik kaydı) değişikliğe izin verilir.
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("store_id", storeId)
    .eq("plan_id", planId)
    .in("status", ["active", "trialing"])
    .maybeSingle();
  if (subscription) return;

  throw new Error("Ücretli pakete geçmek için ödeme gerekir");
}
