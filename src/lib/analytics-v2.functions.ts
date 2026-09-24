import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BUCKETS, periodInputSchema, REPORT_KEYS, resolvePeriod, SECTIONS } from "@/lib/analytics-v2";

async function assertMember(supabase: any, userId: string, storeId: string) {
  const [{ data: store }, { data: member }, { data: pa }] = await Promise.all([
    supabase.from("stores").select("owner_id").eq("id", storeId).maybeSingle(),
    supabase.from("store_users").select("role").eq("store_id", storeId).eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "platform_admin").maybeSingle(),
  ]);
  if (!(store?.owner_id === userId || member || pa)) throw new Error("Bu mağaza için yetkiniz yok");
}

export const getAnalyticsSection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    periodInputSchema.extend({ storeId: z.guid(), section: z.enum(SECTIONS), bucket: z.enum(BUCKETS).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, context.userId, data.storeId);
    const { runSection } = await import("@/lib/analytics-v2.server");
    const r = resolvePeriod(data);
    const bucket = data.bucket ?? r.bucket;
    const value = await runSection(context.supabase as never, data.storeId, data.section, r, bucket);
    return { range: r, bucket, value: value as any };
  });

export const getAnalyticsReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => periodInputSchema.extend({ storeId: z.guid(), report: z.enum(REPORT_KEYS) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, context.userId, data.storeId);
    const { buildReport } = await import("@/lib/analytics-v2.server");
    const r = await buildReport(context.supabase as never, data.storeId, data.report, data);
    return r as any;
  });

export const listReportSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ storeId: z.guid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, context.userId, data.storeId);
    const { data: rows, error } = await context.supabase
      .from("analytics_report_schedules")
      .select("report_key, frequency, recipients, is_active, last_sent_at, last_error")
      .eq("store_id", data.storeId);
    if (error) throw new Error("Zamanlanmış raporlar alınamadı");
    return rows ?? [];
  });

export const saveReportSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      storeId: z.guid(),
      reportKey: z.enum(REPORT_KEYS),
      frequency: z.enum(["daily", "weekly", "monthly"]),
      recipients: z.array(z.string().trim().email().max(255)).max(10),
      isActive: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMember(context.supabase, context.userId, data.storeId);
    if (data.isActive && data.recipients.length === 0) throw new Error("En az bir alıcı e-postası girin");
    const { error } = await context.supabase.from("analytics_report_schedules").upsert(
      {
        store_id: data.storeId,
        report_key: data.reportKey,
        frequency: data.frequency,
        recipients: data.recipients,
        is_active: data.isActive,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_id,report_key" },
    );
    if (error) throw new Error("Zamanlama kaydedilemedi");
    return { ok: true };
  });

/** Süper yönetici: mağazaları karşılaştır. */
export const getStoreComparison = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => periodInputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: pa } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId).eq("role", "platform_admin").maybeSingle();
    if (!pa) throw new Error("Yetkiniz yok");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const r = resolvePeriod(data);
    const { data: rows, error } = await supabaseAdmin.rpc("analytics_v2_compare", { _from: r.from, _to: r.to });
    if (error) throw new Error("Karşılaştırma alınamadı");
    return { range: r, rows: rows ?? [] };
  });
