import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CARRIER_KEYS } from "@/lib/carriers";
import { NOTIFY_CHANNELS, NOTIFY_EVENTS } from "@/lib/customer-notify";

const storeIdSchema = z.object({ storeId: z.guid() });

/** Mağaza sahibi, üyesi veya platform yöneticisi mi? */
async function assertManage(supabase: any, userId: string, storeId: string) {
  const [{ data: store }, { data: member }, { data: pa }] = await Promise.all([
    supabase.from("stores").select("owner_id").eq("id", storeId).maybeSingle(),
    supabase.from("store_users").select("role").eq("store_id", storeId).eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "platform_admin").maybeSingle(),
  ]);
  if (!(store?.owner_id === userId || member || pa)) throw new Error("Bu mağaza için yetkiniz yok");
}

export const getNotificationCenter = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => storeIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    await assertManage(db, context.userId, data.storeId);
    const [tpl, carriers, smsApp, wa, store] = await Promise.all([
      db.from("customer_notification_templates").select("id, event_key, channel, language, subject, body, is_active").eq("store_id", data.storeId),
      db.from("carrier_settings").select("carrier_key, customer_number, credential_hint, is_active, is_test_mode").eq("store_id", data.storeId),
      db.from("app_installations").select("status, apps!inner(code)").eq("store_id", data.storeId).eq("apps.code", "verimor-sms").maybeSingle(),
      db.from("whatsapp_accounts").select("id, is_active, display_phone_number").eq("store_id", data.storeId).maybeSingle(),
      db.from("stores").select("name, logo_url").eq("id", data.storeId).maybeSingle(),
    ]);
    return {
      templates: tpl.data ?? [],
      carriers: carriers.data ?? [],
      channels: {
        email: true,
        sms: smsApp.data?.status === "installed",
        whatsapp: Boolean((wa.data as { is_active?: boolean } | null)?.is_active),
        whatsappNumber: (wa.data as { display_phone_number?: string } | null)?.display_phone_number ?? null,
      },
      store: store.data,
    };
  });

export const saveNotificationTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      storeId: z.guid(),
      eventKey: z.enum(NOTIFY_EVENTS),
      channel: z.enum(NOTIFY_CHANNELS),
      language: z.enum(["tr", "en"]).default("tr"),
      subject: z.string().trim().max(200).nullable(),
      body: z.string().trim().min(1).max(5000),
      isActive: z.boolean(),
    }).refine((v) => v.channel !== "sms" || v.body.length <= 160, { message: "SMS en fazla 160 karakter olabilir" }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("customer_notification_templates").upsert(
      {
        store_id: data.storeId, event_key: data.eventKey, channel: data.channel, language: data.language,
        subject: data.channel === "email" ? data.subject : null, body: data.body, is_active: data.isActive,
      },
      { onConflict: "store_id,event_key,channel,language" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), eventKey: z.enum(NOTIFY_EVENTS), channel: z.enum(NOTIFY_CHANNELS), to: z.string().trim().min(5).max(200), subject: z.string().max(200).nullable(), body: z.string().min(1).max(5000) }).parse(d))
  .handler(async ({ data, context }) => {
    // Yalnız mağaza yöneticileri şablon kaydedebilir; aynı RLS ile yetki denenir.
    await assertManage(context.supabase, context.userId, data.storeId);
    const { data: store } = await context.supabase.from("stores").select("name, logo_url").eq("id", data.storeId).maybeSingle();
    if (!store) throw new Error("Yetkiniz yok");
    const { renderTemplate, SAMPLE_VARS } = await import("@/lib/customer-notify");
    const vars = { ...SAMPLE_VARS, store_name: store.name, store_logo_url: store.logo_url ?? "" };
    const body = renderTemplate(data.body, vars);
    const { admin } = await import("@/lib/shipment-tracking.server");
    const db = await admin();
    if (data.channel === "email") {
      if (!z.email().safeParse(data.to).success) throw new Error("Geçerli bir e-posta girin");
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const res = await sendTemplateEmail("customer-notification", data.to, {
        templateData: { subject: `[TEST] ${renderTemplate(data.subject ?? "", vars)}`, body, storeName: store.name, logoUrl: store.logo_url ?? undefined },
      });
      if (!res.sent) throw new Error("Bu adres e-posta almayı durdurmuş");
    } else if (data.channel === "sms") {
      const { sendSms } = await import("@/lib/sms.server");
      const res = await sendSms(db, { storeId: data.storeId, to: data.to, body: body.slice(0, 160) });
      if (res.status === "failed" || res.status === "queued") throw new Error(res.error ?? "SMS gönderilemedi");
    } else {
      const { sendWhatsAppMessage } = await import("@/lib/whatsapp.server");
      const res = (await sendWhatsAppMessage(db, { storeId: data.storeId, waId: data.to.replace(/\D/g, "").replace(/^0/, "90"), body })) as { status?: string; error?: string | null };
      if (res?.status === "failed") throw new Error(res.error ?? "WhatsApp gönderilemedi");
    }
    return { ok: true };
  });

