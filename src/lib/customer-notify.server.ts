import { createHmac, timingSafeEqual } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { carrierName } from "@/lib/carriers";
import {
  type CustomerPrefs,
  DEFAULT_TEMPLATES,
  type NotifyChannel,
  type NotifyEvent,
  NOTIFY_CHANNELS,
  renderTemplate,
  SMS_MAX,
  SMS_STOP_SUFFIX,
} from "@/lib/customer-notify";

/**
 * Müşteri bildirimleri (yalnız sunucu). Her gönderim öncesi:
 * paket özelliği, mağaza şablonu, müşteri tercihi, abonelikten çıkma kaydı,
 * SMS sınırı (sipariş olayı başına 1) ve tekrar önleme anahtarı kontrol edilir.
 * Tüm çağrılar service role ile yapılır; çağıran önce yetkiyi doğrulamalıdır.
 */

type Db = SupabaseClient<Database>;

const SITE = "https://mefticaret.com";

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Db;
}

export function normalizeRecipient(channel: string, value: string) {
  const v = value.trim().toLowerCase();
  if (channel === "email" || channel === "marketing") return v;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function secret() {
  const s = process.env["NOTIFY_UNSUBSCRIBE_SECRET"];
  if (!s) throw new Error("NOTIFY_UNSUBSCRIBE_SECRET eksik");
  return s;
}

export function signUnsubscribe(storeId: string, channel: string, recipient: string) {
  const payload = Buffer.from(JSON.stringify({ s: storeId, c: channel, r: normalizeRecipient(channel, recipient) })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyUnsubscribe(token: string): { s: string; c: string; r: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { s: string; c: string; r: string };
    if (!data.s || !data.c || !data.r) return null;
    return data;
  } catch {
    return null;
  }
}

export async function recordUnsubscribe(db: Db, storeId: string, channel: string, recipient: string, source: "link" | "stop" | "account" | "admin") {
  await db.from("customer_unsubscribes").upsert(
    { store_id: storeId, channel, recipient: normalizeRecipient(channel, recipient), source },
    { onConflict: "store_id,channel,recipient", ignoreDuplicates: true },
  );
}

async function featureEnabled(db: Db, storeId: string) {
  const { data: store } = await db.from("stores").select("plan_id, store_kind").eq("id", storeId).maybeSingle();
  if (!store?.plan_id) return true; // paketsiz/mikro mağazalarda açık
  const { data } = await db
    .from("plan_features")
    .select("is_enabled")
    .eq("plan_id", store.plan_id)
    .eq("metric_key", "module_notification_v2")
    .maybeSingle();
  return data ? data.is_enabled !== false : true;
}

export type DispatchExtra = {
  refundAmount?: string;
  shipmentId?: string;
  /** Tekrar önleme için ek ayırt edici (ör. iade kimliği). */
  dedupe?: string;
  /** Yalnız bu kanal(lar)a gönder (yeniden gönderim / test). */
  only?: NotifyChannel[];
};

type Ctx = {
  order: {
    id: string; store_id: string; order_number: string; grand_total: number; currency: string;
    customer_id: string | null; customer_name: string | null; customer_email: string | null; customer_phone: string | null;
  };
  store: { name: string; slug: string; logo_url: string | null };
  brand: string | null;
  vars: Record<string, string>;
  trackingUrl: string | null;
};

async function loadContext(db: Db, orderId: string, extra: DispatchExtra): Promise<Ctx | null> {
  const { data: order } = await db
    .from("orders")
    .select("id, store_id, order_number, grand_total, currency, customer_id, customer_name, customer_email, customer_phone")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return null;
  const [{ data: store }, { data: theme }] = await Promise.all([
    db.from("stores").select("name, slug, logo_url").eq("id", order.store_id).maybeSingle(),
    db.from("store_themes").select("primary_color, logo_url").eq("store_id", order.store_id).maybeSingle(),
  ]);
  if (!store) return null;

  let shipQuery = db
    .from("shipments")
    .select("id, carrier, carrier_key, tracking_number")
    .eq("order_id", order.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (extra.shipmentId) shipQuery = shipQuery.eq("id", extra.shipmentId);
  const { data: ships } = await shipQuery;
  const ship = ships?.[0];

  const { formatMoney } = await import("@/lib/mefti");
  const trackingUrl = ship?.tracking_number ? `${SITE}/kargo-takip/${encodeURIComponent(ship.tracking_number)}` : null;
  const logo = theme?.logo_url || store.logo_url || "";
  return {
    order: order as Ctx["order"],
    store: { ...store, logo_url: logo || null },
    brand: theme?.primary_color ?? null,
    trackingUrl,
    vars: {
      customer_name: order.customer_name?.split(" ")[0] || "Değerli müşterimiz",
      order_number: order.order_number,
      order_total: formatMoney(Number(order.grand_total), order.currency),
      tracking_number: ship?.tracking_number ?? "",
      carrier_name: carrierName(ship?.carrier_key, ship?.carrier),
      tracking_url: trackingUrl ?? `${SITE}/s/${store.slug}/order`,
      refund_amount: extra.refundAmount ?? "",
      store_name: store.name,
      store_logo_url: logo,
    },
  };
}

function recipientFor(ctx: Ctx, channel: NotifyChannel) {
  if (channel === "email") return ctx.order.customer_email;
  return ctx.order.customer_phone;
}

/**
 * Olay için tüm uygun kanallara bildirim gönderir. Hiçbir durumda istisna fırlatmaz;
 * sonuçlar customer_notification_logs'a yazılır.
 */
export async function dispatchCustomerEvent(orderId: string, event: NotifyEvent, extra: DispatchExtra = {}, dbIn?: Db) {
  const results: { channel: NotifyChannel; status: string; error?: string }[] = [];
  try {
    const db = dbIn ?? (await admin());
    const ctx = await loadContext(db, orderId, extra);
    if (!ctx) return results;
    const storeId = ctx.order.store_id;
    if (!(await featureEnabled(db, storeId))) return results;

    const [{ data: templates }, prefsRes] = await Promise.all([
      db.from("customer_notification_templates").select("channel, subject, body, is_active").eq("store_id", storeId).eq("event_key", event).eq("language", "tr"),
      ctx.order.customer_id
        ? db.from("customer_notification_prefs").select("prefs").eq("customer_id", ctx.order.customer_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const prefs = ((prefsRes as { data: { prefs: unknown } | null }).data?.prefs ?? {}) as CustomerPrefs;

    for (const channel of extra.only ?? NOTIFY_CHANNELS) {
      const custom = templates?.find((t) => t.channel === channel);
      const fallback = DEFAULT_TEMPLATES[event][channel];
      if (custom ? !custom.is_active : !fallback) continue;
      const tpl = custom ? { subject: custom.subject ?? undefined, body: custom.body } : fallback!;
      if (prefs[event]?.[channel] === false) continue;

      const to = recipientFor(ctx, channel);
      const key = `${orderId}:${event}:${channel}${extra.dedupe ? `:${extra.dedupe}` : ""}`;
      const base = {
        store_id: storeId, customer_id: ctx.order.customer_id, order_id: orderId,
        channel, event_key: event, recipient: to, idempotency_key: key,
      };

      if (!to) continue;
      const { data: unsub } = await db
        .from("customer_unsubscribes")
        .select("id")
        .eq("store_id", storeId)
        .eq("channel", channel)
        .eq("recipient", normalizeRecipient(channel, to))
        .maybeSingle();
      if (unsub) continue;

      // Tekrar önleme: aynı anahtar varsa yalnız başarısız kaydı yeniden dener.
      const { data: existing } = await db.from("customer_notification_logs").select("id, status").eq("idempotency_key", key).maybeSingle();
      if (existing && existing.status !== "failed") { results.push({ channel, status: "duplicate" }); continue; }
      const logId = existing?.id ?? (await db.from("customer_notification_logs").insert({ ...base, status: "pending" }).select("id").single()).data?.id;
      if (!logId) continue;

      const subject = tpl.subject ? renderTemplate(tpl.subject, ctx.vars) : "";
      let body = renderTemplate(tpl.body, ctx.vars);
      let status: "sent" | "failed" = "sent";
      let error: string | undefined;
      try {
        if (channel === "email") {
          const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
          const res = await sendTemplateEmail("customer-notification", to, {
            idempotencyKey: `cn-${key}`,
            templateData: {
              subject, body, storeName: ctx.store.name, logoUrl: ctx.store.logo_url ?? undefined, brandColor: ctx.brand ?? undefined,
              actionUrl: ctx.trackingUrl && event !== "REFUND_PROCESSED" ? ctx.trackingUrl : undefined,
              actionLabel: "Kargoyu takip et",
              unsubscribeUrl: `${SITE}/bildirim-iptal?t=${signUnsubscribe(storeId, "email", to)}`,
            },
          });
          if (!res.sent) { status = "failed"; error = "Alıcı e-posta almayı durdurmuş"; }
        } else if (channel === "sms") {
          body = (body.slice(0, SMS_MAX - SMS_STOP_SUFFIX.length) + SMS_STOP_SUFFIX).slice(0, SMS_MAX);
          const { sendSms } = await import("@/lib/sms.server");
          const res = await sendSms(db, { storeId, to, body });
          if (res.status === "failed" || res.status === "queued") { status = "failed"; error = res.error ?? "SMS gönderilemedi"; }
        } else {
          const { sendWhatsAppMessage } = await import("@/lib/whatsapp.server");
          const res = (await sendWhatsAppMessage(db, {
            storeId, waId: to.replace(/\D/g, "").replace(/^0/, "90"), body, contactName: ctx.order.customer_name,
            customerId: ctx.order.customer_id,
          })) as { status?: string; error?: string | null } | undefined;
          if (res?.status === "failed") { status = "failed"; error = res.error ?? "WhatsApp gönderilemedi"; }
        }
      } catch (e) {
        status = "failed";
        error = e instanceof Error ? e.message.slice(0, 300) : "Gönderim hatası";
      }
      await db.from("customer_notification_logs").update({
        status, error: error ?? null, sent_at: status === "sent" ? new Date().toISOString() : null,
        payload: { subject, body: body.slice(0, 2000) },
      }).eq("id", logId);
      results.push({ channel, status, ...(error ? { error } : {}) });
    }
  } catch (e) {
    console.error("[customer-notify]", event, e);
  }
  return results;
}

/** Kargo durumu → bildirim olayı. */
export function eventForShipmentStatus(status: string): NotifyEvent | null {
  if (status === "picked_up" || status === "in_transit") return "ORDER_SHIPPED";
  if (status === "out_for_delivery") return "SHIPMENT_OUT_FOR_DELIVERY";
  if (status === "delivered") return "ORDER_DELIVERED";
  return null;
}
