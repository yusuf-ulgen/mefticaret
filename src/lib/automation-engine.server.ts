import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { renderTemplate } from "@/lib/automation";
import { sendWhatsAppMessage } from "@/lib/whatsapp.server";

type Client = SupabaseClient<Database>;
type Run = Database["public"]["Tables"]["automation_runs"]["Row"];
type Step = Database["public"]["Tables"]["automation_steps"]["Row"];
type Template = Database["public"]["Tables"]["message_templates"]["Row"];

/**
 * Otomasyon motoru: zamanı gelmiş çalıştırmaları adım adım ilerletir.
 * Bekleme, mesaj gönderimi ve koşullu dallanma burada işlenir.
 */

function nowIso() {
  return new Date().toISOString();
}

function plusMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

async function log(
  supabase: Client,
  run: Run,
  step: Step | null,
  kind: Step["kind"],
  outcome: string,
  message?: string,
) {
  await supabase.from("automation_run_events").insert({
    run_id: run.id,
    store_id: run.store_id,
    step_id: step?.id ?? null,
    kind,
    outcome,
    message: message ?? null,
  });
}

async function buildVariables(supabase: Client, run: Run) {
  const [{ data: store }, customer, order, cart] = await Promise.all([
    supabase.from("stores").select("name").eq("id", run.store_id).maybeSingle(),
    run.customer_id
      ? supabase.from("customers").select("*").eq("id", run.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
    run.order_id
      ? supabase.from("orders").select("*").eq("id", run.order_id).maybeSingle()
      : Promise.resolve({ data: null }),
    run.cart_id
      ? supabase.from("abandoned_carts").select("*").eq("id", run.cart_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const context = (run.context ?? {}) as Record<string, string | number | null>;

  return {
    vars: {
      magaza_adi: store?.name ?? "",
      musteri_adi: customer.data?.full_name ?? String(context["musteri_adi"] ?? "Değerli müşterimiz"),
      sepet_tutari: cart.data?.total ?? String(context["sepet_tutari"] ?? ""),
      sepet_linki: String(context["sepet_linki"] ?? ""),
      siparis_no: order.data?.order_number ?? String(context["siparis_no"] ?? ""),
      kargo_takip: order.data?.tracking_number ?? String(context["kargo_takip"] ?? ""),
      indirim_kodu: String(context["indirim_kodu"] ?? ""),
    } as Record<string, string | number | null>,
    customer: customer.data,
    cart: cart.data,
    order: order.data,
    context,
  };
}

async function dispatchMessage(
  supabase: Client,
  run: Run,
  step: Step,
  channel: Database["public"]["Enums"]["message_channel"],
) {
  const { vars, customer, cart, context } = await buildVariables(supabase, run);

  let template: Template | null = null;
  if (step.template_id) {
    const { data } = await supabase
      .from("message_templates")
      .select("*")
      .eq("id", step.template_id)
      .maybeSingle();
    template = data;
  }

  const body = renderTemplate(template?.body ?? String((step.config as any)?.body ?? ""), vars);
  const subject = template?.subject ? renderTemplate(template.subject, vars) : null;

  const email = customer?.email ?? cart?.customer_email ?? String(context["email"] ?? "");
  const phone = customer?.phone ?? String(context["phone"] ?? "");
  const recipient = channel === "email" ? email : channel === "push" ? (customer?.id ?? "") : phone;

  if (!recipient) {
    await log(supabase, run, step, step.kind, "skipped", "Alıcı bilgisi yok");
    return;
  }

  let status: Database["public"]["Enums"]["message_delivery_status"] = "queued";
  let error: string | null = null;

  if (channel === "whatsapp") {
    const result = await sendWhatsAppMessage(supabase, {
      storeId: run.store_id,
      waId: recipient,
      body,
      templateName: template?.whatsapp_template_name ?? null,
      templateLanguage: template?.whatsapp_language ?? "tr",
      contactName: customer?.full_name ?? null,
      customerId: customer?.id ?? null,
    });
    status = result.status;
    error = result.error;
  } else {
    error = "Kanal sağlayıcısı bağlanana kadar mesaj kuyrukta bekliyor";
  }

  await supabase.from("message_deliveries").insert({
    store_id: run.store_id,
    channel,
    run_id: run.id,
    template_id: template?.id ?? null,
    customer_id: customer?.id ?? null,
    recipient,
    subject,
    body,
    status,
    error,
    sent_at: status === "sent" ? nowIso() : null,
  });

  await log(supabase, run, step, step.kind, status === "failed" ? "failed" : "sent", error ?? undefined);

  if (status !== "failed") {
    const { data: workflow } = await supabase
      .from("automation_workflows")
      .select("messages_sent")
      .eq("id", run.workflow_id)
      .maybeSingle();
    await supabase
      .from("automation_workflows")
      .update({ messages_sent: (workflow?.messages_sent ?? 0) + 1 })
      .eq("id", run.workflow_id);
  }
}

async function evaluateCondition(supabase: Client, run: Run, step: Step) {
  const kind = step.condition_kind;
  if (!kind) return false;

  if (kind === "order_placed" || kind === "order_paid") {
    if (run.order_id) return true;
    if (!run.customer_id) return false;
    const query = supabase
      .from("orders")
      .select("id")
      .eq("store_id", run.store_id)
      .eq("customer_id", run.customer_id)
      .gte("placed_at", run.created_at)
      .limit(1);
    const { data } = kind === "order_paid" ? await query.eq("payment_status", "paid") : await query;
    return (data ?? []).length > 0;
  }

  if (kind === "cart_still_active") {
    if (!run.cart_id) return false;
    const { data } = await supabase
      .from("abandoned_carts")
      .select("recovered_order_id")
      .eq("id", run.cart_id)
      .maybeSingle();
    return Boolean(data) && !data?.recovered_order_id;
  }

  if (kind === "has_tag") {
    const tag = String((step.config as any)?.tag ?? "").toLowerCase();
    if (!tag || !run.customer_id) return false;
    const { data } = await supabase
      .from("customers")
      .select("tags")
      .eq("id", run.customer_id)
      .maybeSingle();
    return (data?.tags ?? []).some((value) => value.toLowerCase() === tag);
  }

  // email_opened: e-posta sağlayıcısı bağlanınca teslim kayıtlarından okunur.
  return false;
}

async function completeRun(supabase: Client, run: Run, status: Run["status"], error?: string) {
  await supabase
    .from("automation_runs")
    .update({
      status,
      completed_at: nowIso(),
      last_error: error ?? null,
    })
    .eq("id", run.id);

  if (status === "completed") {
    const { data: workflow } = await supabase
      .from("automation_workflows")
      .select("completed_count")
      .eq("id", run.workflow_id)
      .maybeSingle();
    await supabase
      .from("automation_workflows")
      .update({ completed_count: (workflow?.completed_count ?? 0) + 1 })
      .eq("id", run.workflow_id);
  }
}

/** Tek bir çalıştırmayı bir adım ilerletir. */
export async function advanceRun(supabase: Client, run: Run) {
  const { data: steps } = await supabase
    .from("automation_steps")
    .select("*")
    .eq("workflow_id", run.workflow_id)
    .order("position", { ascending: true });

  const ordered = steps ?? [];
  const step = ordered[run.current_position];

  if (!step) {
    await completeRun(supabase, run, "completed");
    return "completed";
  }

  try {
    if (step.kind === "end") {
      await log(supabase, run, step, step.kind, "ok");
      await completeRun(supabase, run, "completed");
      return "completed";
    }

    if (step.kind === "wait") {
      await log(supabase, run, step, step.kind, "ok", `${step.wait_minutes} dakika bekleniyor`);
      await supabase
        .from("automation_runs")
        .update({
          current_position: run.current_position + 1,
          status: "waiting",
          next_run_at: plusMinutes(step.wait_minutes),
        })
        .eq("id", run.id);
      return "waiting";
    }

    if (step.kind === "condition") {
      const result = await evaluateCondition(supabase, run, step);
      const branch = result ? step.on_true : step.on_false;
      await log(supabase, run, step, step.kind, result ? "true" : "false", branch);
      if (branch === "end") {
        await completeRun(supabase, run, "completed");
        return "completed";
      }
      await supabase
        .from("automation_runs")
        .update({
          current_position: run.current_position + 1,
          status: "active",
          next_run_at: nowIso(),
        })
        .eq("id", run.id);
      return "advanced";
    }

    await dispatchMessage(supabase, run, step, step.kind);
    await supabase
      .from("automation_runs")
      .update({
        current_position: run.current_position + 1,
        status: "active",
        next_run_at: nowIso(),
      })
      .eq("id", run.id);
    return "advanced";
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "bilinmeyen hata";
    await log(supabase, run, step, step.kind, "failed", message);
    await completeRun(supabase, run, "failed", message);
    return "failed";
  }
}

/** Zamanı gelmiş tüm çalıştırmaları işler (cron ya da manuel tetikleme). */
export async function processDueRuns(supabase: Client, limit = 50, storeId?: string) {
  let query = supabase
    .from("automation_runs")
    .select("*")
    .in("status", ["active", "waiting"])
    .lte("next_run_at", nowIso())
    .order("next_run_at", { ascending: true })
    .limit(limit);

  if (storeId) query = query.eq("store_id", storeId);

  const { data: runs, error } = await query;
  if (error) throw new Error(error.message);

  const results = { processed: 0, completed: 0, waiting: 0, failed: 0 };
  for (const run of runs ?? []) {
    const outcome = await advanceRun(supabase, run);
    results.processed += 1;
    if (outcome === "completed") results.completed += 1;
    if (outcome === "waiting") results.waiting += 1;
    if (outcome === "failed") results.failed += 1;
  }
  return results;
}

/** Bir tetikleyiciye bağlı aktif akışlara kayıt açar. */
export async function enrollTrigger(
  supabase: Client,
  input: {
    storeId: string;
    trigger: Database["public"]["Enums"]["automation_trigger"];
    customerId?: string | null;
    orderId?: string | null;
    cartId?: string | null;
    context?: Record<string, unknown>;
    delayMinutes?: number;
  },
) {
  const { data: workflows } = await supabase
    .from("automation_workflows")
    .select("id")
    .eq("store_id", input.storeId)
    .eq("trigger_event", input.trigger)
    .eq("is_active", true);

  let enrolled = 0;
  for (const workflow of workflows ?? []) {
    const { error } = await supabase.from("automation_runs").insert({
      workflow_id: workflow.id,
      store_id: input.storeId,
      customer_id: input.customerId ?? null,
      order_id: input.orderId ?? null,
      cart_id: input.cartId ?? null,
      context: (input.context ?? {}) as never,
      next_run_at: plusMinutes(input.delayMinutes ?? 0),
    });
    if (error) continue;

    const { data: stats } = await supabase
      .from("automation_workflows")
      .select("runs_count")
      .eq("id", workflow.id)
      .maybeSingle();
    await supabase
      .from("automation_workflows")
      .update({ runs_count: (stats?.runs_count ?? 0) + 1 })
      .eq("id", workflow.id);
    enrolled += 1;
  }

  return { enrolled };
}
