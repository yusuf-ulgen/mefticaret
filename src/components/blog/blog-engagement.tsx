/** Vitrin blog yazısı: beğeni, görüntülenme kaydı ve yorumlar. */

import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

import { getBlogEngagement, likeBlogPost, recordBlogView, submitBlogComment } from "@/lib/blog-engagement.functions";

function sessionId() {
  const key = "mef_blog_sid";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function BlogEngagement({ postId, border, muted, cardBg, radius, accent }: {
  postId: string;
  border: string;
  muted: string;
  cardBg: string;
  radius: number | string;
  accent: string;
}) {
  const get = useServerFn(getBlogEngagement);
  const like = useServerFn(likeBlogPost);
  const view = useServerFn(recordBlogView);
  const submit = useServerFn(submitBlogComment);
  const data = useQuery({ queryKey: ["blog-engagement", postId], queryFn: () => get({ data: { postId } }) });
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", email: "", content: "", website: "" });
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setLiked(localStorage.getItem(`mef_blog_like_${postId}`) === "1");
    void view({ data: { postId, sessionId: sessionId(), referrer: document.referrer || undefined } }).catch(() => undefined);
  }, [postId, view]);

  const likeMutation = useMutation({
    mutationFn: () => like({ data: { postId, sessionId: sessionId() } }),
    onSuccess: (res) => {
      setLiked(true);
      setLikes(res.likes);
      localStorage.setItem(`mef_blog_like_${postId}`, "1");
    },
  });

  const commentMutation = useMutation({
    mutationFn: () => submit({ data: { postId, ...form } }),
    onSuccess: (res) => {
      setForm({ name: form.name, email: form.email, content: "", website: "" });
      setNotice(res.status === "approved" ? "Yorumunuz yayınlandı." : "Yorumunuz alındı, onaylandıktan sonra yayınlanacak.");
      if (res.status === "approved") void data.refetch();
    },
    onError: (e) => setNotice(e instanceof Error ? e.message : "Yorum gönderilemedi"),
  });

  const info = data.data;
  if (!info) return null;
  const input = { width: "100%", border: `1px solid ${border}`, borderRadius: radius, padding: "10px 12px", background: "transparent", color: "inherit", font: "inherit" } as const;

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, color: muted, fontSize: 13 }}>
        <button
          type="button"
          disabled={liked || likeMutation.isPending}
          onClick={() => likeMutation.mutate()}
          aria-label="Beğen"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${border}`, borderRadius: 999, padding: "6px 14px", background: "transparent", color: liked ? accent : "inherit", cursor: liked ? "default" : "pointer" }}
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} /> {likes ?? info.likes}
        </button>
        <span>{info.views.toLocaleString("tr-TR")} görüntülenme</span>
        {info.showComments ? <span>{info.comments.length} yorum</span> : null}
      </div>

      {info.showComments ? (
        <section style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 12px" }}>Yorumlar</h2>
          {info.comments.length === 0 ? <p style={{ color: muted, fontSize: 14 }}>İlk yorumu siz yazın.</p> : null}
          <div style={{ display: "grid", gap: 10 }}>
            {info.comments.map((c) => (
              <div key={c.id} style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: radius, padding: "12px 14px", marginLeft: c.parent_id ? 24 : 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
                  {c.author_name} <span style={{ color: muted, fontWeight: 400, fontSize: 12 }}>· {new Date(c.created_at).toLocaleDateString("tr-TR")}</span>
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 14, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{c.content}</p>
              </div>
            ))}
          </div>

          {info.commentsOpen ? (
            <form
              style={{ display: "grid", gap: 10, marginTop: 18 }}
              onSubmit={(e) => {
                e.preventDefault();
                setNotice(null);
                commentMutation.mutate();
              }}
            >
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                <input required minLength={2} maxLength={80} placeholder="Adınız" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} />
                <input required type="email" maxLength={160} placeholder="E-posta (yayınlanmaz)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} />
              </div>
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={{ position: "absolute", left: -9999, width: 1, height: 1 }} />
              <textarea required minLength={2} maxLength={2000} rows={4} placeholder="Yorumunuz" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} style={input} />
              <button type="submit" disabled={commentMutation.isPending} style={{ justifySelf: "start", border: 0, borderRadius: 999, padding: "10px 20px", background: accent, color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                {commentMutation.isPending ? "Gönderiliyor…" : "Yorum gönder"}
              </button>
              {notice ? <p style={{ color: muted, fontSize: 13, margin: 0 }}>{notice}</p> : null}
            </form>
          ) : (
            <p style={{ color: muted, fontSize: 13, marginTop: 14 }}>Bu yazıda yorumlar kapalı.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
