import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { slugify } from "@/lib/platform-pages.server";

/** Platform (mefticaret.com) blog yazıları — yalnızca süper yönetici yazabilir. */

export const platformPostSchema = z.object({
  postId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value ? value : undefined)),
  excerpt: z.string().trim().max(600).optional(),
  body: z.string().max(60_000).default(""),
  coverUrl: z.string().trim().max(600).optional(),
  seoDescription: z.string().trim().max(320).optional(),
  authorName: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  isPublished: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export const deletePlatformPostSchema = z.object({ postId: z.string().uuid() });

export async function upsertPlatformPost(
  supabase: SupabaseClient<Database>,
  input: z.infer<typeof platformPostSchema>,
) {
  const slug = slugify(input.slug ?? input.title) || `yazi-${Date.now()}`;
  const row = {
    title: input.title,
    slug,
    excerpt: input.excerpt ?? null,
    body: input.body,
    cover_url: input.coverUrl ?? null,
    seo_description: input.seoDescription ?? null,
    author_name: input.authorName ?? null,
    tags: input.tags,
    is_published: input.isPublished,
    is_featured: input.isFeatured,
    sort_order: input.sortOrder,
  };

  if (input.postId) {
    const { data: current } = await supabase
      .from("platform_posts")
      .select("published_at")
      .eq("id", input.postId)
      .maybeSingle();

    const publishedAt = input.isPublished
      ? (current?.published_at ?? new Date().toISOString())
      : null;

    const { data, error } = await supabase
      .from("platform_posts")
      .update({ ...row, published_at: publishedAt })
      .eq("id", input.postId)
      .select("id, slug")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Yazı bulunamadı");
    return data;
  }

  const { data, error } = await supabase
    .from("platform_posts")
    .insert({ ...row, published_at: input.isPublished ? new Date().toISOString() : null })
    .select("id, slug")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deletePlatformPost(
  supabase: SupabaseClient<Database>,
  input: z.infer<typeof deletePlatformPostSchema>,
) {
  const { error } = await supabase.from("platform_posts").delete().eq("id", input.postId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
