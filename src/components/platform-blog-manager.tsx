import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownUp, ExternalLink, PenLine, Plus, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CoverImageUpload } from "@/components/cover-image-upload";
import { MarkdownEditor } from "@/components/markdown-editor";
import { formatDateTime } from "@/lib/mefti";
import { platformPostsQuery } from "@/lib/platform-blog-queries";
import { removePlatformPost, savePlatformPost } from "@/lib/platform-blog.functions";

/** Süper yöneticiye özel platform blog yöneticisi (mefticaret.com yazıları — mağaza seçimi yok). */

const EMPTY = {
  postId: undefined as string | undefined,
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  coverUrl: "",
  metaTitle: "",
  canonicalUrl: "",
  seoDescription: "",
  status: "draft" as PostStatus,
  authorName: "Mefticaret Ekibi",
  tags: "",
  isFeatured: false,
  sortOrder: 0,
};

const TEMPLATES = [
  { title: "E-ticaret rehberi", body: "Adım adım e-ticaret rehberi taslağı." },
  { title: "Ürün duyurusu", body: "Yeni özellik duyurusu taslağı." },
  { title: "Başarı hikâyesi", body: "Müşteri başarı hikâyesi taslağı." },
  { title: "SEO ipuçları", body: "Mağazalar için SEO ipuçları taslağı." },
];

type PostStatus = "draft" | "published" | "archived";

type Filter = "all" | PostStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "published", label: "Yayında" },
  { key: "draft", label: "Taslak" },
  { key: "archived", label: "Arşiv" },
];

const STATUS_LABEL: Record<PostStatus, string> = {
  draft: "Taslak",
  published: "Yayında",
  archived: "Arşiv",
};

function postStatus(post: { status?: string | null; is_published?: boolean | null }): PostStatus {
  const raw = post.status;
  if (raw === "draft" || raw === "published" || raw === "archived") return raw;
  return post.is_published ? "published" : "draft";
}

