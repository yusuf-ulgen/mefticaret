import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { sendSms } from "@/lib/sms.server";

/**
 * Abonelik yenileme & tahsilat otomasyonu (yalnızca sunucu).
 * - Dönem bitimine 7 / 3 / 1 gün kala fatura üretir ve ödeme linkiyle hatırlatma gönderir.
 * - Vadesi geçen faturada önce panel uyarısı, 3 gün sonra mağaza dondurma uygular.
 */

type Admin = SupabaseClient<Database>;

export const PUBLIC_BASE_URL = "https://mefticaret.com";
export const GRACE_DAYS = 3;
const REMINDER_MILESTONES = [7, 3, 1] as const;
const DAY = 86_400_000;

export type LifecycleResult = {
  checked: number;
  invoicesIssued: number;
  remindersSent: number;
  warnings: number;
  frozen: number;
};

export function payUrl(token: string, baseUrl = PUBLIC_BASE_URL): string {
  return `${baseUrl}/fatura/${token}`;
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
}

function milestoneFor(daysLeft: number): 7 | 3 | 1 | null {
  if (daysLeft <= 1) return 1;
  if (daysLeft <= 3) return 3;
  if (daysLeft <= 7) return 7;
  return null;
}

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(amount);
}

async function alreadySent(admin: Admin, invoiceId: string, kind: string): Promise<boolean> {
  const { data } = await admin
    .from("billing_reminders")
    .select("id")
    .eq("invoice_id", invoiceId)
    .eq("kind", kind)
    .maybeSingle();
  return Boolean(data);
}

/** Panel bildirimi + (yapılandırılmışsa) e-posta ve SMS gönderimi, tek kayıt altında loglanır. */
async function notifyStore(
  admin: Admin,
  input: {
    storeId: string;
    subscriptionId: string;
    invoiceId: string;
    kind: string;
    notificationKind: Database["public"]["Enums"]["notification_kind"];
    title: string;
    message: string;
    link: string;
  },
): Promise<void> {
  const channels: string[] = ["panel"];

  await admin.rpc("emit_notification", {
    _store_id: input.storeId,
    _kind: input.notificationKind,
    _title: input.title,
    _message: input.message,
    _entity: "invoices",
    _entity_id: input.invoiceId,
    _meta: { pay_url: input.link, reminder: input.kind },
  });

  const { data: setting } = await admin
    .from("notification_settings")
    .select("email, sms, email_to, sms_to")
    .eq("store_id", input.storeId)
    .eq("kind", "subscription")
    .maybeSingle();

  const body = `${input.message}\nÖdeme linki: ${input.link}`;

  if (setting?.email && setting.email_to) {
    await admin.from("message_deliveries").insert({
      store_id: input.storeId,
      channel: "email",
      recipient: setting.email_to,
      subject: input.title,
      body,
      status: "queued",
    });
    channels.push("email");
  }

  if (setting?.sms && setting.sms_to) {
    const result = await sendSms(admin, {
      storeId: input.storeId,
      to: setting.sms_to,
      body: `${input.title}. ${input.link}`,
    });
    await admin.from("message_deliveries").insert({
      store_id: input.storeId,
      channel: "sms",
      recipient: setting.sms_to,
      subject: input.title,
      body,
      status: result.status,
      error: result.error,
      ...(result.status === "sent" ? { sent_at: new Date().toISOString() } : {}),
    });
    channels.push("sms");
  }

  await admin.from("billing_reminders").insert({
    store_id: input.storeId,
    subscription_id: input.subscriptionId,
    invoice_id: input.invoiceId,
    kind: input.kind,
    channel: channels.join(","),
    payload: { title: input.title, message: input.message, pay_url: input.link },
  });
}

