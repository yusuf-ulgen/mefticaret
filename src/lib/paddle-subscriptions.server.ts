import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { PLAN_RANK, parsePlanPriceId, type PlanInterval } from "@/lib/paddle-plans";
import type { PaddleEnv } from "@/lib/paddle.server";

/**
 * Ödeme sağlayıcısı (Paddle) abonelik olaylarının iş kuralları — yalnızca sunucu.
 *
 * Kurallar (mağaza sahibiyle kararlaştırılan):
 * - Satın alma: mağaza hemen aktifleşir, fatura kaydı oluşur, bildirim gönderilir.
 * - İptal: dönem sonuna kadar erişim sürer, sonra ücretsiz pakete düşer.
 * - Yükseltme hemen uygulanır, düşürme dönem sonunda uygulanır.
 * - Ödeme başarısız: mevcut kural (panel uyarısı + 3 gün sonra dondurma) korunur.
 */

type Admin = SupabaseClient<Database>;

type SubscriptionEvent = {
  id: string;
  status: string;
  customerId?: string | null;
  customData?: unknown;
  scheduledChange?: { action?: string; effectiveAt?: string | null } | null;
  currentBillingPeriod?: { startsAt?: string | null; endsAt?: string | null } | null;
  items?: Array<{ price?: { id?: string; productId?: string } | null }>;
};

const STATUS_MAP: Record<string, Database["public"]["Enums"]["subscription_status"]> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  paused: "past_due",
  canceled: "canceled",
};

function customStoreId(customData: unknown): string | null {
  if (!customData || typeof customData !== "object") return null;
  const value = (customData as Record<string, unknown>)["storeId"];
  return typeof value === "string" && value.length > 20 ? value : null;
}

/** Paddle fiyatının external_id'sini (örn. "starter_monthly") gateway üzerinden okur. */
async function readPriceExternalId(env: PaddleEnv, paddlePriceId: string): Promise<string | null> {
  const { gatewayFetch } = await import("@/lib/paddle.server");
  const response = await gatewayFetch(env, `/prices/${encodeURIComponent(paddlePriceId)}`);
  if (!response.ok) return null;
  const body = (await response.json()) as { data?: { custom_data?: unknown; id?: string } };
  const importMeta = (body.data as { import_meta?: { external_id?: string } } | undefined)
    ?.import_meta;
  return importMeta?.external_id ?? null;
}

async function findPlan(admin: Admin, code: string) {
  const { data } = await admin
    .from("plans")
    .select("id, code, name, currency, price_monthly, price_yearly")
    .eq("code", code)
    .maybeSingle();
  return data;
}

