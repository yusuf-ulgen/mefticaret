import { createHmac } from "crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { WEBHOOK_EVENTS } from "@/lib/webhook-events";

type Client = SupabaseClient<Database>;

export const storeIdSchema = z.object({ storeId: z.string().uuid() });

export const saveWebhookSchema = z.object({
  id: z.string().uuid().optional(),
  storeId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  targetUrl: z.string().trim().url().max(500),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  isActive: z.boolean().default(true),
});

export const idSchema = z.object({ id: z.string().uuid() });

export const markReadSchema = z.object({
  storeId: z.string().uuid(),
  id: z.string().uuid().optional(),
});

export function signPayload(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function listWebhooks(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("store_webhooks")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveWebhook(
  supabase: Client,
  input: z.infer<typeof saveWebhookSchema>,
) {
  const payload = {
    store_id: input.storeId,
    name: input.name,
    target_url: input.targetUrl,
    events: input.events as string[],
    is_active: input.isActive,
  };

  if (input.id) {
    const { error } = await supabase.from("store_webhooks").update(payload).eq("id", input.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, id: input.id };
  }

  const { data, error } = await supabase
    .from("store_webhooks")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { ok: true as const, id: data.id };
}

export async function deleteWebhook(supabase: Client, id: string) {
  const { error } = await supabase.from("store_webhooks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

export async function listDeliveries(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select("*, store_webhooks(name, target_url)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Webhook'u tetikler, imzalar ve gönderim kaydını yazar. */
export async function dispatchWebhook(
  supabase: Client,
  webhookId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const { data: hook, error } = await supabase
    .from("store_webhooks")
    .select("*")
    .eq("id", webhookId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!hook) throw new Error("Webhook bulunamadı");

  const body = JSON.stringify({ event, sent_at: new Date().toISOString(), data: payload });
  const signature = signPayload(hook.secret, body);

  let status: "success" | "failed" = "failed";
  let responseStatus: number | null = null;
  let responseBody: string | null = null;

  try {
    const response = await fetch(hook.target_url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mefti-event": event,
        "x-mefti-signature": signature,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    responseStatus = response.status;
    responseBody = (await response.text()).slice(0, 2000);
    status = response.ok ? "success" : "failed";
  } catch (cause) {
    responseBody = cause instanceof Error ? cause.message : "Bilinmeyen hata";
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("webhook_deliveries").insert({
    webhook_id: hook.id,
    store_id: hook.store_id,
    event,
    payload: payload as never,
    status,
    response_status: responseStatus,
    response_body: responseBody,
  });

  await supabase
    .from("store_webhooks")
    .update({
      last_triggered_at: new Date().toISOString(),
      last_error: status === "failed" ? responseBody : null,
    })
    .eq("id", hook.id);

  return { ok: status === "success", status: responseStatus, body: responseBody };
}

export async function listNotifications(supabase: Client, storeId: string) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function markNotificationsRead(
  supabase: Client,
  input: z.infer<typeof markReadSchema>,
) {
  let query = supabase.from("notifications").update({ is_read: true }).eq("store_id", input.storeId);
  if (input.id) query = query.eq("id", input.id);
  else query = query.eq("is_read", false);
  const { error } = await query;
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
