import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** İzleme paneli sunucu fonksiyonları — yalnızca platform yöneticileri. */

export const fetchInfrastructureHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await import("@/lib/platform-admin.server");
    await admin.assertPlatformAdmin(context.supabase, context.userId);
    const monitoring = await import("@/lib/monitoring.server");
    return monitoring.infrastructureHealth();
  });

export const fetchErrorLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        search: z.string().trim().max(120).optional(),
        severity: z.enum(["ALL", "CRITICAL", "WARNING", "INFO"]).default("ALL"),
        onlyOpen: z.boolean().default(false),
        limit: z.number().int().min(10).max(300).default(100),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data, context }) => {
    const admin = await import("@/lib/platform-admin.server");
    await admin.assertPlatformAdmin(context.supabase, context.userId);
    const monitoring = await import("@/lib/monitoring.server");
    return monitoring.listErrorLogs(data);
  });

export const resolveErrorLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.guid(), resolved: z.boolean() }).parse(data))
  .handler(async ({ data, context }) => {
    const admin = await import("@/lib/platform-admin.server");
    await admin.assertPlatformAdmin(context.supabase, context.userId);
    const monitoring = await import("@/lib/monitoring.server");
    return monitoring.setErrorLogResolved(data.id, data.resolved, context.userId);
  });

export const changeErrorLogStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.guid(), status: z.enum(["open", "investigating", "resolved"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertPlatformAdmin } = await import("@/lib/platform-admin.server");
    await assertPlatformAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const current = await supabaseAdmin.from("app_error_logs").select("meta").eq("id", data.id).maybeSingle();
    if (current.error) throw new Error(current.error.message);
    if (!current.data) throw new Error("Hata kaydı bulunamadı");
    const meta = current.data.meta && typeof current.data.meta === "object" && !Array.isArray(current.data.meta) ? current.data.meta : {};
    const result = await supabaseAdmin.from("app_error_logs").update({ resolved_at: data.status === "resolved" ? new Date().toISOString() : null, resolved_by: data.status === "resolved" ? context.userId : null, meta: { ...meta, investigationStatus: data.status, statusChangedAt: new Date().toISOString(), statusChangedBy: context.userId } }).eq("id", data.id);
    if (result.error) throw new Error(result.error.message);
    return { status: data.status };
  });

/** Uyarı kanalını gerçek bir test mesajıyla doğrular. */
export const sendMonitoringTestAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await import("@/lib/platform-admin.server");
    await admin.assertPlatformAdmin(context.supabase, context.userId);
    const monitoring = await import("@/lib/monitoring.server");
    const delivered = await monitoring.sendMonitoringAlert({
      key: `test:${context.userId}`,
      severity: "INFO",
      title: "İzleme kanalı testi",
      detail: "Bu mesaj sistem durumu panelinden gönderildi.",
      muteSeconds: 1,
    });
    return { delivered };
  });
