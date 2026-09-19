import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AUTOMATION_TRIGGERS, CONDITIONS, MESSAGE_CHANNELS, STEP_KINDS } from "@/lib/automation";
import { slugify } from "@/lib/mefti";
import { insertAuditRow } from "./audit.server";

/**
 * Pazarlama otomasyonu yönetimi: akışlar, adımlar, mesaj şablonları,
 * manuel kayıt açma ve motor tetikleme. Tenant izolasyonu RLS ile sağlanır.
 */

const canvasSchema = z.object({
  nodes: z.array(z.object({ id: z.string(), position: z.object({ x: z.number(), y: z.number() }) })).max(200).default([]),
  edges: z.array(z.object({ id: z.string(), source: z.string(), target: z.string(), sourceHandle: z.string().nullable().optional() })).max(400).default([]),
});

const stepSchema = z.object({
  kind: z.enum(STEP_KINDS),
  title: z.string().trim().max(120).optional(),
  waitMinutes: z.number().int().min(0).max(60 * 24 * 30).default(0),
  templateId: z.guid().nullable().optional(),
  conditionKind: z.enum(CONDITIONS).nullable().optional(),
  onTrue: z.enum(["continue", "end"]).default("end"),
  onFalse: z.enum(["continue", "end"]).default("continue"),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const saveWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        workflowId: z.guid().optional(),
        name: z.string().trim().min(2).max(120),
        description: z.string().trim().max(400).optional(),
        trigger: z.enum(AUTOMATION_TRIGGERS),
        isActive: z.boolean().default(false),
        canvas: canvasSchema.default({ nodes: [], edges: [] }),
        steps: z.array(stepSchema).max(30).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { requirePlanModule } = await import("@/lib/entitlements.server");
    await requirePlanModule(supabase as never, data.storeId, "module_automation");

    const payload = {
      store_id: data.storeId,
      name: data.name,
      description: data.description ?? null,
      trigger_event: data.trigger,
      is_active: data.isActive,
      canvas: data.canvas,
    };

    const { data: workflow, error } = await (data.workflowId
      ? supabase
          .from("automation_workflows")
          .update(payload)
          .eq("id", data.workflowId)
          .eq("store_id", data.storeId)
      : supabase.from("automation_workflows").insert(payload)
    )
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!workflow) throw new Error("Otomasyon kaydedilemedi");

    await supabase.from("automation_steps").delete().eq("workflow_id", workflow.id);

    if (data.steps.length > 0) {
      const { error: stepError } = await supabase.from("automation_steps").insert(
        data.steps.map((step, index) => ({
          workflow_id: workflow.id,
          store_id: data.storeId,
          position: index,
          kind: step.kind,
          title: step.title ?? null,
          wait_minutes: step.waitMinutes,
          template_id: step.templateId ?? null,
          condition_kind: step.conditionKind ?? null,
          on_true: step.onTrue,
          on_false: step.onFalse,
          config: step.config as never,
        })),
      );
      if (stepError) throw new Error(stepError.message);
    }

    await insertAuditRow(supabase, {
      store_id: data.storeId,
      actor_id: userId,
      action: data.workflowId ? "automation.updated" : "automation.created",
      entity: "automation_workflow",
      entity_id: workflow.id,
      meta: { name: data.name, trigger: data.trigger, steps: data.steps.length } as never,
    });

    return workflow;
  });

export const toggleWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        workflowId: z.guid(),
        isActive: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automation_workflows")
      .update({ is_active: data.isActive })
      .eq("id", data.workflowId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), workflowId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automation_workflows")
      .delete()
      .eq("id", data.workflowId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveMessageTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.guid(),
        templateId: z.guid().optional(),
        channel: z.enum(MESSAGE_CHANNELS),
        name: z.string().trim().min(2).max(120),
        subject: z.string().trim().max(200).optional(),
        body: z.string().trim().min(2).max(4000),
        whatsappTemplateName: z.string().trim().max(120).optional(),
        whatsappLanguage: z.string().trim().max(10).default("tr"),
        isActive: z.boolean().default(true),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const slug = `${data.channel}-${slugify(data.name) || Math.random().toString(36).slice(2, 8)}`;

    const payload = {
      store_id: data.storeId,
      channel: data.channel,
      name: data.name,
      slug,
      subject: data.subject ?? null,
      body: data.body,
      whatsapp_template_name: data.whatsappTemplateName ?? null,
      whatsapp_language: data.whatsappLanguage,
      is_active: data.isActive,
    };

    const { data: template, error } = await (data.templateId
      ? supabase
          .from("message_templates")
          .update(payload)
          .eq("id", data.templateId)
          .eq("store_id", data.storeId)
      : supabase.from("message_templates").insert(payload)
    )
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    return template;
  });

