import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Süper admin: ana sayfa bölümlerini listeleme, kaydetme, sıralama ve silme. */

export const fetchSiteSectionsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const guard = await import("@/lib/platform-admin.server");
    await guard.assertPlatformAdmin(context.supabase, context.userId);
    const server = await import("@/lib/site-content.server");
    return server.listSections();
  });

export const saveSiteSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const guard = await import("@/lib/platform-admin.server");
    await guard.assertPlatformAdmin(context.supabase, context.userId);
    const server = await import("@/lib/site-content.server");
    return server.upsertSection(server.sectionSchema.parse(data));
  });

export const reorderSiteSections = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const guard = await import("@/lib/platform-admin.server");
    await guard.assertPlatformAdmin(context.supabase, context.userId);
    const server = await import("@/lib/site-content.server");
    return server.reorderSections(server.reorderSchema.parse(data));
  });

export const deleteSiteSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const guard = await import("@/lib/platform-admin.server");
    await guard.assertPlatformAdmin(context.supabase, context.userId);
    const server = await import("@/lib/site-content.server");
    return server.deleteSection(server.deleteSchema.parse(data));
  });
