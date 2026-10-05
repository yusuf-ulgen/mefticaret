/**
 * Vitrin blog etkileşimi: onaylı yorumlar, yorum gönderme, beğeni ve
 * görüntülenme. Yazma işlemleri sunucuda doğrulanır ve hız sınırlıdır;
 * e-posta ve IP bilgisi ziyaretçiye asla döndürülmez.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

const postRef = z.object({ postId: z.guid() });

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as { from: (t: string) => any };
}

/** Yalnız yayında olan mağaza blog yazısını döndürür. */
async function loadPublishedPost(db: { from: (t: string) => any }, postId: string) {
  const { data } = await db
    .from("store_pages")
    .select("id, store_id, allow_comments, like_count, view_count, comment_count, is_published, page_kind")
    .eq("id", postId)
    .maybeSingle();
  if (!data || !data.is_published || data.page_kind !== "blog") return null;
  return data as { id: string; store_id: string; allow_comments: boolean; like_count: number; view_count: number; comment_count: number };
}

async function loadSettings(db: { from: (t: string) => any }, storeId: string) {
  const { data } = await db
    .from("blog_settings")
    .select("allow_comments, moderation_required, banned_words, show_comments")
    .eq("store_id", storeId)
    .maybeSingle();
  return {
    allowComments: (data?.allow_comments ?? "all") as "all" | "registered" | "none",
    moderation: data?.moderation_required ?? true,
    bannedWords: (data?.banned_words ?? []) as string[],
    showComments: data?.show_comments ?? true,
  };
}

async function ipHash() {
  const ip =
    getRequestHeader("cf-connecting-ip") ??
    getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`blog:${ip}`));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export const getBlogEngagement = createServerFn({ method: "GET" })
  .inputValidator((data) => postRef.parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const post = await loadPublishedPost(db, data.postId);
    if (!post) return null;
    const settings = await loadSettings(db, post.store_id);
    const { data: rows } = await db
      .from("blog_comments")
      .select("id, parent_id, author_name, content, created_at")
      .eq("post_id", post.id)
      .eq("status", "approved")
      .order("created_at", { ascending: true })
      .limit(200);
    return {
      likes: post.like_count,
      views: post.view_count,
      commentsOpen: post.allow_comments && settings.allowComments !== "none",
      showComments: settings.showComments,
      comments: (rows ?? []) as Array<{ id: string; parent_id: string | null; author_name: string; content: string; created_at: string }>,
    };
  });

export const submitBlogComment = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        postId: z.guid(),
        parentId: z.guid().nullable().optional(),
        name: z.string().trim().min(2).max(80),
        email: z.string().trim().email().max(160),
        content: z.string().trim().min(2).max(2000),
        /** Gizli tuzak alanı: dolu gelirse bot kabul edilir. */
        website: z.string().max(200).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    if (data.website) return { ok: true as const, status: "pending" as const };
    const db = await admin();
    const post = await loadPublishedPost(db, data.postId);
    if (!post) throw new Error("Yazı bulunamadı");
    const settings = await loadSettings(db, post.store_id);
    if (!post.allow_comments || settings.allowComments === "none") throw new Error("Bu yazıda yorumlar kapalı");
    if (settings.allowComments === "registered") throw new Error("Yorum yapmak için giriş yapmalısınız");

    const hash = await ipHash();
    const { consumeRateLimit } = await import("@/lib/rate-limit.server");
    const limit = await consumeRateLimit(`blog_comment:${hash}`, { limit: 5, windowSeconds: 86_400 });
    if (!limit.allowed) throw new Error("Günlük yorum sınırına ulaştınız, yarın tekrar deneyin");

    const lower = data.content.toLocaleLowerCase("tr");
    const banned = settings.bannedWords.some((w) => w && lower.includes(w.toLocaleLowerCase("tr")));
    const hasLink = /(https?:\/\/|www\.)/i.test(data.content);
    const status = banned ? "spam" : settings.moderation || hasLink ? "pending" : "approved";

    let parentId: string | null = null;
    if (data.parentId) {
      const { data: parent } = await db.from("blog_comments").select("id").eq("id", data.parentId).eq("post_id", post.id).eq("status", "approved").maybeSingle();
      parentId = parent?.id ?? null;
    }

    const { error } = await db.from("blog_comments").insert({
      store_id: post.store_id,
      post_id: post.id,
      parent_id: parentId,
      author_name: data.name,
      author_email: data.email,
      content: data.content,
      status,
      ip_hash: hash,
      user_agent: (getRequestHeader("user-agent") ?? "").slice(0, 300),
    });
    if (error) throw new Error("Yorum kaydedilemedi");
    if (status === "approved") {
      await db.from("store_pages").update({ comment_count: post.comment_count + 1 }).eq("id", post.id);
    }
    return { ok: true as const, status: status === "approved" ? ("approved" as const) : ("pending" as const) };
  });

const sessionRef = z.object({ postId: z.guid(), sessionId: z.string().trim().min(8).max(64) });

export const likeBlogPost = createServerFn({ method: "POST" })
  .inputValidator((data) => sessionRef.parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const post = await loadPublishedPost(db, data.postId);
    if (!post) throw new Error("Yazı bulunamadı");
    const { consumeRateLimit } = await import("@/lib/rate-limit.server");
    const gate = await consumeRateLimit(`blog_like:${await ipHash()}:${post.id}`, { limit: 1, windowSeconds: 86_400 });
    if (!gate.allowed) return { likes: post.like_count, liked: true };
    const { error } = await db.from("blog_post_likes").insert({ post_id: post.id, session_id: data.sessionId });
    if (error) return { likes: post.like_count, liked: true };
    const { count } = await db.from("blog_post_likes").select("id", { count: "exact", head: true }).eq("post_id", post.id);
    await db.from("store_pages").update({ like_count: count ?? post.like_count + 1 }).eq("id", post.id);
    return { likes: count ?? post.like_count + 1, liked: true };
  });

export const recordBlogView = createServerFn({ method: "POST" })
  .inputValidator((data) => sessionRef.extend({ referrer: z.string().max(500).optional() }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const post = await loadPublishedPost(db, data.postId);
    if (!post) return { ok: false };
    const { consumeRateLimit } = await import("@/lib/rate-limit.server");
    const gate = await consumeRateLimit(`blog_view:${await ipHash()}:${post.id}`, { limit: 1, windowSeconds: 3_600 });
    if (!gate.allowed) return { ok: true };
    const { error } = await db.from("blog_post_views").insert({
      store_id: post.store_id,
      post_id: post.id,
      session_id: data.sessionId,
      referrer_url: data.referrer ? data.referrer.slice(0, 500) : null,
    });
    if (!error) {
      const { count } = await db.from("blog_post_views").select("id", { count: "exact", head: true }).eq("post_id", post.id);
      await db.from("store_pages").update({ view_count: count ?? post.view_count + 1 }).eq("id", post.id);
    }
    return { ok: true };
  });
