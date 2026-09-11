import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MIGRATION_PROVIDERS, requireMigrationProvider } from "@/lib/migration";
import { MIGRATION_ENTITIES, type MigrationEntity } from "@/lib/migration/types";

/**
 * Mağaza Taşıma sunucu işlevleri.
 *
 * Kimlik bilgileri yalnızca sunucuda `migration_credentials` tablosuna yazılır
 * ve hiçbir zaman istemciye dönmez. Yazma işlemleri servis rolüyle yapıldığı
 * için her çağrıda mağaza yöneticiliği doğrulanır.
 */

const entitySchema = z.enum(MIGRATION_ENTITIES as [MigrationEntity, ...MigrationEntity[]]);

const storeInput = z.object({ storeId: z.string().uuid() });

/** Desteklenen kaynak altyapıların istemciye açık kataloğu (sır içermez). */
export const listMigrationProviders = createServerFn({ method: "GET" }).handler(async () =>
  MIGRATION_PROVIDERS.map((provider) => ({
    code: provider.code,
    name: provider.name,
    region: provider.region,
    docsUrl: provider.docsUrl,
    howTo: provider.howTo,
    entities: provider.entities,
    credentialFields: provider.credentialFields,
  })),
);

export const listMigrationSources = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => storeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("migration_sources")
      .select("id, provider, label, shop_domain, scope, options, status, last_error, last_run_at, created_at")
      .eq("store_id", data.storeId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const saveMigrationSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: z.string().uuid(),
        sourceId: z.string().uuid().optional(),
        provider: z.string().min(2).max(60),
        label: z.string().trim().max(120).optional(),
        shopDomain: z.string().trim().max(300).optional(),
        scope: z.array(entitySchema).min(1),
        credentials: z.record(z.string(), z.string().max(2000)).default({}),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const provider = requireMigrationProvider(data.provider);
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      store_id: data.storeId,
      provider: provider.code,
      label: data.label ?? provider.name,
      shop_domain: data.shopDomain ?? null,
      scope: data.scope,
      config_ref: `migration:${provider.code}`,
      status: "ready",
      last_error: null,
    };

    let sourceId = data.sourceId ?? null;
    if (sourceId) {
      const { error } = await supabaseAdmin
        .from("migration_sources")
        .update(payload)
        .eq("id", sourceId)
        .eq("store_id", data.storeId);
      if (error) throw new Error(error.message);
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("migration_sources")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      sourceId = inserted.id;
    }

    const provided = Object.fromEntries(
      Object.entries(data.credentials).filter(([, value]) => value.trim().length > 0),
    );
    if (Object.keys(provided).length > 0) {
      const { data: current } = await supabaseAdmin
        .from("migration_credentials")
        .select("credentials")
        .eq("source_id", sourceId)
        .maybeSingle();
      const merged = { ...((current?.credentials ?? {}) as Record<string, string>), ...provided };
      const { error } = await supabaseAdmin
        .from("migration_credentials")
        .upsert(
          { source_id: sourceId, store_id: data.storeId, credentials: merged, updated_at: new Date().toISOString() },
          { onConflict: "source_id" },
        );
      if (error) throw new Error(error.message);
    }

    return { sourceId };
  });

export const deleteMigrationSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeId: z.string().uuid(), sourceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("migration_credentials").delete().eq("source_id", data.sourceId);
    const { error } = await supabaseAdmin
      .from("migration_sources")
      .delete()
      .eq("id", data.sourceId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function loadSource(storeId: string, sourceId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("migration_sources")
    .select("id, store_id, provider, shop_domain, scope, options")
    .eq("id", sourceId)
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Kaynak bulunamadı");
  return { admin: supabaseAdmin, source: data };
}

export const testMigrationConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeId: z.string().uuid(), sourceId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { admin, source } = await loadSource(data.storeId, data.sourceId);
    const { testMigrationSource } = await import("@/lib/migration.server");
    const result = await testMigrationSource(admin, source);
    await admin
      .from("migration_sources")
      .update({ status: result.ok ? "ready" : "error", last_error: result.ok ? null : result.message })
      .eq("id", source.id);
    return result;
  });

/** Kuru çalışma: veri yazmadan örnek kayıtları ve sayıları döndürür. */
export const previewMigration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: z.string().uuid(),
        sourceId: z.string().uuid(),
        scope: z.array(entitySchema).min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { admin, source } = await loadSource(data.storeId, data.sourceId);
    const { runMigration } = await import("@/lib/migration.server");
    return runMigration(admin, { source, mode: "preview", scope: data.scope, jobId: null });
  });

/** Gerçek aktarım: iş kaydı açar, idempotent yazar ve raporu döndürür. */
export const startMigrationJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storeId: z.string().uuid(),
        sourceId: z.string().uuid(),
        scope: z.array(entitySchema).min(1),
        maxRecords: z.number().int().min(1).max(20000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertStoreManager } = await import("@/lib/store-access.server");
    await assertStoreManager(context.supabase, data.storeId, context.userId);
    const { admin, source } = await loadSource(data.storeId, data.sourceId);

    const { data: job, error: jobError } = await admin
      .from("migration_jobs")
      .insert({
        store_id: data.storeId,
        source_id: source.id,
        mode: "run",
        scope: data.scope,
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (jobError) throw new Error(jobError.message);

    const { runMigration } = await import("@/lib/migration.server");
    try {
      const report = await runMigration(admin, {
        source,
        mode: "run",
        scope: data.scope,
        jobId: job.id,
        ...(data.maxRecords ? { maxRecords: data.maxRecords } : {}),
      });
      await admin
        .from("migration_jobs")
        .update({
          status: report.errors.length > 0 ? "completed_with_errors" : "completed",
          totals: report.totals,
          sample: report.sample,
          last_error: report.errors.slice(0, 5).join(" | ") || null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      await admin
        .from("migration_sources")
        .update({ last_run_at: new Date().toISOString(), status: "ready" })
        .eq("id", source.id);
      return { jobId: job.id, ...report };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bilinmeyen hata";
      await admin
        .from("migration_jobs")
        .update({ status: "failed", last_error: message.slice(0, 500), finished_at: new Date().toISOString() })
        .eq("id", job.id);
      await admin.from("migration_sources").update({ status: "error", last_error: message.slice(0, 500) }).eq("id", source.id);
      throw new Error(message);
    }
  });

export const listMigrationJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => storeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("migration_jobs")
      .select("id, source_id, mode, scope, status, totals, last_error, started_at, finished_at, created_at")
      .eq("store_id", data.storeId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listMigrationIssues = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storeId: z.string().uuid(), jobId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("migration_records")
      .select("id, entity, external_id, action, message, created_at")
      .eq("store_id", data.storeId)
      .eq("job_id", data.jobId)
      .eq("action", "failed")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
