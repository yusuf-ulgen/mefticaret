import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { JobKind, QueueJob } from "@/lib/queue";

/**
 * Arka plan iş kuyruğu motoru.
 *
 * Ağır işler HTTP isteği sırasında yapılmaz: istek sadece `enqueueJob(...)`
 * çağırır, işi cron worker (`/api/public/cron/queue-worker`) yürütür.
 * Kuyruk PostgreSQL üzerinde `job_queue` tablosu + `claim_jobs` ile atomik
 * olarak kilitlenir; ileride Redis/SQS sürücüsü eklenmek istenirse yalnızca
 * bu modüldeki `claim`/`complete`/`fail` katmanı değişir.
 */

type Client = SupabaseClient<Database>;
type Json = Database["public"]["Tables"]["job_queue"]["Row"]["payload"];

export type EnqueueInput = {
  kind: JobKind;
  storeId?: string | null;
  payload?: Record<string, unknown>;
  priority?: number;
  runAt?: string;
  maxAttempts?: number;
  /** Aynı anahtarla bekleyen iş varsa yeni iş oluşturulmaz. */
  dedupeKey?: string;
};

/** İşi kuyruğa alır ve iş kimliğini döner. */
export async function enqueueJob(supabase: Client, input: EnqueueInput): Promise<string | null> {
  const { data, error } = await supabase.rpc("enqueue_job", {
    _kind: input.kind,
    _payload: (input.payload ?? {}) as Json,
    ...(input.storeId ? { _store_id: input.storeId } : {}),
    ...(input.priority !== undefined ? { _priority: input.priority } : {}),
    ...(input.runAt ? { _run_at: input.runAt } : {}),
    // Varsayılan olarak en fazla 3 deneme (üstel geri çekilme ile).
    _max_attempts: input.maxAttempts ?? 3,
    ...(input.dedupeKey ? { _dedupe_key: input.dedupeKey } : {}),
  });
  if (error) throw new Error(error.message);
  return data ?? null;
}

type JobHandler = (
  supabase: Client,
  job: QueueJob,
) => Promise<Record<string, unknown> | void>;

function payloadOf(job: QueueJob): Record<string, unknown> {
  return job.payload && typeof job.payload === "object" && !Array.isArray(job.payload)
    ? (job.payload as Record<string, unknown>)
    : {};
}

function requireString(job: QueueJob, key: string): string {
  const value = payloadOf(job)[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`İş yükünde "${key}" alanı eksik`);
  }
  return value;
}

/** Kanal mesajlarını sağlayıcıya iletir; sağlayıcı bağlı değilse kuyrukta bırakır. */
async function deliverMessage(supabase: Client, job: QueueJob) {
  const deliveryId = requireString(job, "deliveryId");
  const { data: delivery, error } = await supabase
    .from("message_deliveries")
    .select("*")
    .eq("id", deliveryId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!delivery) throw new Error("Gönderim kaydı bulunamadı");

  if (delivery.channel === "whatsapp" && delivery.store_id) {
    const { sendWhatsAppMessage } = await import("@/lib/whatsapp.server");
    const result = await sendWhatsAppMessage(supabase, {
      storeId: delivery.store_id,
      waId: delivery.recipient,
      body: delivery.body ?? delivery.subject ?? "",
    });
    await supabase
      .from("message_deliveries")
      .update({ status: result.status, error: result.error, sent_at: new Date().toISOString() })
      .eq("id", deliveryId);
    return { channel: delivery.channel, status: result.status };
  }

  // E-posta / SMS / push sağlayıcıları bağlanana kadar kayıt kuyrukta kalır.
  await supabase
    .from("message_deliveries")
    .update({
      status: "queued",
      error: "Kanal sağlayıcısı bağlanana kadar kuyrukta bekliyor",
    })
    .eq("id", deliveryId);
  return { channel: delivery.channel, status: "queued" };
}