export const deleteMessageTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), templateId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("message_templates")
      .delete()
      .eq("id", data.templateId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Hazır "sepet kurtarma" akışı: 30 dk bekle → e-posta → 6 saat bekle → WhatsApp → koşul → indirim. */
export const seedCartRecoveryFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const templates = [
      {
        channel: "email" as const,
        name: "Sepet hatırlatma e-postası",
        slug: "email-sepet-hatirlatma",
        subject: "{{musteri_adi}}, sepetiniz sizi bekliyor",
        body: "Merhaba {{musteri_adi}},\n\n{{magaza_adi}} sepetinizde {{sepet_tutari}} TL değerinde ürün var.\nSiparişinizi tamamlamak için: {{sepet_linki}}",
      },
      {
        channel: "whatsapp" as const,
        name: "Sepet hatırlatma WhatsApp",
        slug: "whatsapp-sepet-hatirlatma",
        subject: null,
        body: "Merhaba {{musteri_adi}}, {{magaza_adi}} sepetiniz hâlâ hazır. Tamamlamak için: {{sepet_linki}}",
      },
      {
        channel: "whatsapp" as const,
        name: "Sepet indirim teklifi",
        slug: "whatsapp-sepet-indirim",
        subject: null,
        body: "{{musteri_adi}}, siparişinizi bugün tamamlarsanız {{indirim_kodu}} kodu ile ekstra indirim sizin!",
      },
    ];

    const ids: Record<string, string> = {};
    for (const template of templates) {
      const { data: row, error } = await supabase
        .from("message_templates")
        .upsert(
          {
            store_id: data.storeId,
            channel: template.channel,
            name: template.name,
            slug: template.slug,
            subject: template.subject,
            body: template.body,
            whatsapp_language: "tr",
          },
          { onConflict: "store_id,slug" },
        )
        .select("id, slug")
        .single();
      if (error) throw new Error(error.message);
      ids[row.slug] = row.id;
    }

    const { data: workflow, error: workflowError } = await supabase
      .from("automation_workflows")
      .insert({
        store_id: data.storeId,
        name: "Sepet kurtarma serisi",
        description: "30 dk bekle → e-posta → 6 saat bekle → WhatsApp → sipariş kontrolü → indirim",
        trigger_event: "cart_abandoned",
        is_active: false,
      })
      .select("*")
      .single();
    if (workflowError) throw new Error(workflowError.message);

    const steps = [
      { kind: "wait" as const, wait_minutes: 30, title: "30 dakika bekle" },
      {
        kind: "email" as const,
        wait_minutes: 0,
        title: "Sepet hatırlatma e-postası",
        template_id: ids["email-sepet-hatirlatma"],
      },
      { kind: "wait" as const, wait_minutes: 360, title: "6 saat bekle" },
      {
        kind: "whatsapp" as const,
        wait_minutes: 0,
        title: "WhatsApp hatırlatma",
        template_id: ids["whatsapp-sepet-hatirlatma"],
      },
      {
        kind: "condition" as const,
        wait_minutes: 0,
        title: "Sipariş verildi mi?",
        condition_kind: "order_placed" as const,
        on_true: "end",
        on_false: "continue",
      },
      {
        kind: "whatsapp" as const,
        wait_minutes: 0,
        title: "İndirim teklifi",
        template_id: ids["whatsapp-sepet-indirim"],
      },
      { kind: "end" as const, wait_minutes: 0, title: "Otomasyonu bitir" },
    ];

    const { error: stepError } = await supabase.from("automation_steps").insert(
      steps.map((step, index) => ({
        workflow_id: workflow.id,
        store_id: data.storeId,
        position: index,
        kind: step.kind,
        title: step.title,
        wait_minutes: step.wait_minutes,
        template_id: step.template_id ?? null,
        condition_kind: step.condition_kind ?? null,
        on_true: step.on_true ?? "end",
        on_false: step.on_false ?? "continue",
      })),
    );
    if (stepError) throw new Error(stepError.message);

    return workflow;
  });

/** Terk edilmiş sepetleri ilgili akışlara kaydeder. */
export const enrollAbandonedCarts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { enrollTrigger } = await import("@/lib/automation-engine.server");

    // E-posta bırakılmamış sepetlere gönderim yapılamaz; kuyruğa alınmaz.
    const { data: carts } = await supabase
      .from("abandoned_carts")
      .select("id, customer_email, customer_name, total, cart_token")
      .eq("store_id", data.storeId)
      .is("recovered_order_id", null)
      .not("customer_email", "is", null)
      .order("last_seen_at", { ascending: false })
      .limit(25);

    let enrolled = 0;
    for (const cart of carts ?? []) {
      const { data: existing } = await supabase
        .from("automation_runs")
        .select("id")
        .eq("store_id", data.storeId)
        .eq("cart_id", cart.id)
        .limit(1);
      if ((existing ?? []).length > 0) continue;

      const result = await enrollTrigger(supabase, {
        storeId: data.storeId,
        trigger: "cart_abandoned",
        cartId: cart.id,
        context: {
          musteri_adi: cart.customer_name ?? "Değerli müşterimiz",
          email: cart.customer_email ?? "",
          sepet_tutari: cart.total,
          sepet_linki: `/cart?token=${cart.cart_token}`,
        },
      });
      enrolled += result.enrolled;
    }

    return { enrolled };
  });

/** Bekleyen adımları hemen işler (cron dışı manuel çalıştırma). */
export const runAutomationTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { processDueRuns } = await import("@/lib/automation-engine.server");
    return processDueRuns(context.supabase, 50, data.storeId);
  });

export const stopAutomationRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), runId: z.guid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automation_runs")
      .update({ status: "stopped", completed_at: new Date().toISOString() })
      .eq("id", data.runId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Builder'daki "test çalıştır": seçili akışı gerçek motorla, bekleme adımlarını atlayarak yürütür. */
export const testRunWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ storeId: z.guid(), workflowId: z.guid() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { testRunWorkflow: run } = await import("@/lib/automation-engine.server");
    return run(context.supabase, { storeId: data.storeId, workflowId: data.workflowId });
  });
