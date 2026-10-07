/**
 * Blog Sistemi v2 — panel sunucu işlevleri (mağaza blogu).
 * Her çağrı mağaza yönetim yetkisini doğrular; HTML sunucuda temizlenir.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BLOG_SCHEMA_TYPES, BLOG_STATUSES, contentStats } from "@/lib/blog-content";
import { sanitizeBlogHtml } from "@/lib/blog-sanitize";
import { slugify } from "@/lib/mefti";

type Db = { from: (t: string) => any };

async function guard(supabase: unknown, storeId: string, userId: string) {
  const { assertStoreManager } = await import("@/lib/store-access.server");
  await assertStoreManager(supabase as never, storeId, userId);
  return supabase as Db;
}

/** Yayınlanan mağaza blog yazısını arama motorlarına bildirir (mağaza yayındaysa). */
async function pingStoreBlog(db: Db, storeId: string, postSlug: string) {
  const { data: store } = await db.from("stores").select("slug, status").eq("id", storeId).maybeSingle();
  if (!store?.slug || store.status !== "active") return;
  const { pingBlogPostIndexNow } = await import("@/lib/indexnow.server");
  await pingBlogPostIndexNow(postSlug, store.slug as string);
}

const postInput = z.object({
  storeId: z.guid(),
  pageId: z.guid().optional(),
  title: z.string().trim().min(2).max(160),
  slug: z.string().trim().max(160).optional(),
  excerpt: z.string().trim().max(500).optional(),
  body: z.string().max(200_000).default(""),
  status: z.enum(Object.keys(BLOG_STATUSES) as [string, ...string[]]),
  scheduledAt: z.string().datetime().nullable().optional(),
  categoryId: z.guid().nullable().optional(),
  authorId: z.guid().nullable().optional(),
  authorName: z.string().trim().max(120).nullable().optional(),
  tagIds: z.array(z.guid()).max(30).optional(),
  coverUrl: z.string().trim().max(600).nullable().optional(),
  coverAlt: z.string().trim().max(255).nullable().optional(),
  postType: z.enum(["article", "news", "tutorial", "product", "guide"]).default("article"),
  featured: z.boolean().default(false),
  allowComments: z.boolean().default(true),
  seoTitle: z.string().trim().max(255).nullable().optional(),
  seoDescription: z.string().trim().max(500).nullable().optional(),
  seoKeywords: z.string().trim().max(500).nullable().optional(),
  ogTitle: z.string().trim().max(255).nullable().optional(),
  ogDescription: z.string().trim().max(500).nullable().optional(),
  ogImageUrl: z.string().trim().max(600).nullable().optional(),
  schemaType: z.enum(BLOG_SCHEMA_TYPES).default("BlogPosting"),
  canonicalUrl: z.string().trim().max(600).nullable().optional(),
  noindex: z.boolean().default(false),
  changeSummary: z.string().trim().max(255).optional(),
  /** Otomatik kayıt revizyon oluşturmaz. */
  autosave: z.boolean().default(false),
});

const httpsOrNull = (value: string | null | undefined) =>
  value && /^(https?:\/\/|\/)/i.test(value) ? value : null;

