import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Süper yönetici: platform SEO paneli okuma/yazma. */

export const fetchPlatformSeoTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const guard = await import("@/lib/platform-admin.server");
    await guard.assertPlatformAdmin(context.supabase, context.userId);
    const server = await import("@/lib/platform-seo.server");
    return server.listPlatformSeoTargets(context.supabase);
  });

export const savePlatformSeoTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const guard = await import("@/lib/platform-admin.server");
    await guard.assertPlatformAdmin(context.supabase, context.userId);
    const server = await import("@/lib/platform-seo.server");
    return server.savePlatformSeoTarget(
      context.supabase,
      server.savePlatformSeoSchema.parse(data),
    );
  });
