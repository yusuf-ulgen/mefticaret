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