const HANDLERS: Record<JobKind, JobHandler> = {
  email: deliverMessage,
  sms: deliverMessage,
  whatsapp: deliverMessage,

  image: async (supabase, job) => {
    const assetId = requireString(job, "assetId");
    const { data: asset, error } = await supabase
      .from("media_assets")
      .select("id, width, height")
      .eq("id", assetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!asset) throw new Error("Medya kaydı bulunamadı");
    await supabase.from("media_assets").update({ optimized: true }).eq("id", assetId);
    return { assetId };
  },

  feed_sync: async () => {
    // XML/Excel besleme entegratörü sistemden kaldırıldı.
    throw new Error("Besleme senkronizasyonu kaldırıldı");
  },

  marketplace_sync: async (supabase, job) => {
    const storeId = job.store_id ?? requireString(job, "storeId");
    const channelId = requireString(job, "channelId");
    const scope = (payloadOf(job)["scope"] as string | undefined) ?? "full";
    const { runChannelSync } = await import("@/lib/marketplace-channels.server");
    const report = await runChannelSync(supabase as never, {
      storeId,
      channelId,
      scope: scope as never,
    });
    return { channelId, report: report as unknown as Record<string, unknown> };
  },

  webhook: async (supabase, job) => {
    const storeId = job.store_id ?? requireString(job, "storeId");
    const event = requireString(job, "event");
    const { emitStoreEvent } = await import("@/lib/webhooks.server");
    await emitStoreEvent(
      supabase,
      storeId,
      event,
      (payloadOf(job)["data"] as Record<string, unknown>) ?? {},
    );
    return { event };
  },

  analytics: async (supabase, job) => {
    const day = (payloadOf(job)["day"] as string | undefined) ?? new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.rpc("rollup_store_daily_stats", { target_day: day });
    if (error) throw new Error(error.message);
    return { day, rows: data ?? 0 };
  },

  ai: async (supabase, job) => {
    const storeId = job.store_id ?? requireString(job, "storeId");
    // Toplu çeviri işleri aynı kuyruk üzerinden parça parça ilerletilir.
    const translationJobId = payloadOf(job)["translationJobId"];
    if (typeof translationJobId === "string" && translationJobId.length > 0) {
      const { runTranslationJob } = await import("@/lib/translation.server");
      const outcome = await runTranslationJob(supabase, translationJobId, 100);
      return { translationJobId, ...outcome };
    }
    const task = requireString(job, "task");
    const prompt = requireString(job, "prompt");

    const { runAiTask } = await import("@/lib/ai.server");
    const result = await runAiTask({
      client: supabase as never,
      storeId,
      task: task as never,
      input: prompt,
    } as never);
    return { task, result: result as unknown as Record<string, unknown> };
  },

  sitemap: async (supabase, job) => {
    const storeId = job.store_id ?? requireString(job, "storeId");
    const { cacheInvalidate, CACHE_NAMESPACES } = await import("@/lib/cache.server");
    await cacheInvalidate({ namespace: CACHE_NAMESPACES.catalog, storeId });
    const { data, error } = await supabase
      .from("stores")
      .select("slug")
      .eq("id", storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { slug: data?.slug ?? null };
  },

  invoice: async (supabase, job) => {
    const orderId = requireString(job, "orderId");
    const { data: order, error } = await supabase
      .from("orders")
      .select("id, order_number, invoice_number")
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("Sipariş bulunamadı");
    if (order.invoice_number) return { orderId, invoiceNumber: order.invoice_number };
    const invoiceNumber = `FTR-${order.order_number}`;
    const { error: updateError } = await supabase
      .from("orders")
      .update({ invoice_number: invoiceNumber })
      .eq("id", orderId);
    if (updateError) throw new Error(updateError.message);
    return { orderId, invoiceNumber };
  },
};

/**
 * Zamanı gelmiş işleri atomik olarak kilitler ve sırayla yürütür.
 * Başarısız işler `fail_job` ile üstel geri çekilme planına alınır.
 */
export async function processQueue(
  supabase: Client,
  options: { limit?: number; kinds?: JobKind[] } = {},
) {
  const { data: jobs, error } = await supabase.rpc("claim_jobs", {
    _limit: options.limit ?? 10,
    ...(options.kinds && options.kinds.length > 0 ? { _kinds: options.kinds } : {}),
  });
  if (error) throw new Error(error.message);

  const results: { id: string; kind: JobKind; ok: boolean; error?: string }[] = [];

  for (const job of (jobs ?? []) as QueueJob[]) {
    const handler = HANDLERS[job.kind];
    try {
      const result = handler ? await handler(supabase, job) : undefined;
      await supabase.rpc("complete_job", { _id: job.id, _result: (result ?? {}) as Json });
      results.push({ id: job.id, kind: job.kind, ok: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "bilinmeyen hata";
      await supabase.rpc("fail_job", { _id: job.id, _error: message.slice(0, 1000) });
      const exhausted = (job.attempts ?? 0) + 1 >= (job.max_attempts ?? 3);
      const { recordAppError } = await import("@/lib/monitoring.server");
      await recordAppError({
        severity: exhausted ? "CRITICAL" : "WARNING",
        source: `queue:${job.kind}`,
        message,
        ...(cause instanceof Error && cause.stack ? { stack: cause.stack } : {}),
        ...(job.store_id ? { storeId: job.store_id } : {}),
        meta: { jobId: job.id, attempts: (job.attempts ?? 0) + 1, maxAttempts: job.max_attempts ?? 3 },
      });
      results.push({ id: job.id, kind: job.kind, ok: false, error: message });
    }
  }

  return { claimed: results.length, results };
}