export const saveBlogPostV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => postInput.parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    if (data.status === "scheduled" && !data.scheduledAt) throw new Error("Zamanlanmış yayın için tarih seçin");

    const base = slugify(data.slug || data.title) || "yazi";
    let slug = base;
    for (let i = 0; i < 6; i += 1) {
      const { data: taken } = await db.from("store_pages").select("id").eq("store_id", data.storeId).eq("slug", slug).maybeSingle();
      if (!taken || taken.id === data.pageId) break;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const body = sanitizeBlogHtml(data.body);
    const stats = contentStats(body);
    const payload = {
      store_id: data.storeId,
      title: data.title,
      slug,
      excerpt: data.excerpt || null,
      body,
      page_kind: "blog",
      status: data.status,
      is_published: data.status === "published",
      show_in_footer: false,
      scheduled_at: data.status === "scheduled" ? data.scheduledAt : null,
      category_id: data.categoryId ?? null,
      author_id: data.authorId ?? null,
      author_name: data.authorName ?? null,
      cover_url: httpsOrNull(data.coverUrl),
      cover_alt: data.coverAlt || null,
      post_type: data.postType,
      featured: data.featured,
      allow_comments: data.allowComments,
      seo_title: data.seoTitle || null,
      seo_description: data.seoDescription || null,
      seo_keywords: data.seoKeywords || null,
      og_title: data.ogTitle || null,
      og_description: data.ogDescription || null,
      og_image_url: httpsOrNull(data.ogImageUrl),
      schema_type: data.schemaType,
      canonical_url: httpsOrNull(data.canonicalUrl),
      noindex: data.noindex,
      word_count: stats.words,
      reading_time_minutes: stats.minutes,
      last_edited_by: context.userId,
      last_edited_at: new Date().toISOString(),
    };

    const query = data.pageId
      ? db.from("store_pages").update(payload).eq("id", data.pageId).eq("store_id", data.storeId)
      : db.from("store_pages").insert(payload);
    const { data: row, error } = await query.select("id, slug, status, revision_count").single();
    if (error) throw new Error(error.message);

    if (data.tagIds) {
      await db.from("store_page_tags").delete().eq("page_id", row.id).eq("store_id", data.storeId);
      if (data.tagIds.length) {
        const { error: tagError } = await db
          .from("store_page_tags")
          .insert(data.tagIds.map((tagId) => ({ page_id: row.id, tag_id: tagId, store_id: data.storeId })));
        if (tagError) throw new Error(tagError.message);
      }
    }

    if (!data.autosave) {
      const next = Number(row.revision_count ?? 0) + 1;
      const { error: revError } = await db.from("blog_post_revisions").insert({
        store_id: data.storeId,
        post_id: row.id,
        revision_number: next,
        title: data.title,
        body,
        excerpt: data.excerpt || null,
        change_summary: data.changeSummary || (data.pageId ? "Güncellendi" : "İlk sürüm"),
        revised_by: context.userId,
      });
      if (!revError) await db.from("store_pages").update({ revision_count: next }).eq("id", row.id).eq("store_id", data.storeId);
    }
    if (row.status === "published") await pingStoreBlog(db, data.storeId, row.slug as string);
    return { id: row.id as string, slug: row.slug as string, status: row.status as string };
  });

/** Tek yazının tüm v2 alanları (düzenleyici için). */
export const getBlogPostV2 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), pageId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: row, error } = await db
      .from("store_pages")
      .select("*, store_page_tags(tag_id)")
      .eq("id", data.pageId)
      .eq("store_id", data.storeId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Yazı bulunamadı");
    const { data: related } = await db
      .from("blog_related_posts")
      .select("related_post_id")
      .eq("post_id", data.pageId)
      .order("sort_order");
    return {
      ...(row as Record<string, any>),
      tagIds: ((row.store_page_tags ?? []) as Array<{ tag_id: string }>).map((t) => t.tag_id),
      relatedIds: ((related ?? []) as Array<{ related_post_id: string }>).map((r) => r.related_post_id),
    };
  });

/** Durum değişikliği: arşivle, zamanlamayı iptal et, yayınla. */
export const setBlogPostStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), pageId: z.guid(), status: z.enum(["draft", "review", "published", "archived"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { error } = await db
      .from("store_pages")
      .update({ status: data.status, scheduled_at: null })
      .eq("id", data.pageId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);
    if (data.status === "published") {
      const { data: page } = await db.from("store_pages").select("slug").eq("id", data.pageId).eq("store_id", data.storeId).maybeSingle();
      if (page?.slug) await pingStoreBlog(db, data.storeId, page.slug as string);
    }
    return { ok: true };
  });

