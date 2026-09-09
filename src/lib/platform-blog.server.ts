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
  metaTitle: z.string().trim().max(70).optional(),
  canonicalUrl: z
    .string()
    .trim()
    .max(400)
    .optional()
    .refine((value) => !value || /^https?:\/\//.test(value), "Canonical adresi http(s) ile başlamalı"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  body: z.string().max(60_000).default(""),
  coverUrl: z.string().trim().max(600).optional(),
  seoDescription: z.string().trim().max(320).optional(),
  authorName: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
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
    meta_title: input.metaTitle ?? null,
    canonical_url: input.canonicalUrl ?? null,
    status: input.status,
    body: input.body,
    cover_url: input.coverUrl ?? null,
    seo_description: input.seoDescription ?? null,
    author_name: input.authorName ?? null,
    tags: input.tags,
    is_featured: input.isFeatured,
    sort_order: input.sortOrder,
  };

  if (input.postId) {
    const { data, error } = await supabase
      .from("platform_posts")
      .update(row)
      .eq("id", input.postId)
      .select("id, slug")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Yazı bulunamadı");
    return data;
  }

  const { data, error } = await supabase
    .from("platform_posts")
    .insert(row)
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
