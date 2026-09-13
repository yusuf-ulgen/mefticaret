import { createHmac } from "crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { WEBHOOK_EVENTS, WEBHOOK_RETRY_BACKOFF_MINUTES } from "@/lib/webhook-events";

type Client = SupabaseClient<Database>;

export const storeIdSchema = z.object({ storeId: z.guid() });

export const saveWebhookSchema = z.object({
  id: z.guid().optional(),
  storeId: z.guid(),
  name: z.string().trim().min(2).max(120),
  targetUrl: z.string().trim().url().max(500),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  isActive: z.boolean().default(true),
});

export const idSchema = z.object({ id: z.guid() });

export const retryDeliverySchema = z.object({
  storeId: z.guid(),
  deliveryId: z.guid(),
});

export const markReadSchema = z.object({
  storeId: z.guid(),
  id: z.guid().optional(),
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

/** Webhook'u tetikler, imzalar, süresini ölçer ve gönderim kaydını yazar. */
export async function dispatchWebhook(
  supabase: Client,
  webhookId: string,
  event: string,
  payload: Record<string, unknown>,
  attempt = 1,
  manualRetry = false,
) {
  const { data: hook, error } = await supabase
    .from("store_webhooks")
    .select("*")
    .eq("id", webhookId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!hook) throw new Error("Webhook bulunamadı");

  const deliveryId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const body = JSON.stringify({
    id: deliveryId,
    event,
    api_version: hook.api_version ?? "v1",
    store_id: hook.store_id,
    sent_at: timestamp,
    attempt,
    data: payload,
  });
  const signature = signPayload(hook.secret, body);

  let status: "success" | "failed" = "failed";
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;
  const started = Date.now();

  try {
    const { safeFetch } = await import("./safe-fetch.server");
    const response = await safeFetch(hook.target_url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Mefticaret-Webhooks/1.0",
        "x-mefti-event": event,
        "x-mefti-delivery": deliveryId,
        "x-mefti-timestamp": timestamp,
        "x-mefti-signature": `sha256=${signature}`,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
    responseStatus = response.status;
    responseBody = (await response.text()).slice(0, 2000);
    status = response.ok ? "success" : "failed";
    if (!response.ok) errorMessage = `HTTP ${response.status}`;
  } catch (cause) {
    errorMessage = cause instanceof Error ? cause.message : "Bilinmeyen hata";
    responseBody = errorMessage;
  }

  const durationMs = Date.now() - started;
  const maxAttempts = hook.max_attempts ?? 5;
  const backoff = WEBHOOK_RETRY_BACKOFF_MINUTES[Math.min(attempt - 1, WEBHOOK_RETRY_BACKOFF_MINUTES.length - 1)] ?? 60;
  const nextRetryAt =
    status === "failed" && attempt < maxAttempts
      ? new Date(Date.now() + backoff * 60_000).toISOString()
      : null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("webhook_deliveries").insert({
    id: deliveryId,
    webhook_id: hook.id,
    store_id: hook.store_id,
    event,
    payload: payload as never,
    status,
    response_status: responseStatus,
    response_body: responseBody,
    attempt,
    signature,
    duration_ms: durationMs,
    error_message: errorMessage,
    next_retry_at: nextRetryAt,
    delivered_at: status === "success" ? new Date().toISOString() : null,
    manual_retry: manualRetry,
  });

  await supabase
    .from("store_webhooks")
    .update({
      last_triggered_at: new Date().toISOString(),
      last_error: status === "failed" ? errorMessage : null,
    })
    .eq("id", hook.id);

  return {
    ok: status === "success",
    status: responseStatus,
    body: responseBody,
    attempt,
    durationMs,
    nextRetryAt,
  };
}

/** Başarısız bir gönderimi aynı olay ve payload ile elle yeniden dener. */
export async function retryDelivery(
  supabase: Client,
  input: z.infer<typeof retryDeliverySchema>,
) {
  const { data: delivery, error } = await supabase
    .from("webhook_deliveries")
    .select("id, webhook_id, event, payload, attempt, store_id")
    .eq("id", input.deliveryId)
    .eq("store_id", input.storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!delivery) throw new Error("Gönderim kaydı bulunamadı");

  const result = await dispatchWebhook(
    supabase,
    delivery.webhook_id,
    delivery.event,
    (delivery.payload ?? {}) as Record<string, unknown>,
    (delivery.attempt ?? 1) + 1,
    true,
  );

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("webhook_deliveries")
    .update({ next_retry_at: null })
    .eq("id", delivery.id);

  return result;
}

/** Zamanı gelmiş başarısız gönderimleri otomatik yeniden dener (cron tarafından çağrılır). */
export async function processRetryQueue(limit = 25) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const client = supabaseAdmin as unknown as Client;

  const { data: pending, error } = await supabaseAdmin
    .from("webhook_deliveries")
    .select("id, webhook_id, event, payload, attempt, store_id")
    .eq("status", "failed")
    .not("next_retry_at", "is", null)
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  let succeeded = 0;
  let failed = 0;

  for (const delivery of pending ?? []) {
    await supabaseAdmin
      .from("webhook_deliveries")
      .update({ next_retry_at: null })
      .eq("id", delivery.id);
    try {
      const result = await dispatchWebhook(
        client,
        delivery.webhook_id,
        delivery.event,
        (delivery.payload ?? {}) as Record<string, unknown>,
        (delivery.attempt ?? 1) + 1,
      );
      if (result.ok) succeeded += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  return { processed: (pending ?? []).length, succeeded, failed };
}

/** Bir olayı, olaya abone tüm aktif webhook'lara yayınlar. */
export async function emitStoreEvent(
  supabase: Client,
  storeId: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const { data: hooks, error } = await supabase
    .from("store_webhooks")
    .select("id")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .contains("events", [event]);
  if (error) throw new Error(error.message);

  const results = [];
  for (const hook of hooks ?? []) {
    try {
      results.push(await dispatchWebhook(supabase, hook.id, event, payload));
    } catch {
      results.push({ ok: false });
    }
  }
  return { dispatched: results.length, succeeded: results.filter((item) => item.ok).length };
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
