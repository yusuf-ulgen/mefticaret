import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Süper admin blog yönetimi — her çağrı platform yöneticisi rolü ile doğrulanır. */

async function guard(supabase: unknown, userId: string) {
  const mod = await import("@/lib/platform-admin.server");
  await mod.assertPlatformAdmin(supabase as never, userId);
}

export const adminBlogStores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await guard(context.supabase, context.userId);
    const server = await import("@/lib/admin-blog.server");
    return server.listStores();
  });

export const adminBlogPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const server = await import("@/lib/admin-blog.server");
    return server.listPosts(server.listSchema.parse(data ?? {}));
  });

export const adminBlogSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const server = await import("@/lib/admin-blog.server");
    return server.upsertPost(server.postSchema.parse(data));
  });

export const adminBlogDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => data)
  .handler(async ({ data, context }) => {
    await guard(context.supabase, context.userId);
    const server = await import("@/lib/admin-blog.server");
    return server.deletePost(server.deletePostSchema.parse(data));
  });
