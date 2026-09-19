import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { renderTemplate } from "@/lib/automation";
import { sendSms } from "@/lib/sms.server";
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

type CanvasEdge = { source: string; target: string; sourceHandle?: string | null };

/** Builder canvas'ındaki bağlantıları okur; node kimlikleri `step-<sıra>` biçimindedir. */
function readEdges(canvas: unknown): CanvasEdge[] {
  const edges = (canvas as { edges?: unknown } | null)?.edges;
  if (!Array.isArray(edges)) return [];
  return edges
    .filter((edge): edge is CanvasEdge =>
      Boolean(edge) && typeof (edge as CanvasEdge).source === "string" && typeof (edge as CanvasEdge).target === "string",
    )
    .map((edge) => ({
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
    }));
}

function nodeToIndex(id: string) {
  const match = /^step-(\d+)$/.exec(id);
  return match ? Number(match[1]) : null;
}

/** Bir adımın çıktısına bağlı sonraki adımı bulur; bağlantı yoksa sıradaki adıma düşer. */
function nextPosition(edges: CanvasEdge[], position: number, handle?: "true" | "false"): number | null {
  const source = `step-${position}`;
  const outgoing = edges.filter((edge) => edge.source === source);
  if (outgoing.length === 0) return handle ? null : position + 1;

  if (handle) {
    const branch = outgoing.find((edge) => (edge.sourceHandle ?? "") === handle);
    if (!branch) return null;
    return nodeToIndex(branch.target);
  }

  const plain = outgoing.find((edge) => !edge.sourceHandle) ?? outgoing[0];
  return plain ? nodeToIndex(plain.target) : null;
}