async function nextInvoiceNumber(admin: Admin): Promise<string> {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MEF-${stamp}-${suffix}`;
}

/** Abonelik olayını (created/updated/activated/canceled) veritabanına uygular. */
export async function applySubscriptionEvent(
  admin: Admin,
  env: PaddleEnv,
  event: SubscriptionEvent,
): Promise<{ handled: boolean; storeId?: string }> {
  const storeId = customStoreId(event.customData);
  if (!storeId) return { handled: false };

  const paddlePriceId = event.items?.[0]?.price?.id ?? null;
  const externalId = paddlePriceId ? await readPriceExternalId(env, paddlePriceId) : null;
  const parsed = parsePlanPriceId(externalId);
  if (!parsed) return { handled: false, storeId };

  const plan = await findPlan(admin, parsed.slug);
  if (!plan) return { handled: false, storeId };

  const status = STATUS_MAP[event.status] ?? "active";
  const interval: PlanInterval = parsed.interval;
  const amount = Number(
    (interval === "yearly" ? plan.price_yearly : plan.price_monthly) ?? 0,
  );
  const periodStart = event.currentBillingPeriod?.startsAt ?? new Date().toISOString();
  const periodEnd =
    event.currentBillingPeriod?.endsAt ??
    new Date(Date.now() + (interval === "yearly" ? 365 : 30) * 86_400_000).toISOString();

  const { data: existing } = await admin
    .from("subscriptions")
    .select("id, plan_id, status, frozen_at")
    .eq("store_id", storeId)
    .maybeSingle();

  const { data: currentPlan } = existing?.plan_id
    ? await admin.from("plans").select("code").eq("id", existing.plan_id).maybeSingle()
    : { data: null };

  const currentRank = PLAN_RANK[currentPlan?.code ?? "free"] ?? 0;
  const nextRank = PLAN_RANK[plan.code] ?? 0;
  const isDowngrade = Boolean(existing) && nextRank < currentRank;
  const cancelScheduled = event.scheduledChange?.action === "cancel";

  const base = {
    store_id: storeId,
    status,
    billing_interval: interval as Database["public"]["Enums"]["billing_interval"],
    currency: plan.currency ?? "TRY",
    amount,
    current_period_start: periodStart,
    current_period_end: periodEnd,
    cancel_at_period_end: cancelScheduled,
    canceled_at: event.status === "canceled" ? new Date().toISOString() : null,
    provider: "paddle",
    provider_subscription_id: event.id,
    provider_customer_id: event.customerId ?? null,
    provider_price_id: externalId,
    environment: env,
    past_due_since: status === "past_due" ? new Date().toISOString() : null,
  };

  // Düşürme dönem sonunda uygulanır; paket alanı şimdilik değişmez.
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
        frozen_at: status === "past_due" ? existing?.frozen_at ?? null : null,
      };

  if (existing) {
    await admin.from("subscriptions").update(payload).eq("id", existing.id);
  } else {
    await admin.from("subscriptions").insert({ ...payload, started_at: periodStart });
  }

  // Satın alma / yenileme: mağaza hemen aktifleşir ve yükseltme anında geçerli olur.
  if ((status === "active" || status === "trialing") && !isDowngrade) {
    await admin.from("stores").update({ status: "active", plan_id: plan.id }).eq("id", storeId);
  }

  await admin.rpc("emit_notification", {
    _store_id: storeId,
    _kind: status === "past_due" ? "payment_failed" : "subscription",
    _title:
      status === "past_due"
        ? "Abonelik ödemesi alınamadı"
        : event.status === "canceled"
          ? "Abonelik iptal edildi"
          : `Abonelik güncellendi: ${plan.name}`,
    _message:
      status === "past_due"
        ? "Ödeme tekrar denenecek. 3 gün içinde ödeme alınmazsa mağazanız geçici olarak dondurulur."
        : event.status === "canceled"
          ? "Erişiminiz ödediğiniz dönem sonuna kadar açık kalacak."
          : isDowngrade
            ? `${plan.name} paketi dönem sonunda geçerli olacak.`
            : `${plan.name} paketi hemen etkinleşti.`,
    _entity: "subscriptions",
    _entity_id: event.id,
    _meta: { interval, provider: "paddle", environment: env },
  });

  return { handled: true, storeId };
}

/** Tamamlanan ödeme için ödenmiş fatura kaydı oluşturur. */
export async function recordCompletedTransaction(
  admin: Admin,
  env: PaddleEnv,
  event: {
    id: string;
    customData?: unknown;
    subscriptionId?: string | null;
    currencyCode?: string | null;
    details?: { totals?: { total?: string | null; tax?: string | null; subtotal?: string | null } };
  },
): Promise<{ handled: boolean }> {
  const storeId = customStoreId(event.customData);
  if (!storeId) return { handled: false };

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id")
    .eq("store_id", storeId)
    .maybeSingle();

  const toMajor = (value?: string | null) => {
    const zeroDecimal = new Set(["JPY", "KRW", "VND"]);
    const raw = Number(value ?? 0);
    return zeroDecimal.has((event.currencyCode ?? "TRY").toUpperCase()) ? raw : raw / 100;
  };

  const { data: already } = await admin
    .from("invoices")
    .select("id")
    .eq("store_id", storeId)
    .contains("line_items", [{ provider_transaction_id: event.id }])
    .maybeSingle();
  if (already) return { handled: true };

  const now = new Date().toISOString();
  await admin.from("invoices").insert({
    store_id: storeId,
    subscription_id: subscription?.id ?? null,
    invoice_number: await nextInvoiceNumber(admin),
    status: "paid",
    subtotal: toMajor(event.details?.totals?.subtotal),
    tax_total: toMajor(event.details?.totals?.tax),
    total: toMajor(event.details?.totals?.total),
    currency: event.currencyCode ?? "TRY",
    line_items: [
      {
        label: "Abonelik ödemesi",
        provider: "paddle",
        provider_transaction_id: event.id,
        environment: env,
      },
    ],
    issued_at: now,
    paid_at: now,
  });

  const { restoreAfterPayment } = await import("@/lib/billing-lifecycle.server");
  await restoreAfterPayment(admin, storeId);

  await admin.rpc("emit_notification", {
    _store_id: storeId,
    _kind: "payment",
    _title: "Ödeme alındı",
    _message: "Abonelik ödemeniz başarıyla tahsil edildi ve faturanız oluşturuldu.",
    _entity: "invoices",
    _entity_id: event.id,
    _meta: { provider: "paddle", environment: env },
  });

  return { handled: true };
}

/**
 * Dönem sonuna gelmiş planlanmış değişiklikleri uygular:
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
