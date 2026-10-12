import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";

/**
 * Halka açık blog okumaları. Yalnızca yayınlanmış mağazaların yayınlanmış
 * blog yazıları döner; anon SELECT politikaları üzerinden okunur.
 */
function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export type PublicBlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  seo_description: string | null;
  cover_url: string | null;
  author_name: string | null;
  published_at: string | null;
  updated_at: string;
  category: { name: string; slug: string } | null;
  tags: { name: string; slug: string }[];
  readingMinutes: number;
};

/** Yazının okuma süresi (~200 kelime/dk). */
function readingMinutes(body: string | null) {
  const words = (body ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

type PostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  seo_description: string | null;
  body: string | null;
  cover_url: string | null;
  author_name: string | null;
  published_at: string | null;
  updated_at: string;
  category_id: string | null;
  author_id: string | null;
  store_page_tags?: { tag_id: string }[] | null;
};

const POST_COLUMNS =
  "id, title, slug, excerpt, seo_description, body, cover_url, author_name, published_at, updated_at, category_id, author_id, store_page_tags(tag_id)";

async function loadStore(supabase: ReturnType<typeof publicClient>, slug: string) {
  const { data, error } = await supabase.from("stores").select("id, name, slug").eq("slug", slug).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function mapPosts(
  rows: PostRow[],
  categories: { id: string; name: string; slug: string }[],
  tags: { id: string; name: string; slug: string }[],
  authors: { id: string; name: string }[],
): PublicBlogPost[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const authorById = new Map(authors.map((a) => [a.id, a]));
  return rows.map((row) => {
    const category = row.category_id ? catById.get(row.category_id) : null;
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      seo_description: row.seo_description,
      cover_url: row.cover_url,
      author_name: row.author_name ?? (row.author_id ? authorById.get(row.author_id)?.name ?? null : null),
      published_at: row.published_at,
      updated_at: row.updated_at,
      category: category ? { name: category.name, slug: category.slug } : null,
      tags: (row.store_page_tags ?? [])
        .map((link) => tagById.get(link.tag_id))
        .filter((tag): tag is { id: string; name: string; slug: string } => Boolean(tag))
        .map((tag) => ({ name: tag.name, slug: tag.slug })),
      readingMinutes: readingMinutes(row.body),
    };
  });
}

/** Blog listesi: yazılar + kategori/etiket filtre seçenekleri. */
export const getStorefrontBlog = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().trim().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const store = await loadStore(supabase, data.slug);
    if (!store) return null;

    const [postsRes, catRes, tagRes, authorRes] = await Promise.all([
      supabase
        .from("store_pages")
        .select(POST_COLUMNS)
        .eq("store_id", store.id)
        .eq("page_kind", "blog")
        .eq("is_published", true)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .limit(200),
      supabase.from("blog_categories").select("id, name, slug").eq("store_id", store.id).order("sort_order"),
      supabase.from("blog_tags").select("id, name, slug").eq("store_id", store.id).order("name"),
      supabase.from("blog_authors").select("id, name").eq("store_id", store.id),
    ]);
    if (postsRes.error) throw new Error(postsRes.error.message);
    if (catRes.error) throw new Error(catRes.error.message);
    if (tagRes.error) throw new Error(tagRes.error.message);
    if (authorRes.error) throw new Error(authorRes.error.message);

    const posts = mapPosts(
      (postsRes.data ?? []) as unknown as PostRow[],
      catRes.data ?? [],
      tagRes.data ?? [],
      authorRes.data ?? [],
    );

    const usedCategories = (catRes.data ?? [])
      .map((cat) => ({
        ...cat,
        count: posts.filter((post) => post.category?.slug === cat.slug).length,
      }))
      .filter((cat) => cat.count > 0);
    const usedTags = (tagRes.data ?? [])
      .map((tag) => ({
        ...tag,
        count: posts.filter((post) => post.tags.some((item) => item.slug === tag.slug)).length,
      }))
      .filter((tag) => tag.count > 0);

    return { store, posts, categories: usedCategories, tags: usedTags };
  });

/** Blog yazısı için meta: yazar kartı, kategori/etiketler ve ilgili yazılar. */
export const getStorefrontBlogPostMeta = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z.object({ slug: z.string().trim().min(1).max(120), pageSlug: z.string().trim().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const store = await loadStore(supabase, data.slug);
    if (!store) return null;

    const { data: page, error } = await supabase
      .from("store_pages")
      .select(`${POST_COLUMNS}, page_kind`)
      .eq("store_id", store.id)
      .eq("slug", data.pageSlug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!page || (page as { page_kind?: string }).page_kind !== "blog") return null;

    const row = page as unknown as PostRow;

    const [catRes, tagRes, authorRes, relatedRes] = await Promise.all([
      supabase.from("blog_categories").select("id, name, slug").eq("store_id", store.id),
      supabase.from("blog_tags").select("id, name, slug").eq("store_id", store.id),
      supabase
        .from("blog_authors")
        .select("id, name, title, bio, avatar_url")
        .eq("store_id", store.id),
      supabase
        .from("store_pages")
        .select(POST_COLUMNS)
        .eq("store_id", store.id)
        .eq("page_kind", "blog")
        .eq("is_published", true)
        .neq("id", row.id)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(12),
    ]);
    if (catRes.error) throw new Error(catRes.error.message);
    if (tagRes.error) throw new Error(tagRes.error.message);
    if (authorRes.error) throw new Error(authorRes.error.message);
    if (relatedRes.error) throw new Error(relatedRes.error.message);

    const authors = authorRes.data ?? [];
    const [post] = mapPosts([row], catRes.data ?? [], tagRes.data ?? [], authors);
    const relatedAll = mapPosts(
      (relatedRes.data ?? []) as unknown as PostRow[],
      catRes.data ?? [],
      tagRes.data ?? [],
      authors,
    );
    const sameCategory = relatedAll.filter(
      (item) => post?.category && item.category?.slug === post.category.slug,
    );
    const related = [...sameCategory, ...relatedAll.filter((item) => !sameCategory.includes(item))].slice(0, 3);

    const author = row.author_id ? authors.find((item) => item.id === row.author_id) ?? null : null;

    return { post: post ?? null, author, related };
  });
