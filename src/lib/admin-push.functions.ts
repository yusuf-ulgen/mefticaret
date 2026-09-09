import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Süper yönetici push bildirim merkezi — her çağrıda platform_admin doğrulanır. */

export const fetchPushOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await import("@/lib/platform-admin.server");
    await admin.assertPlatformAdmin(context.supabase, context.userId);
    const server = await import("@/lib/admin-push.server");
    return server.pushOverview();
  });

export const sendAdminPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const admin = await import("@/lib/platform-admin.server");
    await admin.assertPlatformAdmin(context.supabase, context.userId);
    const server = await import("@/lib/admin-push.server");
    return server.sendPlatformPush(server.platformPushSchema.parse(data), context.userId);
  });
