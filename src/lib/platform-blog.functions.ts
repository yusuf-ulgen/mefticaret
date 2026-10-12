import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Süper yönetici: platform blog yazıları CRUD. */

export const savePlatformPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const guard = await import("@/lib/platform-admin.server");
    await guard.assertPlatformAdmin(context.supabase, context.userId);
    const server = await import("@/lib/platform-blog.server");
    return server.upsertPlatformPost(context.supabase, server.platformPostSchema.parse(data));
  });

/** Süper yönetici: e-ticaret uzmanı AI ile platform blog yazısı üret / iyileştir. */
export const aiPlatformPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const guard = await import("@/lib/platform-admin.server");
    await guard.assertPlatformAdmin(context.supabase, context.userId);
    const ai = await import("@/lib/platform-blog-ai.server");
    const input = ai.platformBlogAiSchema.parse(data);
    const { data: rows } = await context.supabase
      .from("platform_posts")
      .select("title")
      .order("created_at", { ascending: false })
      .limit(60);
    return ai.generatePlatformBlog(input, (rows ?? []).map((r) => String(r.title)));
  });

export const removePlatformPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    const guard = await import("@/lib/platform-admin.server");
    await guard.assertPlatformAdmin(context.supabase, context.userId);
    const server = await import("@/lib/platform-blog.server");
    return server.deletePlatformPost(context.supabase, server.deletePlatformPostSchema.parse(data));
  });
