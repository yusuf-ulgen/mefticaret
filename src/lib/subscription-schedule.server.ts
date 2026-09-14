import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

/**
 * Dönem sonuna gelmiş planlanmış abonelik değişikliklerini uygular:
 * - Düşürme: planlanan pakete geçiş.
 * - İptal: ücretsiz pakete düşürme (erişim dönem sonuna kadar sürdü).
 */
export async function applyScheduledSubscriptionChanges(
  admin: Admin,
): Promise<{ downgraded: number; expired: number }> {
  const now = new Date().toISOString();
  let downgraded = 0;
  let expired = 0;

  const { data: due } = await admin
    .from("subscriptions")
    .select(
      "id, store_id, scheduled_plan_id, scheduled_interval, scheduled_change_at, current_period_end, cancel_at_period_end, status",
    )
    .lte("current_period_end", now)
    .limit(200);

  const { data: freePlan } = await admin
    .from("plans")
    .select("id, currency, price_monthly")
    .eq("code", "free")
    .maybeSingle();

  for (const subscription of due ?? []) {
    if (subscription.scheduled_plan_id && (subscription.scheduled_change_at ?? now) <= now) {
      const { data: plan } = await admin
        .from("plans")
        .select("id, currency, price_monthly, price_yearly")
        .eq("id", subscription.scheduled_plan_id)
        .maybeSingle();
      if (!plan) continue;
      const interval = subscription.scheduled_interval ?? "monthly";
      await admin
        .from("subscriptions")
        .update({
          plan_id: plan.id,
          billing_interval: interval,
          amount: Number((interval === "yearly" ? plan.price_yearly : plan.price_monthly) ?? 0),
          currency: plan.currency ?? "TRY",
          scheduled_plan_id: null,
          scheduled_interval: null,
          scheduled_change_at: null,
        })
        .eq("id", subscription.id);
      await admin.from("stores").update({ plan_id: plan.id }).eq("id", subscription.store_id);
      downgraded += 1;
      continue;
    }

    if (
      freePlan &&
      (subscription.status === "canceled" || subscription.cancel_at_period_end) &&
      subscription.current_period_end <= now
    ) {
      await admin
        .from("subscriptions")
        .update({ status: "expired", plan_id: freePlan.id, amount: 0 })
        .eq("id", subscription.id);
      await admin.from("stores").update({ plan_id: freePlan.id }).eq("id", subscription.store_id);
      expired += 1;
    }
  }

  return { downgraded, expired };
}
