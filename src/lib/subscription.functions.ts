import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { insertAuditRow } from "./audit.server";

/** Abonelik sunucu fonksiyonları: paket limitleri (admin), abonelik yönetimi, kullanım kaydı ve fatura üretimi. */

const featureSchema = z.object({
  metricKey: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9_]+$/, "Metrik anahtarı küçük harf, rakam ve alt çizgi içerebilir"),
  label: z.string().min(1).max(80),
  unit: z.string().max(30).nullable().optional(),
  limitValue: z.number().int().min(-1).max(1_000_000_000).nullable().optional(),
  isEnabled: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

/** Bir paketin limit tanımlarını (plan_features) toplu kaydeder. */
export const savePlanFeatures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ planId: z.guid(), features: z.array(featureSchema).max(60) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: role, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "platform_admin")
      .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!role) throw new Error("Bu işlem yalnızca platform yöneticileri içindir");

    const keys = data.features.map((feature) => feature.metricKey);
    if (new Set(keys).size !== keys.length) throw new Error("Metrik anahtarları tekrarlanamaz");

    const { error: deleteError } = await supabase
      .from("plan_features")
      .delete()
      .eq("plan_id", data.planId)
      .not("metric_key", "in", `(${keys.length ? keys.join(",") : "__none__"})`);
    if (deleteError) throw new Error(deleteError.message);

    if (data.features.length) {
      const { error: upsertError } = await supabase.from("plan_features").upsert(
        data.features.map((feature) => ({
          plan_id: data.planId,
          metric_key: feature.metricKey,
          label: feature.label,
          unit: feature.unit ?? null,
          limit_value: feature.limitValue ?? null,
          is_enabled: feature.isEnabled,
          sort_order: feature.sortOrder,
        })),
        { onConflict: "plan_id,metric_key" },
      );
      if (upsertError) throw new Error(upsertError.message);
    }

    await insertAuditRow(supabase, {
      actor_id: userId,
      action: "platform.plan_limits_updated",
      entity: "plan_features",
      entity_id: data.planId,
      new_value: { count: data.features.length },
    });

    return { planId: data.planId, count: data.features.length };
  });

/** Mağaza aboneliğini oluşturur/günceller: paket, dönem (aylık/yıllık) ve deneme süresi. */
export const upsertSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        planId: z.guid(),
        billingInterval: z.enum(["monthly", "yearly"]),
        startTrial: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: store } = await supabase
      .from("stores")
      .select("store_kind")
      .eq("id", data.storeId)
      .maybeSingle();
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");
    if (store.store_kind === "micro") throw new Error("Kolay Panel kurumsal aboneliklere bağlı değildir");

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("id, code, name, price_monthly, price_yearly, currency, trial_days, is_active")
      .eq("id", data.planId)
      .maybeSingle();
    if (planError) throw new Error(planError.message);
    if (!plan || !plan.is_active) throw new Error("Paket bulunamadı veya aktif değil");

    // Ücretli abonelik yalnızca ödeme onayı ya da platform yöneticisi ile açılır.
    const { assertPlanEntitlement } = await import("./plan-entitlement.server");
    await assertPlanEntitlement(supabase, data.storeId, plan.id, userId);

    const { data: existing, error: existingError } = await supabase
      .from("subscriptions")
      .select("id, plan_id, billing_interval, status, trial_ends_at")
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    const now = new Date();
    const periodEnd = new Date(now);
    if (data.billingInterval === "yearly") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const trialDays = Number(plan.trial_days ?? 0);
    const useTrial = data.startTrial && trialDays > 0 && !existing?.trial_ends_at;
    const trialEndsAt = useTrial
      ? new Date(now.getTime() + trialDays * 86_400_000).toISOString()
      : (existing?.trial_ends_at ?? null);

    const amount =
      data.billingInterval === "yearly"
        ? Number(plan.price_yearly ?? 0)
        : Number(plan.price_monthly ?? 0);

    const payload = {
      store_id: data.storeId,
      plan_id: plan.id,
      billing_interval: data.billingInterval,
      currency: plan.currency ?? "TRY",
      amount,
      status: (useTrial ? "trialing" : "active") as "trialing" | "active",
      trial_ends_at: trialEndsAt,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      canceled_at: null,
    };

    const { data: saved, error: saveError } = await supabase
      .from("subscriptions")
      .upsert(payload, { onConflict: "store_id" })
      .select("id")
      .single();
    if (saveError) throw new Error(saveError.message);

    await supabase
      .from("subscription_items")
      .delete()
      .eq("subscription_id", saved.id)
      .eq("kind", "plan");
    await supabase.from("subscription_items").insert({
      subscription_id: saved.id,
      store_id: data.storeId,
      kind: "plan",
      description: `${plan.name} — ${data.billingInterval === "yearly" ? "yıllık" : "aylık"} abonelik`,
      quantity: 1,
      unit_price: amount,
      currency: plan.currency ?? "TRY",
    });

    {
      // Yetki ve ödeme kontrolü yukarıda yapıldı; ücretli paket yalnız sunucu tarafından uygulanır.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("stores").update({ plan_id: plan.id }).eq("id", data.storeId);
    }

    await supabase.from("billing_cycles").insert({
      subscription_id: saved.id,
      store_id: data.storeId,
      period_start: payload.current_period_start,
      period_end: payload.current_period_end,
      status: "open",
      amount_due: amount,
      currency: plan.currency ?? "TRY",
    });

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "store.subscription_changed",
      entity: "subscriptions",
      entity_id: saved.id,
      old_value: { plan_id: existing?.plan_id ?? null, interval: existing?.billing_interval ?? null },
      new_value: { plan_id: plan.id, interval: data.billingInterval, trial_ends_at: trialEndsAt },
    });

    return { subscriptionId: saved.id, planName: plan.name, amount, trialEndsAt };
  });

