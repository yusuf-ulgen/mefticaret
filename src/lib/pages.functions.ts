import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "@/lib/mefti";

/**
 * Vitrin içerik sayfaları (CMS). Tenant izolasyonu RLS ile zorlanır;
 * burada doğrulama, slug üretimi ve audit kaydı yapılır.
 */

const pageInput = z.object({
  storeId: z.string().uuid(),
  pageId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(140),
  slug: z.string().trim().max(140).optional(),
  excerpt: z.string().trim().max(400).optional(),
  body: z.string().max(20_000).default(""),
  seoDescription: z.string().trim().max(300).optional(),
  isPublished: z.boolean().default(false),
  showInFooter: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
  /** CMS alanları — blog yazıları ve zamanlanmış yayın için. */
  pageKind: z.enum(["page", "blog"]).optional(),
  status: z.enum(["draft", "published", "scheduled"]).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  authorId: z.string().uuid().nullable().optional(),
  authorName: z.string().trim().max(120).nullable().optional(),
  coverUrl: z.string().trim().max(600).nullable().optional(),
  tagIds: z.array(z.string().uuid()).max(30).optional(),
});

export const savePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => pageInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const base = slugify(data.slug || data.title) || "sayfa";
    let slug = base;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const { data: taken } = await supabase
        .from("store_pages")
        .select("id")
        .eq("store_id", data.storeId)
        .eq("slug", slug)
        .maybeSingle();
      if (!taken || taken.id === data.pageId) break;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const status = data.status ?? (data.isPublished ? "published" : "draft");
    if (status === "scheduled" && !data.scheduledAt) {
      throw new Error("Zamanlanmış yayın için tarih seçmelisin");
    }

    const payload = {
      store_id: data.storeId,
      title: data.title,
      slug,
      excerpt: data.excerpt ?? null,
      body: data.body,
      seo_description: data.seoDescription ?? null,
      is_published: status === "published",
      show_in_footer: data.showInFooter,
      sort_order: data.sortOrder,
      page_kind: data.pageKind ?? "page",
      status,
      scheduled_at: status === "scheduled" ? (data.scheduledAt ?? null) : null,
      category_id: data.categoryId ?? null,
      author_id: data.authorId ?? null,
      author_name: data.authorName ?? null,
      cover_url: data.coverUrl ?? null,
    };

    const query = data.pageId
      ? supabase.from("store_pages").update(payload).eq("id", data.pageId).eq("store_id", data.storeId)
      : supabase.from("store_pages").insert(payload);

    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(error.message);

    if (data.tagIds) {
      await supabase.from("store_page_tags").delete().eq("page_id", row.id).eq("store_id", data.storeId);
      if (data.tagIds.length) {
        const { error: tagError } = await supabase.from("store_page_tags").insert(
          data.tagIds.map((tagId) => ({ page_id: row.id, tag_id: tagId, store_id: data.storeId })),
        );
        if (tagError) throw new Error(tagError.message);
      }
    }

    await supabase.from("audit_logs").insert({
      store_id: data.storeId,
      actor_id: userId,
      action: data.pageId ? "page.updated" : "page.created",
      entity: "store_page",
      entity_id: row.id,
      new_value: { title: row.title, slug: row.slug, status: row.status, page_kind: row.page_kind },
    });

    return row;
  });

export const deletePage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ storeId: z.string().uuid(), pageId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("store_pages")
      .delete()
      .eq("id", data.pageId)
      .eq("store_id", data.storeId);
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      store_id: data.storeId,
      actor_id: userId,
      action: "page.deleted",
      entity: "store_page",
      entity_id: data.pageId,
    });

    return { ok: true };
  });
