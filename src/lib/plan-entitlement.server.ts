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
    .eq("role", "platform_admin")
    .maybeSingle();
  if (platformRole) return;

  // Ödemesi tamamlanmış bir paket işlemi var mı?
  const { data: paidTransaction } = await supabase
    .from("qnbpay_transactions")
    .select("id")
    .eq("store_id", storeId)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("id, plan_id, status")
    .eq("store_id", storeId)
    .eq("plan_id", planId)
    .in("status", ["active", "trialing"])
    .maybeSingle();

  if (paidTransaction || subscription) return;

  throw new Error("Ücretli pakete geçmek için ödeme gerekir");
}