export const duplicateBlogPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), pageId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: src, error } = await db.from("store_pages").select("*").eq("id", data.pageId).eq("store_id", data.storeId).single();
    if (error) throw new Error(error.message);
    const copy = { ...(src as Record<string, unknown>) };
    for (const key of ["id", "created_at", "updated_at", "published_at", "scheduled_at", "view_count", "like_count", "comment_count", "revision_count"]) delete copy[key];
    copy["title"] = `${String(src.title)} (kopya)`.slice(0, 160);
    copy["slug"] = `${String(src.slug)}-kopya-${Math.random().toString(36).slice(2, 6)}`;
    copy["status"] = "draft";
    copy["is_published"] = false;
    copy["featured"] = false;
    const { data: row, error: insertError } = await db.from("store_pages").insert(copy).select("id").single();
    if (insertError) throw new Error(insertError.message);
    return { id: row.id as string };
  });

/* ------------------------------- revizyonlar ------------------------------ */

export const listBlogRevisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), pageId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: rows, error } = await db
      .from("blog_post_revisions")
      .select("id, revision_number, title, body, excerpt, change_summary, created_at")
      .eq("store_id", data.storeId)
      .eq("post_id", data.pageId)
      .order("revision_number", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{ id: string; revision_number: number; title: string; body: string | null; excerpt: string | null; change_summary: string | null; created_at: string }>;
  });

export const restoreBlogRevision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), pageId: z.guid(), revisionId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: rev, error } = await db
      .from("blog_post_revisions")
      .select("title, body, excerpt, revision_number")
      .eq("id", data.revisionId)
      .eq("post_id", data.pageId)
      .eq("store_id", data.storeId)
      .single();
    if (error) throw new Error(error.message);
    const stats = contentStats(rev.body ?? "");
    const { error: updateError } = await db
      .from("store_pages")
      .update({ title: rev.title, body: rev.body ?? "", excerpt: rev.excerpt, word_count: stats.words, reading_time_minutes: stats.minutes })
      .eq("id", data.pageId)
      .eq("store_id", data.storeId);
    if (updateError) throw new Error(updateError.message);
    return { ok: true, revision: rev.revision_number as number };
  });

/* --------------------------------- görseller ------------------------------ */

export const uploadStoreBlogImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), dataUrl: z.string().max(8_000_000), fileName: z.string().max(120).optional() }).parse(data))
  .handler(async ({ data, context }) => {
    await guard(context.supabase, data.storeId, context.userId);
    const server = await import("@/lib/blog-cover.server");
    return server.storeBlogCover(server.blogCoverSchema.parse({ dataUrl: data.dataUrl, fileName: data.fileName }));
  });

/** Ürün kartı / koleksiyon bloğu için arama. */
export const searchBlogEmbeds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), kind: z.enum(["product", "collection"]), q: z.string().trim().max(80).default("") }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const like = `%${data.q.replace(/[%_]/g, "")}%`;
    if (data.kind === "collection") {
      const { data: rows } = await db.from("collections").select("id, title, slug, image_url").eq("store_id", data.storeId).ilike("title", like).limit(12);
      return ((rows ?? []) as any[]).map((r: any) => ({ id: r.id as string, title: r.title as string, slug: r.slug as string, image: (r.image_url as string | null) ?? null, price: null as number | null }));
    }
    const { data: rows } = await db
      .from("products")
      .select("id, title, slug, base_price, product_images(url, position)")
      .eq("store_id", data.storeId)
      .eq("status", "active")
      .ilike("title", like)
      .limit(12);
    return ((rows ?? []) as any[]).map((r: any) => {
      const imgs = ((r.product_images ?? []) as Array<{ url: string | null; position: number }>).sort((a, b) => a.position - b.position);
      return { id: r.id as string, title: r.title as string, slug: r.slug as string, image: imgs.find((i) => i.url)?.url ?? null, price: r.base_price === null ? null : Number(r.base_price) };
    });
  });

/* --------------------------- ilgili yazılar (elle) ------------------------ */

