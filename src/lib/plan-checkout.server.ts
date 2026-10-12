import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { PLAN_RANK, type PlanInterval } from "@/lib/plan-tiers";
import { recordAudit } from "@/lib/audit.server";

/**
 * Paket satın alma / yükseltme akışı — tahsilat QNBpay üzerinden yapılır.
 *
 * İş kuralları (mağaza sahibiyle kararlaştırılan):
 * - Satın alma: ödeme onaylanınca mağaza aktifleşir, ödenmiş fatura kaydı oluşur, bildirim gider.
 * - Yükseltme hemen uygulanır; düşürme dönem sonunda uygulanır.
 * - Fiyat yalnızca sunucuda `plans` tablosundan okunur; istemci fiyat belirlemez.
 */

type Admin = SupabaseClient<Database>;

type PlanTransaction = {
  id: string;
  store_id: string | null;
  amount: number | string | null;
  currency: string | null;
  qnbpay_invoice_id: string;
  request_summary: unknown;
};

function metaOf(summary: unknown): { planId?: string; interval?: PlanInterval } {
  if (!summary || typeof summary !== "object") return {};
  const record = summary as Record<string, unknown>;
  const planId = typeof record["planId"] === "string" ? record["planId"] : undefined;
  const rawInterval = record["interval"];
  const interval =
    rawInterval === "monthly" || rawInterval === "yearly" ? (rawInterval as PlanInterval) : undefined;
  return { ...(planId ? { planId } : {}), ...(interval ? { interval } : {}) };
}

/** Mağaza yöneticisi için paket tahsilat bağlantısı üretir. */
export async function startPlanCheckout(
  supabase: SupabaseClient<Database>,
  input: { storeId: string; planId: string; billingInterval: PlanInterval },
  userId: string,
): Promise<{ link: string; amount: number; currency: string; planName: string }> {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(supabase, input.storeId, userId);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as Admin;

  const { data: targetStore } = await db
    .from("stores")
    .select("store_kind")
    .eq("id", input.storeId)
    .maybeSingle();
  if (!targetStore) throw new Error("Mağaza bulunamadı");
  if (targetStore.store_kind === "micro") {
    throw new Error("Kolay Panel kurumsal paketlere bağlı değildir");
  }

  const { data: plan, error } = await db
    .from("plans")
    .select("id, code, name, currency, price_monthly, price_yearly, is_active")
    .eq("id", input.planId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!plan || !plan.is_active) throw new Error("Paket bulunamadı");

  const amount = Number(
    (input.billingInterval === "yearly" ? plan.price_yearly : plan.price_monthly) ?? 0,
  );
  if (!(amount > 0)) {
    throw new Error("Bu paket için çevrimiçi ödeme alınmıyor, lütfen bizimle iletişime geçin.");
  }

  const { data: store } = await db
    .from("stores")
    .select("name, owner_id")
    .eq("id", input.storeId)
    .maybeSingle();

  const currency = (["TRY", "USD", "EUR"] as const).includes(
    (plan.currency ?? "TRY") as "TRY",
  )
    ? ((plan.currency ?? "TRY") as "TRY" | "USD" | "EUR")
    : "TRY";

  const label = input.billingInterval === "yearly" ? "yıllık" : "aylık";
  const description = `${plan.name} paketi (${label})`;
  const buyer = (store?.name ?? "Mefticaret").trim().split(" ");

  const { createChargeLink } = await import("@/lib/qnbpay-admin.server");
  const result = await createChargeLink(
    {
      purpose: "plan",
      amount,
      currency,
      description,
      buyerName: buyer[0] || "Mefticaret",
      buyerSurname: buyer.slice(1).join(" ") || "Magaza",
      storeId: input.storeId,
    },
    userId,
  );

  await db
    .from("qnbpay_transactions")
    .update({
      request_summary: {
        purpose: "plan",
        planId: plan.id,
        planCode: plan.code,
        interval: input.billingInterval,
        storeId: input.storeId,
      } as never,
    })
    .eq("id", result.id);

  return { link: result.link, amount, currency, planName: plan.name };
}

