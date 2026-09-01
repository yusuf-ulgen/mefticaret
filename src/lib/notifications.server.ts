import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { NOTIFICATION_KINDS, defaultNotificationSetting } from "@/lib/notifications";

type Client = SupabaseClient<Database>;

export const storeIdSchema = z.object({ storeId: z.string().uuid() });

const optionalText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

export const saveSettingSchema = z.object({
  storeId: z.string().uuid(),
  kind: z.enum(NOTIFICATION_KINDS),
  inApp: z.boolean(),
  email: z.boolean(),
  push: z.boolean(),
  sms: z.boolean(),
  whatsapp: z.boolean(),
  emailTo: optionalText,
  smsTo: optionalText,
  whatsappTo: optionalText,
});

export const systemNotificationSchema = z.object({
  storeId: z.string().uuid(),
  kind: z.enum(["system", "app_update"]),
  title: z.string().trim().min(3).max(160),
  message: z.string().trim().max(500).optional(),
});

export async function listSettings(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("store_id", storeId);
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  return NOTIFICATION_KINDS.map((kind) => {
    const existing = rows.find((row) => row.kind === kind);
    if (existing) return existing;
    const fallback = defaultNotificationSetting(kind);
    return {
      id: null,
      store_id: storeId,
      created_at: null,
      updated_at: null,
      ...fallback,
    };
  });
}

export async function saveSetting(supabase: Client, input: z.infer<typeof saveSettingSchema>) {
  const payload = {
    store_id: input.storeId,
    kind: input.kind,
    in_app: input.inApp,
    email: input.email,
    push: input.push,
    sms: input.sms,
    whatsapp: input.whatsapp,
    email_to: input.emailTo,
    sms_to: input.smsTo,
    whatsapp_to: input.whatsappTo,
  };

  const { data: existing, error: readError } = await supabase
    .from("notification_settings")
    .select("id")
    .eq("store_id", input.storeId)
    .eq("kind", input.kind)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  if (existing?.id) {
    const { error } = await supabase
      .from("notification_settings")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, id: existing.id };
  }

  const { data, error } = await supabase
    .from("notification_settings")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data.id };
}

/** Kanal kuyruğu: bildirim türü başına gönderim kayıtları. */
export async function listChannelDeliveries(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("message_deliveries")
    .select("id, channel, recipient, subject, status, error, created_at, sent_at")
    .eq("store_id", storeId)
    .is("run_id", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSystemNotification(
  supabase: Client,
  input: z.infer<typeof systemNotificationSchema>,
) {
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id")
    .eq("id", input.storeId)
    .maybeSingle();
  if (storeError) throw new Error(storeError.message);
  if (!store) throw new Error("Mağaza bulunamadı veya erişim yetkiniz yok");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("emit_notification", {
    _store_id: input.storeId,
    _kind: input.kind,
    _title: input.title,
    ...(input.message ? { _message: input.message } : {}),
    _entity: "system",
    
    _meta: {},
  });
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data };
}