export const setRelatedBlogPosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), pageId: z.guid(), relatedIds: z.array(z.guid()).max(6) }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    await db.from("blog_related_posts").delete().eq("post_id", data.pageId).eq("store_id", data.storeId);
    const ids = data.relatedIds.filter((id) => id !== data.pageId);
    if (ids.length) {
      const { error } = await db
        .from("blog_related_posts")
        .insert(ids.map((id, i) => ({ store_id: data.storeId, post_id: data.pageId, related_post_id: id, sort_order: i })));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/* --------------------------------- ayarlar -------------------------------- */

const settingsInput = z.object({
  storeId: z.guid(),
  layout: z.enum(["list", "grid", "magazine"]),
  postsPerPage: z.number().int().min(3).max(48),
  showAuthor: z.boolean(),
  showDate: z.boolean(),
  showTags: z.boolean(),
  showComments: z.boolean(),
  allowComments: z.enum(["all", "registered", "none"]),
  moderationRequired: z.boolean(),
  bannedWords: z.array(z.string().trim().min(2).max(40)).max(100),
});

export const getBlogSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid() }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: row } = await db.from("blog_settings").select("*").eq("store_id", data.storeId).maybeSingle();
    return {
      layout: (row?.layout ?? "list") as "list" | "grid" | "magazine",
      postsPerPage: Number(row?.posts_per_page ?? 12),
      showAuthor: row?.show_author ?? true,
      showDate: row?.show_date ?? true,
      showTags: row?.show_tags ?? true,
      showComments: row?.show_comments ?? true,
      allowComments: (row?.allow_comments ?? "all") as "all" | "registered" | "none",
      moderationRequired: row?.moderation_required ?? true,
      bannedWords: (row?.banned_words ?? []) as string[],
    };
  });

export const saveBlogSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => settingsInput.parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { error } = await db.from("blog_settings").upsert(
      {
        store_id: data.storeId,
        layout: data.layout,
        posts_per_page: data.postsPerPage,
        show_author: data.showAuthor,
        show_date: data.showDate,
        show_tags: data.showTags,
        show_comments: data.showComments,
        allow_comments: data.allowComments,
        moderation_required: data.moderationRequired,
        banned_words: data.bannedWords,
      },
      { onConflict: "store_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------- yorumlar -------------------------------- */

export const listBlogComments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.guid(), status: z.enum(["pending", "approved", "spam", "all"]).default("pending") }).parse(data))
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    let query = db
      .from("blog_comments")
      .select("id, post_id, parent_id, author_name, author_email, content, status, created_at")
      .eq("store_id", data.storeId)
      .neq("status", "deleted")
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as Array<{ id: string; post_id: string; parent_id: string | null; author_name: string; author_email: string | null; content: string; status: string; created_at: string }>;
    const ids = [...new Set(list.map((r) => r.post_id))];
    const titles = new Map<string, string>();
    if (ids.length) {
      const { data: posts } = await db.from("store_pages").select("id, title").in("id", ids);
      for (const p of (posts ?? []) as Array<{ id: string; title: string }>) titles.set(p.id, p.title);
    }
    return list.map((r) => ({ ...r, postTitle: titles.get(r.post_id) ?? "—" }));
  });

export const moderateBlogComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ storeId: z.guid(), ids: z.array(z.guid()).min(1).max(200), status: z.enum(["approved", "spam", "deleted", "pending"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.supabase, data.storeId, context.userId);
    const { data: rows, error } = await db
      .from("blog_comments")
      .update({ status: data.status })
      .in("id", data.ids)
      .eq("store_id", data.storeId)
      .select("post_id");
    if (error) throw new Error(error.message);
    /* Yazı başına onaylı yorum sayısını yeniden hesapla. */
    for (const postId of new Set(((rows ?? []) as Array<{ post_id: string }>).map((r) => r.post_id))) {
      const { count } = await db
        .from("blog_comments")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId)
        .eq("status", "approved");
      await db.from("store_pages").update({ comment_count: count ?? 0 }).eq("id", postId).eq("store_id", data.storeId);
    }
    return { updated: (rows ?? []).length };
  });
