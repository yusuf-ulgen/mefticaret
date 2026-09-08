import { z } from "zod";

import { slugify } from "@/lib/mefti";

/** Süper admin: platform genelinde blog yazılarının sunucu tarafı yönetimi. */

export const listSchema = z.object({
  storeId: z.guid().optional(),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["all", "draft", "published", "scheduled"]).default("all"),
});

export const postSchema = z.object({
  id: z.guid().optional(),
  storeId: z.guid(),
  title: z.string().trim().min(2).max(200),
  slug: z.string().trim().max(200).optional(),
  excerpt: z.string().trim().max(600).optional(),
  body: z.string().max(60000).default(""),
  seoDescription: z.string().trim().max(320).optional(),
  authorName: z.string().trim().max(120).optional(),
  coverUrl: z.string().trim().max(600).optional(),
  status: z.enum(["draft", "published", "scheduled"]).default("draft"),
  scheduledAt: z.string().trim().max(40).optional(),
  showInFooter: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});

export const deletePostSchema = z.object({ id: z.guid() });

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (table: string) => any };
}

export async function listStores() {
  const client = await db();
  const { data, error } = await client
    .from("stores")
    .select("id, name, slug, status")
    .order("name", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; name: string; slug: string; status: string }[];
}

export async function listPosts(input: z.infer<typeof listSchema>) {
  const client = await db();
  let query = client
    .from("store_pages")
    .select(
      "id, store_id, title, slug, excerpt, body, seo_description, status, scheduled_at, published_at, updated_at, author_name, cover_url, show_in_footer, sort_order, stores(name, slug)",
    )
    .eq("page_kind", "blog")
    .order("updated_at", { ascending: false })
    .limit(300);

  if (input.storeId) query = query.eq("store_id", input.storeId);
  if (input.status !== "all") query = query.eq("status", input.status);
  if (input.search) query = query.or(`title.ilike.%${input.search}%,slug.ilike.%${input.search}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, any>) => ({
    ...row,
    store_name: row["stores"]?.name ?? null,
    store_slug: row["stores"]?.slug ?? null,
    stores: undefined,
  }));
}

async function uniqueSlug(storeId: string, desired: string, currentId?: string) {
  const client = await db();
  const base = slugify(desired) || "yazi";
  let slug = base;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const { data } = await client
      .from("store_pages")
      .select("id")
      .eq("store_id", storeId)
      .eq("slug", slug)
      .maybeSingle();
    if (!data || data.id === currentId) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return slug;
}

export async function upsertPost(input: z.infer<typeof postSchema>) {
  const client = await db();
  const slug = await uniqueSlug(input.storeId, input.slug || input.title, input.id);
  const nowIso = new Date().toISOString();

  const row: Record<string, unknown> = {
    store_id: input.storeId,
    page_kind: "blog",
    title: input.title,
    slug,
    excerpt: input.excerpt || null,
    body: input.body ?? "",
    seo_description: input.seoDescription || null,
    author_name: input.authorName || null,
    cover_url: input.coverUrl || null,
    status: input.status,
    is_published: input.status === "published",
    published_at: input.status === "published" ? nowIso : null,
    scheduled_at: input.status === "scheduled" && input.scheduledAt ? input.scheduledAt : null,
    show_in_footer: input.showInFooter,
    sort_order: input.sortOrder,
    updated_at: nowIso,
  };

  if (input.id) {
    // Yayın tarihi varsa koru.
    const { data: current } = await client
      .from("store_pages")
      .select("published_at")
      .eq("id", input.id)
      .maybeSingle();
    if (input.status === "published" && current?.published_at) row["published_at"] = current.published_at;
    const { data, error } = await client
      .from("store_pages")
      .update(row)
      .eq("id", input.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: data.id as string, slug };
  }

  const { data, error } = await client.from("store_pages").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  return { id: data.id as string, slug };
}

export async function deletePost(input: z.infer<typeof deletePostSchema>) {
  const client = await db();
  const { error } = await client.from("store_pages").delete().eq("id", input.id).eq("page_kind", "blog");
  if (error) throw new Error(error.message);
  return { ok: true };
}