/** Tetikleyiciye bağlı ilk adımın sırasını döndürür. */
export function resolveStartPosition(canvas: unknown): number {
  const edges = readEdges(canvas);
  const fromTrigger = edges.find((edge) => edge.source === "trigger");
  if (!fromTrigger) return 0;
  return nodeToIndex(fromTrigger.target) ?? 0;
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
  } else if (channel === "sms") {
    const result = await sendSms(supabase, {
      storeId: run.store_id,
      to: recipient,
      body,
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

  if (kind === "ltv_above" || kind === "spent_above" || kind === "order_count_above") {
    if (!run.customer_id) return false;
    const threshold = Number((step.config as any)?.amount ?? (step.config as any)?.value ?? 0);
    const { data } = await supabase
      .from("customers")
      .select("total_spent, orders_count")
      .eq("id", run.customer_id)
      .maybeSingle();
    if (!data) return false;
    if (kind === "order_count_above") return (data.orders_count ?? 0) >= threshold;
    return Number(data.total_spent ?? 0) >= threshold;
  }

  if (kind === "category_interest") {
    const category = String((step.config as any)?.category ?? "").toLowerCase();
    if (!category || !run.customer_id) return false;
    const { data } = await supabase
      .from("orders")
      .select("id, order_items(title, products(product_type, tags))")
      .eq("store_id", run.store_id)
      .eq("customer_id", run.customer_id)
      .limit(20);
    for (const order of data ?? []) {
      for (const item of ((order as any).order_items ?? []) as any[]) {
        const haystack = [
          item?.title,
          item?.products?.product_type,
          ...((item?.products?.tags ?? []) as string[]),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (haystack.includes(category)) return true;
      }
    }
    return false;
  }

  if (kind === "email_opened") {
    if (!run.customer_id) return false;
    const { data } = await supabase
      .from("email_sends")
      .select("id")
      .eq("store_id", run.store_id)
      .eq("customer_id", run.customer_id)
      .not("opened_at", "is", null)
      .limit(1);
    return (data ?? []).length > 0;
  }

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

/** Tek bir çalıştırmayı bir adım ilerletir. Bağlantılar (canvas edge) gerçek akışı belirler. */
export async function advanceRun(supabase: Client, run: Run, options?: { skipWaits?: boolean }) {
  const [{ data: steps }, { data: workflow }] = await Promise.all([
    supabase
      .from("automation_steps")
      .select("*")
      .eq("workflow_id", run.workflow_id)
      .order("position", { ascending: true }),
    supabase
      .from("automation_workflows")
      .select("canvas")
      .eq("id", run.workflow_id)
      .maybeSingle(),
  ]);

  const ordered = steps ?? [];
  const edges = readEdges(workflow?.canvas ?? null);
  const step = ordered[run.current_position];

  if (!step) {
    await completeRun(supabase, run, "completed");
    return "completed";
  }

  const goTo = async (next: number | null, status: Run["status"], nextRunAt: string) => {
    if (next === null || !ordered[next]) {
      await completeRun(supabase, run, "completed");
      return "completed" as const;
    }
    await supabase
      .from("automation_runs")
      .update({ current_position: next, status, next_run_at: nextRunAt })
      .eq("id", run.id);
    return status === "waiting" ? ("waiting" as const) : ("advanced" as const);
  };

  try {
    if (step.kind === "end") {
      await log(supabase, run, step, step.kind, "ok");
      await completeRun(supabase, run, "completed");
      return "completed";
    }

    if (step.kind === "wait") {
      await log(supabase, run, step, step.kind, "ok", `${step.wait_minutes} dakika bekleniyor`);
      return goTo(
        nextPosition(edges, run.current_position),
        options?.skipWaits ? "active" : "waiting",
        options?.skipWaits ? nowIso() : plusMinutes(step.wait_minutes),
      );
    }

    if (step.kind === "condition") {
      const result = await evaluateCondition(supabase, run, step);
      const branchNode = nextPosition(edges, run.current_position, result ? "true" : "false");
      const fallbackFlag = result ? step.on_true : step.on_false;
      const target =
        branchNode !== null
          ? branchNode
          : fallbackFlag === "end"
            ? null
            : nextPosition(edges, run.current_position);
      await log(
        supabase,
        run,
        step,
        step.kind,
        result ? "true" : "false",
        target === null ? "end" : `adım ${target + 1}`,
      );
      return goTo(target, "active", nowIso());
    }

    await dispatchMessage(supabase, run, step, step.kind);
    return goTo(nextPosition(edges, run.current_position), "active", nowIso());
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
    .select("id, canvas")
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
      current_position: resolveStartPosition(workflow.canvas),
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

/**
 * Tek bir akışı uçtan uca gerçek motorla çalıştırır (bekleme adımları atlanır).
 * Node bağlantıları takip edilir, her adım gerçek işleyicisini çalıştırır ve loglanır.
 */
export async function testRunWorkflow(
  supabase: Client,
  input: { storeId: string; workflowId: string; maxSteps?: number },
) {
  const { data: workflow, error: workflowError } = await supabase
    .from("automation_workflows")
    .select("id, canvas")
    .eq("id", input.workflowId)
    .eq("store_id", input.storeId)
    .maybeSingle();
  if (workflowError) throw new Error(workflowError.message);
  if (!workflow) throw new Error("Akış bulunamadı");

  const { data: steps } = await supabase
    .from("automation_steps")
    .select("id")
    .eq("workflow_id", workflow.id)
    .limit(1);
  if ((steps ?? []).length === 0) throw new Error("Akışta çalıştırılacak adım yok");

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("store_id", input.storeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: run, error } = await supabase
    .from("automation_runs")
    .insert({
      workflow_id: workflow.id,
      store_id: input.storeId,
      customer_id: customer?.id ?? null,
      context: { test: "1", musteri_adi: "Test müşterisi" } as never,
      current_position: resolveStartPosition(workflow.canvas),
      next_run_at: nowIso(),
    })
    .select("*")
    .single();
  if (error || !run) throw new Error(error?.message ?? "Test çalıştırma başlatılamadı");

  const trace: Array<{ position: number; kind: Step["kind"]; outcome: string }> = [];
  let current: Run = run;
  const limit = Math.min(input.maxSteps ?? 25, 50);

  for (let index = 0; index < limit; index += 1) {
    const { data: stepRow } = await supabase
      .from("automation_steps")
      .select("kind")
      .eq("workflow_id", workflow.id)
      .eq("position", current.current_position)
      .maybeSingle();

    const outcome = await advanceRun(supabase, current, { skipWaits: true });
    trace.push({
      position: current.current_position,
      kind: (stepRow?.kind ?? "end") as Step["kind"],
      outcome,
    });
    if (outcome === "completed" || outcome === "failed") break;

    const { data: next } = await supabase
      .from("automation_runs")
      .select("*")
      .eq("id", run.id)
      .maybeSingle();
    if (!next) break;
    current = next;
  }

  return { runId: run.id, steps: trace.length, trace };
}