export const listNotificationLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    storeId: z.guid(),
    channel: z.enum(NOTIFY_CHANNELS).optional(),
    status: z.enum(["pending", "sent", "delivered", "failed", "bounced", "skipped"]).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    q: z.string().trim().max(100).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("customer_notification_logs")
      .select("id, order_id, channel, event_key, recipient, status, error, sent_at, created_at, orders(order_number, customer_name)")
      .eq("store_id", data.storeId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.channel) q = q.eq("channel", data.channel);
    if (data.status) q = q.eq("status", data.status);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", `${data.to}T23:59:59`);
    if (data.q) q = q.ilike("recipient", `%${data.q.replace(/[%_]/g, "")}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const resendNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), logId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: log } = await context.supabase
      .from("customer_notification_logs")
      .select("id, order_id, event_key, channel, status, idempotency_key")
      .eq("id", data.logId).eq("store_id", data.storeId).maybeSingle();
    await assertManage(context.supabase, context.userId, data.storeId);
    if (!log || !log.order_id) throw new Error("Kayıt bulunamadı");
    if (log.status !== "failed") throw new Error("Yalnız başarısız bildirimler yeniden gönderilebilir");
    const parts = log.idempotency_key.split(":");
    const dedupe = parts.length > 3 ? parts.slice(3).join(":") : undefined;
    const { dispatchCustomerEvent } = await import("@/lib/customer-notify.server");
    const res = await dispatchCustomerEvent(log.order_id, log.event_key as never, { only: [log.channel as never], ...(dedupe ? { dedupe } : {}) });
    const r = res[0];
    if (!r || r.status !== "sent") throw new Error(r?.error ?? "Gönderilemedi");
    return { ok: true };
  });

export const saveCarrierSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    storeId: z.guid(),
    carrierKey: z.enum(CARRIER_KEYS),
    customerNumber: z.string().trim().max(80).optional(),
    apiKey: z.string().trim().max(500).optional(),
    apiSecret: z.string().trim().max(500).optional(),
    isActive: z.boolean(),
    isTestMode: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const row: Record<string, unknown> = {
      store_id: data.storeId, carrier_key: data.carrierKey, customer_number: data.customerNumber || null,
      is_active: data.isActive, is_test_mode: data.isTestMode,
    };
    if (data.apiKey || data.apiSecret) {
      const { encryptCredentials, hintOf } = await import("@/lib/payment-crypto.server");
      row["credentials_encrypted"] = await encryptCredentials({ api_key: data.apiKey ?? "", api_secret: data.apiSecret ?? "" });
      row["credential_hint"] = hintOf({ api_key: data.apiKey ?? "", api_secret: data.apiSecret ?? "" });
    }
    const { error } = await context.supabase.from("carrier_settings").upsert(row as never, { onConflict: "store_id,carrier_key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