/** Dönem için açık fatura yoksa faturayı üretir. */
async function ensureInvoiceForPeriod(
  admin: Admin,
  subscription: {
    id: string;
    store_id: string;
    amount: number;
    currency: string;
    current_period_start: string;
    current_period_end: string;
  },
): Promise<{ invoice: InvoiceRow | null; issued: boolean }> {
  const { data: existing } = await admin
    .from("invoices")
    .select("id, invoice_number, total, currency, status, due_at, pay_token, store_id, subscription_id")
    .eq("subscription_id", subscription.id)
    .gte("issued_at", subscription.current_period_start)
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { invoice: existing as InvoiceRow, issued: false };

  let cycleId: string | null = null;
  const { data: cycle } = await admin
    .from("billing_cycles")
    .select("id, status")
    .eq("subscription_id", subscription.id)
    .eq("period_start", subscription.current_period_start)
    .maybeSingle();

  if (cycle) {
    cycleId = cycle.id;
  } else {
    const { data: created } = await admin
      .from("billing_cycles")
      .insert({
        subscription_id: subscription.id,
        store_id: subscription.store_id,
        period_start: subscription.current_period_start,
        period_end: subscription.current_period_end,
        status: "open",
        amount_due: subscription.amount,
        currency: subscription.currency,
      })
      .select("id")
      .single();
    cycleId = created?.id ?? null;
  }

  const subtotal = Number(subscription.amount ?? 0);
  if (subtotal <= 0) return { invoice: null, issued: false };
  const taxTotal = Math.round(subtotal * 0.2 * 100) / 100;
  const number = `MEF-${new Date(subscription.current_period_end).toISOString().slice(0, 7).replace("-", "")}-${subscription.id.slice(0, 6).toUpperCase()}`;

  const { data: invoice, error } = await admin
    .from("invoices")
    .insert({
      store_id: subscription.store_id,
      subscription_id: subscription.id,
      billing_cycle_id: cycleId,
      invoice_number: number,
      status: "open",
      subtotal,
      tax_total: taxTotal,
      total: subtotal + taxTotal,
      currency: subscription.currency,
      line_items: [
        {
          description: "Abonelik yenileme",
          quantity: 1,
          unit_price: subtotal,
          total: subtotal,
        },
      ],
      due_at: subscription.current_period_end,
    })
    .select("id, invoice_number, total, currency, status, due_at, pay_token, store_id, subscription_id")
    .single();
  if (error) return { invoice: null, issued: false };

  if (cycleId) {
    await admin
      .from("billing_cycles")
      .update({ status: "invoiced", closed_at: new Date().toISOString(), amount_due: subtotal + taxTotal })
      .eq("id", cycleId);
  }

  return { invoice: invoice as InvoiceRow, issued: true };
}

type InvoiceRow = {
  id: string;
  invoice_number: string;
  total: number;
  currency: string;
  status: string;
  due_at: string | null;
  pay_token: string;
  store_id: string;
  subscription_id: string | null;
};

