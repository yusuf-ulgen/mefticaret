import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const resolvePublicPostSlug = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().max(200) }).parse(data))
  .handler(async ({ data }) => {
    const { publicSupabase } = await import("@/lib/public-supabase.server");
    const db = publicSupabase();
    const { data: alias, error } = await db
      .from("platform_post_redirects")
      .select("post_id")
      .eq("old_slug", data.slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!alias) return null;
    const { data: post, error: postError } = await db
      .from("platform_posts")
      .select("slug")
      .eq("id", alias.post_id)
      .eq("is_published", true)
      .maybeSingle();
    if (postError) throw new Error(postError.message);
    return post && post.slug !== data.slug ? String(post.slug) : null;
  });

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
    return ai.generatePlatformBlog(
      input,
      (rows ?? []).map((r) => String(r.title)),
    );
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