/** Aboneliği dönem sonunda iptal eder veya iptali geri alır. */
export const setSubscriptionCancellation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), cancel: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: updated, error } = await supabase
      .from("subscriptions")
      .update({
        cancel_at_period_end: data.cancel,
        canceled_at: data.cancel ? new Date().toISOString() : null,
      })
      .eq("store_id", data.storeId)
      .select("id, cancel_at_period_end")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Abonelik bulunamadı veya yetkiniz yok");

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: data.cancel ? "store.subscription_cancel_scheduled" : "store.subscription_resumed",
      entity: "subscriptions",
      entity_id: updated.id,
      new_value: { cancel_at_period_end: data.cancel },
    });

    return { cancelAtPeriodEnd: updated.cancel_at_period_end };
  });

/** Kullanım kaydı ekler (AI, e-posta, SMS, API, depolama vb.). */
export const recordUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        metricKey: z.string().min(2).max(40),
        quantity: z.number().min(-1_000_000).max(1_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("store_id", data.storeId)
      .maybeSingle();

    const period = new Date();
    period.setDate(1);

    const { error } = await supabase.from("usage_records").insert({
      store_id: data.storeId,
      subscription_id: subscription?.id ?? null,
      metric_key: data.metricKey,
      quantity: data.quantity,
      period_start: period.toISOString().slice(0, 10),
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

/** Açık faturalama dönemini kapatıp fatura üretir. */
export const issueInvoiceForCycle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), cycleId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: cycle, error: cycleError } = await supabase
      .from("billing_cycles")
      .select("*")
      .eq("id", data.cycleId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (cycleError) throw new Error(cycleError.message);
    if (!cycle) throw new Error("Faturalama dönemi bulunamadı");
    if (cycle.status === "invoiced") throw new Error("Bu dönem için fatura zaten oluşturuldu");

    const { data: items, error: itemsError } = await supabase
      .from("subscription_items")
      .select("description, quantity, unit_price")
      .eq("subscription_id", cycle.subscription_id);
    if (itemsError) throw new Error(itemsError.message);

    const lineItems = (items ?? []).map((item) => ({
      description: item.description,
      quantity: Number(item.quantity ?? 1),
      unit_price: Number(item.unit_price ?? 0),
      total: Number(item.quantity ?? 1) * Number(item.unit_price ?? 0),
    }));
    const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const taxTotal = Math.round(subtotal * 0.2 * 100) / 100;

    const number = `MEF-${new Date(cycle.period_start).toISOString().slice(0, 7).replace("-", "")}-${cycle.id.slice(0, 6).toUpperCase()}`;
    const dueAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        store_id: data.storeId,
        subscription_id: cycle.subscription_id,
        billing_cycle_id: cycle.id,
        invoice_number: number,
        status: "open",
        subtotal,
        tax_total: taxTotal,
        total: subtotal + taxTotal,
        currency: cycle.currency,
        line_items: lineItems,
        due_at: dueAt,
      })
      .select("id, invoice_number, total")
      .single();
    if (invoiceError) throw new Error(invoiceError.message);

    const { error: closeError } = await supabase
      .from("billing_cycles")
      .update({ status: "invoiced", closed_at: new Date().toISOString(), amount_due: subtotal + taxTotal })
      .eq("id", cycle.id);
    if (closeError) throw new Error(closeError.message);

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "store.invoice_issued",
      entity: "invoices",
      entity_id: invoice.id,
      new_value: { invoice_number: invoice.invoice_number, total: invoice.total },
    });

    return { invoiceNumber: invoice.invoice_number, total: Number(invoice.total) };
  });

/** Faturayı ödendi olarak işaretler. */
export const markInvoicePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), invoiceId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", data.invoiceId)
      .eq("store_id", data.storeId)
      .select("id, invoice_number")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invoice) throw new Error("Fatura bulunamadı veya yetkiniz yok");

    await supabase
      .from("subscriptions")
      .update({ status: "active" })
      .eq("store_id", data.storeId);

    // Kademeli kısıtlamayı kaldır: dondurulmuş mağazayı yeniden aç.
    const [{ supabaseAdmin }, { restoreAfterPayment }] = await Promise.all([
      import("@/integrations/supabase/client.server"),
      import("@/lib/billing-lifecycle.server"),
    ]);
    await restoreAfterPayment(supabaseAdmin, data.storeId);


    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: "store.invoice_paid",
      entity: "invoices",
      entity_id: invoice.id,
      new_value: { invoice_number: invoice.invoice_number },
    });

    return { ok: true };
  });
