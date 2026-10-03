import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { centerInputSchema, FLAG_KEY, reportInputSchema } from "@/lib/platform-analytics";

/** Tüm uçlar sunucuda platform_admin rolünü doğrular; platform geneli okuma yalnız bu dosyadan. */
async function guard(context: { supabase: any; userId: string }) {
  const { assertPlatformAdmin } = await import("@/lib/platform-admin.server");
  await assertPlatformAdmin(context.supabase, context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function audit(db: any, actor: string, action: string, value: unknown) {
  await db.from("audit_logs").insert({ actor_id: actor, action, entity: "platform_analytics", new_value: value as never });
}

export const getAnalyticsFlag = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context);
    const { data } = await db.from("platform_settings").select("value").eq("key", FLAG_KEY).maybeSingle();
    return { enabled: Boolean((data?.value as { enabled?: boolean } | null)?.enabled) };
  });

export const setAnalyticsFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context);
    const { error } = await db.from("platform_settings").upsert(
      { key: FLAG_KEY, value: { enabled: data.enabled }, label: "Platform Analitik Merkezi (v2)", is_public: false, updated_by: context.userId, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    if (error) throw new Error("Ayar kaydedilemedi");
    await audit(db, context.userId, "platform_analytics.flag", data);
    return data;
  });

export const getAnalyticsCenter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => centerInputSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { computeCenter } = await import("@/lib/platform-analytics.server");
    return (await computeCenter(data)) as any;
  });

export const runAnalyticsReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => reportInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    await guard(context);
    const { computeReport } = await import("@/lib/platform-analytics.server");
    return (await computeReport(data)) as any;
  });

export const logAnalyticsExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().max(120), rows: z.number().int().min(0).max(100_000), filters: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context);
    await audit(db, context.userId, "platform_analytics.export", data);
    return { ok: true };
  });

export const listSavedViews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context);
    const { data, error } = await db.from("platform_analytics_saved_views").select("id, kind, name, config, updated_at").eq("owner_id", context.userId).order("updated_at", { ascending: false }).limit(100);
    if (error) throw new Error("Kayıtlı görünümler alınamadı");
    return (data ?? []) as { id: string; kind: "view" | "report"; name: string; config: any; updated_at: string }[];
  });

export const saveView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ kind: z.enum(["view", "report"]), name: z.string().trim().min(1).max(120), config: z.record(z.string(), z.unknown()) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context);
    if (data.kind === "report") reportInputSchema.parse(data.config);
    else centerInputSchema.parse(data.config);
    const { error } = await db.from("platform_analytics_saved_views").insert({ owner_id: context.userId, kind: data.kind, name: data.name, config: data.config as never });
    if (error) throw new Error("Kaydedilemedi");
    return { ok: true };
  });

export const deleteView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await guard(context);
    await db.from("platform_analytics_saved_views").delete().eq("id", data.id).eq("owner_id", context.userId);
    return { ok: true };
  });
