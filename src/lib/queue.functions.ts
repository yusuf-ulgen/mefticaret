import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { JOB_KINDS, JOB_STATUSES, type QueueJob } from "@/lib/queue";

const storeIdSchema = z.object({ storeId: z.guid() });

const listSchema = z.object({
  storeId: z.guid(),
  status: z.enum(JOB_STATUSES).optional(),
  kind: z.enum(JOB_KINDS).optional(),
});

/** Mağazanın kuyruk kayıtlarını listeler (RLS tenant izolasyonunu zorlar). */
export const listJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => listSchema.parse(data))
  .handler(async ({ data, context }): Promise<QueueJob[]> => {
    let query = context.supabase
      .from("job_queue")
      .select("*")
      .eq("store_id", data.storeId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) query = query.eq("status", data.status);
    if (data.kind) query = query.eq("kind", data.kind);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Duruma göre iş sayıları (panel özet kartları). */
export const getQueueStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("job_queue")
      .select("status, kind")
      .eq("store_id", data.storeId)
      .limit(2000);
    if (error) throw new Error(error.message);

    const byStatus: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    for (const row of rows ?? []) {
      byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
      byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
    }
    return { total: rows?.length ?? 0, byStatus, byKind };
  });

const enqueueSchema = z.object({
  storeId: z.guid(),
  kind: z.enum(JOB_KINDS),
  payload: z.record(z.string(), z.unknown()).optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

/** Panelden manuel iş kuyruğa alma (ör. analitik toplama, sitemap yenileme). */
export const queueJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => enqueueSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Yönetici bağlantısına geçmeden önce çağıranın bu mağazaya gerçekten
    // erişebildiğini kullanıcı oturumuna uygulanan RLS ile doğrula.
    const { data: store, error } = await context.supabase
      .from("stores")
      .select("id")
      .eq("id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) throw new Error("Mağaza bulunamadı veya yetkiniz yok");

    const { enqueueJob } = await import("@/lib/queue.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const id = await enqueueJob(supabaseAdmin, {
      kind: data.kind,
      storeId: data.storeId,
      ...(data.payload ? { payload: data.payload } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
    });
    return { id };
  });

const jobIdSchema = z.object({ storeId: z.guid(), id: z.guid() });

/** Başarısız işi yeniden kuyruğa alır. */
export const retryJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => jobIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("job_queue")
      .update({
        status: "queued",
        attempts: 0,
        last_error: null,
        run_at: new Date().toISOString(),
        locked_at: null,
        started_at: null,
        finished_at: null,
      })
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Bekleyen işi iptal eder. */
export const cancelJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => jobIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("job_queue")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("store_id", data.storeId)
      .in("status", ["queued", "failed"]);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Mağaza önbelleğini elle temizler. */
export const clearStoreCache = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    // Yetki kontrolü: kullanıcı mağazayı RLS üzerinden görebiliyor mu?
    const { data: store, error } = await context.supabase
      .from("stores")
      .select("id")
      .eq("id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!store) throw new Error("Mağaza bulunamadı");

    const { invalidateStoreCache } = await import("@/lib/cache.server");
    const removed = await invalidateStoreCache(data.storeId);
    return { removed };
  });

/** Önbellek ad alanı bazlı özet. */
export const getCacheStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => storeIdSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("cache_entries")
      .select("namespace, expires_at")
      .eq("store_id", data.storeId)
      .limit(2000);
    if (error) throw new Error(error.message);

    const now = Date.now();
    const byNamespace: Record<string, { total: number; fresh: number }> = {};
    for (const row of rows ?? []) {
      const bucket = byNamespace[row.namespace] ?? { total: 0, fresh: 0 };
      bucket.total += 1;
      if (new Date(row.expires_at).getTime() > now) bucket.fresh += 1;
      byNamespace[row.namespace] = bucket;
    }
    return { total: rows?.length ?? 0, byNamespace };
  });
