import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "@/lib/mefti";

/**
 * CMS taksonomisi: blog kategorileri, etiketler ve yazarlar.
 * Tenant izolasyonu RLS ile zorlanır; burada doğrulama + slug üretimi yapılır.
 */

type Table = "blog_categories" | "blog_tags" | "blog_authors";

async function uniqueSlug(
  supabase: { from: (table: Table) => any },
  table: Table,
  storeId: string,
  desired: string,
  fallback: string,
  currentId?: string,
) {
  const base = slugify(desired) || fallback;
  let slug = base;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data: taken } = await supabase
      .from(table)
      .select("id")
      .eq("store_id", storeId)
      .eq("slug", slug)
      .maybeSingle();
    if (!taken || taken.id === currentId) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return slug;
}

export const saveBlogCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        categoryId: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(80),
        slug: z.string().trim().max(80).optional(),
        description: z.string().trim().max(400).optional(),
        sortOrder: z.number().int().min(0).max(999).default(0),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const slug = await uniqueSlug(
      supabase as never,
      "blog_categories",
      data.storeId,
      data.slug || data.name,
      "kategori",
      data.categoryId,
    );

    const payload = {
      store_id: data.storeId,
      name: data.name,
      slug,
      description: data.description ?? null,
      sort_order: data.sortOrder,
    };

    const query = data.categoryId
      ? supabase
          .from("blog_categories")
          .update(payload)
          .eq("id", data.categoryId)
          .eq("store_id", data.storeId)
      : supabase.from("blog_categories").insert(payload);

    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveBlogTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        tagId: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(60),
        slug: z.string().trim().max(60).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const slug = await uniqueSlug(
      supabase as never,
      "blog_tags",
      data.storeId,
      data.slug || data.name,
      "etiket",
      data.tagId,
    );
    const payload = { store_id: data.storeId, name: data.name, slug };

    const query = data.tagId
      ? supabase.from("blog_tags").update(payload).eq("id", data.tagId).eq("store_id", data.storeId)
      : supabase.from("blog_tags").insert(payload);

    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveBlogAuthor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        authorId: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(120),
        slug: z.string().trim().max(120).optional(),
        title: z.string().trim().max(120).optional(),
        bio: z.string().trim().max(1200).optional(),
        avatarUrl: z.string().trim().max(600).optional(),
        email: z.string().trim().email().max(160).optional().or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const slug = await uniqueSlug(
      supabase as never,
      "blog_authors",
      data.storeId,
      data.slug || data.name,
      "yazar",
      data.authorId,
    );

    const payload = {
      store_id: data.storeId,
      name: data.name,
      slug,
      title: data.title ?? null,
      bio: data.bio ?? null,
      avatar_url: data.avatarUrl ?? null,
      email: data.email ? data.email : null,
    };

    const query = data.authorId
      ? supabase.from("blog_authors").update(payload).eq("id", data.authorId).eq("store_id", data.storeId)
      : supabase.from("blog_authors").insert(payload);

    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteBlogTaxonomy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        storeId: z.string().uuid(),
        kind: z.enum(["category", "tag", "author"]),
        id: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const table: Table =
      data.kind === "category" ? "blog_categories" : data.kind === "tag" ? "blog_tags" : "blog_authors";
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("id", data.id)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Zamanı gelen yazıları hemen yayına al (manuel tetikleme). */
export const publishDuePosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const nowIso = new Date().toISOString();
    const { data: rows, error } = await supabase
      .from("store_pages")
      .update({ status: "published", is_published: true })
      .eq("store_id", data.storeId)
      .eq("status", "scheduled")
      .lte("scheduled_at", nowIso)
      .select("id");
    if (error) throw new Error(error.message);
    return { published: (rows ?? []).length };
  });