/** Ödemesi onaylanan paket işlemini aboneliğe uygular. */
export async function activatePlanFromTransaction(
  db: Admin,
  transaction: PlanTransaction,
): Promise<{ handled: boolean }> {
  const meta = metaOf(transaction.request_summary);
  const storeId = transaction.store_id;
  if (!storeId || !meta.planId || !meta.interval) return { handled: false };

  const { data: targetStore } = await db
    .from("stores")
    .select("store_kind")
    .eq("id", storeId)
    .maybeSingle();
  if (!targetStore || targetStore.store_kind === "micro") return { handled: false };

  const { data: plan } = await db
    .from("plans")
    .select("id, code, name, currency")
    .eq("id", meta.planId)
    .maybeSingle();
  if (!plan) return { handled: false };

  const interval = meta.interval;
  const amount = Number(transaction.amount ?? 0);
  const now = new Date();
  const periodStart = now.toISOString();
  const periodEnd = new Date(
    now.getTime() + (interval === "yearly" ? 365 : 30) * 86_400_000,
  ).toISOString();

  const { data: existing } = await db
    .from("subscriptions")
    .select("id, plan_id, status")
    .eq("store_id", storeId)
    .maybeSingle();

  const { data: currentPlan } = existing?.plan_id
    ? await db.from("plans").select("code").eq("id", existing.plan_id).maybeSingle()
    : { data: null };

  const currentRank = PLAN_RANK[currentPlan?.code ?? "free"] ?? 0;
  const nextRank = PLAN_RANK[plan.code] ?? 0;
  const isDowngrade = Boolean(existing) && nextRank < currentRank;

  const base = {
    store_id: storeId,
    status: "active" as Database["public"]["Enums"]["subscription_status"],
    billing_interval: interval as Database["public"]["Enums"]["billing_interval"],
    currency: transaction.currency ?? plan.currency ?? "TRY",
    amount,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: false,
    canceled_at: null,
    provider: "qnbpay",
    provider_subscription_id: transaction.qnbpay_invoice_id,
    provider_price_id: `${plan.code}_${interval}`,
    past_due_since: null,
  };

  const payload = isDowngrade
    ? {
        ...base,
        plan_id: existing?.plan_id ?? plan.id,
        scheduled_plan_id: plan.id,
        scheduled_interval: interval as Database["public"]["Enums"]["billing_interval"],
        scheduled_change_at: periodEnd,
      }
    : {
        ...base,
        plan_id: plan.id,
        scheduled_plan_id: null,
        scheduled_interval: null,
        scheduled_change_at: null,
        frozen_at: null,
      };

  if (existing) {
    await db.from("subscriptions").update(payload as never).eq("id", existing.id);
  } else {
    await db.from("subscriptions").insert({ ...payload, started_at: periodStart } as never);
  }

  if (!isDowngrade) {
    await db.from("stores").update({ status: "active", plan_id: plan.id }).eq("id", storeId);
  }

  await db.rpc("emit_notification", {
    _store_id: storeId,
    _kind: "subscription",
    _title: `Paket güncellendi: ${plan.name}`,
    _message: isDowngrade
      ? `${plan.name} paketi dönem sonunda geçerli olacak.`
      : `${plan.name} paketi hemen etkinleşti.`,
    _entity: "subscriptions",
    _entity_id: transaction.id,
    _meta: { interval, provider: "qnbpay" },
  } as never);

  await recordAudit(db as never, {
    action: "plan.purchase.settled",
    actorId: null,
    entity: "qnbpay_transactions",
    entityId: transaction.id,
    newValue: { planId: plan.id, interval, amount, isDowngrade },
    storeId,
  });

  return { handled: true };
}
