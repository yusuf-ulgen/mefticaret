import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * SMS Pazarlama: yalnız SMS izni veren ve abonelikten çıkmamış müşterilere toplu SMS.
 * Alıcı listesi sunucuda kurulur; istemciden gelen numaralara güvenilmez.
 * Yetki: message_deliveries INSERT politikası (can_manage_store) — yazamayan gönderemez.
 */
const MAX_RECIPIENTS = 1000;
const BATCH = 100;

async function recipients(supabase: any, storeId: string) {
  const { normalizeMsisdn } = await import("./sms.server");
  const [c, u] = await Promise.all([
    supabase.from("customers").select("id, phone").eq("store_id", storeId).eq("accepts_sms", true).not("phone", "is", null).limit(5000),
    supabase.from("customer_unsubscribes").select("recipient").eq("store_id", storeId).eq("channel", "sms"),
  ]);
  if (c.error) throw new Error(c.error.message);
  const blocked = new Set((u.data ?? []).map((r: { recipient: string }) => normalizeMsisdn(r.recipient)).filter(Boolean));
  const seen = new Map<string, string>();
  for (const row of c.data ?? []) {
    const n = normalizeMsisdn(row.phone ?? "");
    if (n && !blocked.has(n) && !seen.has(n)) seen.set(n, row.id);
  }
  return [...seen].map(([phone, customerId]) => ({ phone, customerId }));
}

export const smsAudienceFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { getVerimorCredentials } = await import("./sms.server");
    const list = await recipients(context.supabase, data.storeId);
    const creds = await getVerimorCredentials(context.supabase, data.storeId);
    const { brevoReady } = await import("./brevo.server");
    return { count: list.length, max: MAX_RECIPIENTS, providerReady: !!creds || brevoReady() };
  });

export const sendSmsCampaignFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid(), body: z.string().trim().min(3).max(612) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { sendSmsBulk, getVerimorCredentials } = await import("./sms.server");
    const { brevoReady, sendBrevoSms } = await import("./brevo.server");
    const useVerimor = !!(await getVerimorCredentials(supabase, data.storeId));
    if (!useVerimor && !brevoReady()) {
      throw new Error("SMS göndermek için önce Uygulamalar'dan Verimor SMS'i kurup bilgilerinizi girin.");
    }
    const list = (await recipients(supabase, data.storeId)).slice(0, MAX_RECIPIENTS);
    if (list.length === 0) throw new Error("SMS izni veren müşteri yok.");

    let sent = 0;
    let failed = 0;
    let lastError: string | null = null;
    for (let i = 0; i < list.length; i += BATCH) {
      const chunk = list.slice(i, i + BATCH);
      const { data: rows, error } = await supabase
        .from("message_deliveries")
        .insert(chunk.map((r) => ({ store_id: data.storeId, channel: "sms" as const, recipient: r.phone, customer_id: r.customerId, body: data.body, subject: "SMS Pazarlama", status: "queued" as const })))
        .select("id");
      if (error) throw new Error(i === 0 ? "Bu mağazada SMS gönderme yetkiniz yok." : error.message);
      const ids = (rows ?? []).map((r) => r.id);
      if (!useVerimor) {
        // Brevo: alıcı başına gönderim, her kaydın durumu ayrı güncellenir.
        for (let j = 0; j < chunk.length; j += 1) {
          const r = await sendBrevoSms(chunk[j]!.phone, data.body);
          const id = ids[j];
          if (id) await supabase.from("message_deliveries").update(r.ok
            ? { status: "sent" as const, provider_message_id: r.id, sent_at: new Date().toISOString() }
            : { status: "failed" as const, error: r.error }).eq("id", id);
          if (r.ok) sent += 1; else { failed += 1; lastError = r.error; }
        }
        continue;
      }
      const res = await sendSmsBulk(supabase, { storeId: data.storeId, to: chunk.map((r) => r.phone), body: data.body });
      await supabase
        .from("message_deliveries")
        .update({ status: res.status, error: res.error, provider_message_id: res.campaignId, sent_at: res.status === "sent" ? new Date().toISOString() : null })
        .in("id", ids);
      if (res.status === "sent") sent += chunk.length;
      else { failed += chunk.length; lastError = res.error; }
    }
    return { sent, failed, error: lastError };
  });