export async function processBillingLifecycle(
  admin: Admin,
  baseUrl = PUBLIC_BASE_URL,
): Promise<LifecycleResult> {
  const result: LifecycleResult = {
    checked: 0,
    invoicesIssued: 0,
    remindersSent: 0,
    warnings: 0,
    frozen: 0,
  };

  const { data: subscriptions, error } = await admin
    .from("subscriptions")
    .select(
      "id, store_id, status, amount, currency, current_period_start, current_period_end, cancel_at_period_end, past_due_since, frozen_at",
    )
    .in("status", ["trialing", "active", "past_due"])
    .limit(1000);
  if (error) throw new Error(error.message);

  for (const subscription of subscriptions ?? []) {
    result.checked += 1;
    const daysLeft = daysUntil(subscription.current_period_end);

    /* 1) Yenileme hatırlatıcıları */
    if (!subscription.cancel_at_period_end && daysLeft <= 7) {
      const { invoice, issued } = await ensureInvoiceForPeriod(admin, {
        id: subscription.id,
        store_id: subscription.store_id,
        amount: Number(subscription.amount ?? 0),
        currency: subscription.currency ?? "TRY",
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
      });
      if (issued) result.invoicesIssued += 1;

      const milestone = milestoneFor(daysLeft);
      if (invoice && invoice.status === "open" && milestone) {
        const kind = `reminder_${milestone}`;
        if (!(await alreadySent(admin, invoice.id, kind))) {
          const link = payUrl(invoice.pay_token, baseUrl);
          const remaining = Math.max(daysLeft, 0);
          await notifyStore(admin, {
            storeId: subscription.store_id,
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            kind,
            notificationKind: "subscription",
            title:
              remaining <= 1
                ? "Aboneliğiniz yarın yenilenecek"
                : `Aboneliğiniz ${remaining} gün içinde yenilenecek`,
            message: `${invoice.invoice_number} numaralı fatura tutarı ${money(Number(invoice.total), invoice.currency)}. Kesintisiz hizmet için ödemenizi tamamlayın.`,
            link,
          });
          result.remindersSent += 1;
        }
      }
    }

    /* 2) Vadesi geçen faturalar: kademeli kısıtlama */
    const { data: overdue } = await admin
      .from("invoices")
      .select("id, invoice_number, total, currency, status, due_at, pay_token, store_id, subscription_id")
      .eq("subscription_id", subscription.id)
      .eq("status", "open")
      .lt("due_at", new Date().toISOString())
      .order("due_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!overdue) {
      if (subscription.past_due_since || subscription.frozen_at) {
        await restoreAfterPayment(admin, subscription.store_id);
      }
      continue;
    }


    const invoice = overdue as InvoiceRow;
    const link = payUrl(invoice.pay_token, baseUrl);
    const pastDueSince = subscription.past_due_since ?? new Date().toISOString();

    if (subscription.status !== "past_due" || !subscription.past_due_since) {
      await admin
        .from("subscriptions")
        .update({ status: "past_due", past_due_since: pastDueSince })
        .eq("id", subscription.id);
    }

    if (!(await alreadySent(admin, invoice.id, "past_due_warning"))) {
      await notifyStore(admin, {
        storeId: subscription.store_id,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        kind: "past_due_warning",
        notificationKind: "payment_failed",
        title: "Ödeme alınamadı — mağazanız risk altında",
        message: `${invoice.invoice_number} numaralı faturanın vadesi geçti. ${GRACE_DAYS} gün içinde ödeme yapılmazsa mağazanız geçici olarak donduruluyor.`,
        link,
      });
      result.warnings += 1;
    }

    const graceOver = Date.now() - new Date(pastDueSince).getTime() >= GRACE_DAYS * DAY;
    if (!graceOver) continue;

    const { data: store } = await admin
      .from("stores")
      .select("id, status")
      .eq("id", subscription.store_id)
      .maybeSingle();

    if (store && store.status !== "suspended") {
      await admin.from("stores").update({ status: "suspended" }).eq("id", store.id);
      await admin
        .from("subscriptions")
        .update({ frozen_at: new Date().toISOString() })
        .eq("id", subscription.id);
    }

    if (!(await alreadySent(admin, invoice.id, "store_frozen"))) {
      await notifyStore(admin, {
        storeId: subscription.store_id,
        subscriptionId: subscription.id,
        invoiceId: invoice.id,
        kind: "store_frozen",
        notificationKind: "payment_failed",
        title: "Mağazanız donduruldu",
        message: `${invoice.invoice_number} numaralı fatura ödenmediği için mağazanız satışa kapatıldı. Ödeme tamamlandığında mağaza anında yeniden açılır.`,
        link,
      });
      result.frozen += 1;
    }
  }

  return result;
}

/** Fatura ödendiğinde kısıtlamaları kaldırır (dondurulmuş mağazayı yeniden açar). */
export async function restoreAfterPayment(admin: Admin, storeId: string): Promise<void> {
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, frozen_at")
    .eq("store_id", storeId)
    .maybeSingle();

  const { count } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("status", "open")
    .lt("due_at", new Date().toISOString());
  if ((count ?? 0) > 0) return;

  if (subscription) {
    await admin
      .from("subscriptions")
      .update({ status: "active", past_due_since: null, frozen_at: null })
      .eq("id", subscription.id);
  }

  if (subscription?.frozen_at) {
    await admin.from("stores").update({ status: "active" }).eq("id", storeId);
  }
}