export function PlatformBlogManager() {
  const queryClient = useQueryClient();
  const { data: posts, isLoading } = useQuery(platformPostsQuery());

  const save = useServerFn(savePlatformPost);
  const remove = useServerFn(removePlatformPost);

  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [term, setTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [newestFirst, setNewestFirst] = useState(true);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["platform-posts"] });

  const rows = useMemo(() => {
    const needle = term.trim().toLocaleLowerCase("tr");
    const list = (posts ?? []).filter((post) => {
      if (filter !== "all" && postStatus(post) !== filter) return false;
      if (!needle) return true;
      return `${post.title} ${post.slug}`.toLocaleLowerCase("tr").includes(needle);
    });
    return [...list].sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return newestFirst ? diff : -diff;
    });
  }, [posts, filter, term, newestFirst]);

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          postId: form.postId,
          title: form.title,
          slug: form.slug || undefined,
          excerpt: form.excerpt || undefined,
          body: form.body,
          coverUrl: form.coverUrl || undefined,
          metaTitle: form.metaTitle || undefined,
          canonicalUrl: form.canonicalUrl || undefined,
          status: form.status,
          seoDescription: form.seoDescription || undefined,
          authorName: form.authorName || undefined,
          tags: form.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
            .slice(0, 12),
          isFeatured: form.isFeatured,
          sortOrder: form.sortOrder,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success(form.postId ? "Yazı güncellendi" : "Yazı oluşturuldu");
      setForm(EMPTY);
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => remove({ data: { postId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Yazı silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <PenLine className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Platform blog yazıları</h2>
        </div>
        <Button
          className="gap-1"
          onClick={() => {
            setForm(EMPTY);
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          Yazı ekle
        </Button>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((item) => (
              <Button
                key={item.key}
                type="button"
                size="sm"
                variant={filter === item.key ? "default" : "ghost"}
                className="rounded-full"
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {showSearch ? (
              <Input
                autoFocus
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Yazı ara…"
                className="h-9 w-44"
                aria-label="Yazı ara"
              />
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full"
              aria-label="Ara"
              onClick={() => setShowSearch((v) => !v)}
            >
              <Search className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="rounded-full"
              aria-label="Sıralamayı değiştir"
              onClick={() => setNewestFirst((v) => !v)}
            >
              <ArrowDownUp className="size-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <PenLine className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="font-medium">Yazı bulunamadı</p>
            <p className="text-sm text-muted-foreground">
              “Yazı ekle” ile hazır şablonlardan hızlıca başlayabilirsin.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((post) => (
              <li key={post.id} className="flex items-start justify-between gap-3 p-4 hover:bg-muted/40">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setForm({
                      postId: post.id,
                      title: post.title,
                      slug: post.slug,
                      excerpt: post.excerpt ?? "",
                      body: post.body,
                      coverUrl: post.cover_url ?? "",
                      metaTitle: post.meta_title ?? "",
                      canonicalUrl: post.canonical_url ?? "",
                      status: postStatus(post),
                      seoDescription: post.seo_description ?? "",
                      authorName: post.author_name ?? "",
                      tags: (post.tags ?? []).join(", "),
                      isFeatured: post.is_featured,
                      sortOrder: post.sort_order,
                    });
                    setOpen(true);
                  }}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{post.title}</span>
                    <Badge
                      variant={
                        postStatus(post) === "published"
                          ? "default"
                          : postStatus(post) === "archived"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {STATUS_LABEL[postStatus(post)]}
                    </Badge>
                    {post.is_featured ? (
                      <Badge variant="outline" className="gap-1">
                        <Star className="size-3" />
                        Öne çıkan
                      </Badge>
                    ) : null}
                  </span>
                  <span className="mt-1 block truncate text-sm text-muted-foreground">
                    {post.excerpt || post.body || `/blog/${post.slug}`}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatDateTime(post.published_at ?? post.created_at)}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {postStatus(post) === "published" ? (
                    <Button asChild variant="ghost" size="icon" aria-label="Sitede görüntüle">
                      <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Yazıyı sil"
                    className="text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(post.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.postId ? "Yazıyı düzenle" : "Yazı ekle"}</DialogTitle>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
            {!form.postId ? (
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((template) => (
                  <Button
                    key={template.title}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, title: template.title, body: template.body }))}
                  >
                    {template.title}
                  </Button>
                ))}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="pb-title">Başlık</Label>
              <Input
                id="pb-title"
                required
                minLength={2}
                value={form.title}
                onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
                placeholder="Örn. E-ticarete başlarken 7 adım"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pb-body">İçerik (Markdown)</Label>
              <MarkdownEditor
                id="pb-body"
                value={form.body}
                onChange={(body) => setForm((f) => ({ ...f, body }))}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pb-slug">Adres (opsiyonel)</Label>
                <Input
                  id="pb-slug"
                  value={form.slug}
                  onChange={(event) => setForm((f) => ({ ...f, slug: event.target.value }))}
                  placeholder="e-ticarete-baslarken"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pb-sort">Sıra</Label>
                <Input
                  id="pb-sort"
                  type="number"
                  min={0}
                  max={999}
                  value={form.sortOrder}
                  onChange={(event) => setForm((f) => ({ ...f, sortOrder: Number(event.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pb-excerpt">Kısa özet</Label>
              <Textarea
                id="pb-excerpt"
                rows={2}
                value={form.excerpt}
                onChange={(event) => setForm((f) => ({ ...f, excerpt: event.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pb-author">Yazar</Label>
                <Input
                  id="pb-author"
                  value={form.authorName}
                  onChange={(event) => setForm((f) => ({ ...f, authorName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pb-tags">Etiketler (virgülle)</Label>
                <Input
                  id="pb-tags"
                  value={form.tags}
                  onChange={(event) => setForm((f) => ({ ...f, tags: event.target.value }))}
                  placeholder="e-ticaret, rehber"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Kapak görseli</Label>
              <CoverImageUpload
                value={form.coverUrl}
                onChange={(coverUrl) => setForm((f) => ({ ...f, coverUrl }))}
              />
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-semibold">Arama motoru bilgileri</p>
              <div className="space-y-2">
                <Label htmlFor="pb-meta-title">Meta başlık</Label>
                <Input
                  id="pb-meta-title"
                  maxLength={70}
                  value={form.metaTitle}
                  onChange={(event) => setForm((f) => ({ ...f, metaTitle: event.target.value }))}
                  placeholder="Boş bırakılırsa başlık kullanılır"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pb-seo">Meta açıklama</Label>
                <Textarea
                  id="pb-seo"
                  rows={2}
                  maxLength={320}
                  value={form.seoDescription}
                  onChange={(event) => setForm((f) => ({ ...f, seoDescription: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pb-canonical">Canonical adres</Label>
                <Input
                  id="pb-canonical"
                  value={form.canonicalUrl}
                  onChange={(event) => setForm((f) => ({ ...f, canonicalUrl: event.target.value }))}
                  placeholder="https://mefticaret.com/blog/..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pb-status">Durum</Label>
                <Select
                  value={form.status}
                  onValueChange={(status) => setForm((f) => ({ ...f, status: status as PostStatus }))}
                >
                  <SelectTrigger id="pb-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Taslak</SelectItem>
                    <SelectItem value="published">Yayında</SelectItem>
                    <SelectItem value="archived">Arşiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="pb-featured" className="text-sm">
                  Öne çıkar
                </Label>
                <Switch
                  id="pb-featured"
                  checked={form.isFeatured}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, isFeatured: checked }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Kaydediliyor…" : form.postId ? "Güncelle" : "Kaydet"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
