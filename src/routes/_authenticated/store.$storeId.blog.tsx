import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, PenLine, Tags, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteBlogTaxonomy,
  publishDuePosts,
  saveBlogAuthor,
  saveBlogCategory,
  saveBlogTag,
} from "@/lib/blog.functions";
import {
  BLOG_STATUS_LABELS,
  blogAuthorsQuery,
  blogCategoriesQuery,
  blogPostsQuery,
  blogTagsQuery,
  type BlogPostRow,
} from "@/lib/blog-queries";
import { formatDateTime } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";
import { deletePage, savePage } from "@/lib/pages.functions";

export const Route = createFileRoute("/_authenticated/store/$storeId/blog")({
  head: () => ({
    meta: [
      { title: "Blog & İçerik Yönetimi — Mefticaret" },
      {
        name: "description",
        content:
          "Blog yazılarını taslak, yayında veya zamanlanmış olarak yönet; kategori, etiket ve yazar tanımlarını tek ekrandan düzenle.",
      },
      { property: "og:title", content: "Blog & İçerik Yönetimi — Mefticaret" },
      {
        property: "og:description",
        content: "Mefticaret CMS: blog yazıları, kategoriler, etiketler, yazarlar ve zamanlanmış yayın.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlogAdminPage,
});

const EMPTY_POST = {
  pageId: undefined as string | undefined,
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  seoDescription: "",
  coverUrl: "",
  status: "draft" as "draft" | "published" | "scheduled",
  scheduledAt: "",
  categoryId: "",
  authorId: "",
  showInFooter: false,
  tagIds: [] as string[],
};

/** datetime-local <-> ISO dönüşümleri. */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function BlogAdminPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const posts = useQuery(blogPostsQuery(storeId));
  const categories = useQuery(blogCategoriesQuery(storeId));
  const tags = useQuery(blogTagsQuery(storeId));
  const authors = useQuery(blogAuthorsQuery(storeId));
  const store = useQuery(storeQuery(storeId));
  const storeSlug = store.data?.slug ?? null;

  const save = useServerFn(savePage);
  const remove = useServerFn(deletePage);
  const saveCategory = useServerFn(saveBlogCategory);
  const saveTag = useServerFn(saveBlogTag);
  const saveAuthor = useServerFn(saveBlogAuthor);
  const removeTaxonomy = useServerFn(deleteBlogTaxonomy);
  const publishDue = useServerFn(publishDuePosts);

  const [form, setForm] = useState(EMPTY_POST);
  const [categoryDraft, setCategoryDraft] = useState({ name: "", description: "" });
  const [tagDraft, setTagDraft] = useState("");
  const [authorDraft, setAuthorDraft] = useState({ name: "", title: "", bio: "" });

  const invalidateAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["blog-posts", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["blog-categories", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["blog-tags", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["blog-authors", storeId] }),
      queryClient.invalidateQueries({ queryKey: ["store-pages", storeId] }),
    ]);
  };

  const counts = useMemo(() => {
    const rows = posts.data ?? [];
    return {
      draft: rows.filter((row) => row.status === "draft").length,
      published: rows.filter((row) => row.status === "published").length,
      scheduled: rows.filter((row) => row.status === "scheduled").length,
    };
  }, [posts.data]);

  const savePost = useMutation({
    mutationFn: () =>
      save({
        data: {
          storeId,
          pageId: form.pageId,
          title: form.title,
          slug: form.slug || undefined,
          excerpt: form.excerpt || undefined,
          body: form.body,
          seoDescription: form.seoDescription || undefined,
          isPublished: form.status === "published",
          showInFooter: form.showInFooter,
          sortOrder: 0,
          pageKind: "blog",
          status: form.status,
          scheduledAt:
            form.status === "scheduled" && form.scheduledAt
              ? new Date(form.scheduledAt).toISOString()
              : null,
          categoryId: form.categoryId || null,
          authorId: form.authorId || null,
          authorName:
            (authors.data ?? []).find((author) => author.id === form.authorId)?.name ?? null,
          coverUrl: form.coverUrl || null,
          tagIds: form.tagIds,
        },
      }),
    onSuccess: async () => {
      await invalidateAll();
      toast.success(form.pageId ? "Yazı güncellendi" : "Yazı oluşturuldu");
      setForm(EMPTY_POST);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  /** Listeden tek tıkla yayınla / taslağa al. */
  const togglePublish = useMutation({
    mutationFn: (post: BlogPostRow) => {
      const next = post.status === "published" ? "draft" : "published";
      return save({
        data: {
          storeId,
          pageId: post.id,
          title: post.title,
          slug: post.slug,
          excerpt: post.excerpt ?? undefined,
          body: post.body,
          seoDescription: post.seo_description ?? undefined,
          isPublished: next === "published",
          showInFooter: post.show_in_footer,
          sortOrder: post.sort_order,
          pageKind: "blog",
          status: next,
          scheduledAt: null,
          categoryId: post.category_id,
          authorId: post.author_id,
          authorName: post.author_name,
          coverUrl: post.cover_url,
          tagIds: post.tagIds,
        },
      });
    },
    onSuccess: async (_data, post) => {
      await invalidateAll();
      toast.success(post.status === "published" ? "Yazı taslağa alındı" : "Yazı yayınlandı");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deletePost = useMutation({

    mutationFn: (pageId: string) => remove({ data: { storeId, pageId } }),
    onSuccess: async () => {
      await invalidateAll();
      toast.success("Yazı silindi");
      setForm(EMPTY_POST);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const categoryMutation = useMutation({
    mutationFn: () =>
      saveCategory({
        data: {
          storeId,
          name: categoryDraft.name,
          description: categoryDraft.description || undefined,
          sortOrder: 0,
        },
      }),
    onSuccess: async () => {
      await invalidateAll();
      setCategoryDraft({ name: "", description: "" });
      toast.success("Kategori kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const tagMutation = useMutation({
    mutationFn: () => saveTag({ data: { storeId, name: tagDraft } }),
    onSuccess: async () => {
      await invalidateAll();
      setTagDraft("");
      toast.success("Etiket kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const authorMutation = useMutation({
    mutationFn: () =>
      saveAuthor({
        data: {
          storeId,
          name: authorDraft.name,
          title: authorDraft.title || undefined,
          bio: authorDraft.bio || undefined,
        },
      }),
    onSuccess: async () => {
      await invalidateAll();
      setAuthorDraft({ name: "", title: "", bio: "" });
      toast.success("Yazar kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const taxonomyDelete = useMutation({
    mutationFn: (input: { kind: "category" | "tag" | "author"; id: string }) =>
      removeTaxonomy({ data: { storeId, ...input } }),
    onSuccess: async () => {
      await invalidateAll();
      toast.success("Silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishDue({ data: { storeId } }),
    onSuccess: async (result) => {
      await invalidateAll();
      toast.success(`${result.published} zamanlanmış yazı yayına alındı`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const editPost = (post: BlogPostRow) =>
    setForm({
      pageId: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt ?? "",
      body: post.body ?? "",
      seoDescription: post.seo_description ?? "",
      coverUrl: post.cover_url ?? "",
      status: (post.status as typeof EMPTY_POST.status) ?? "draft",
      scheduledAt: toLocalInput(post.scheduled_at),
      categoryId: post.category_id ?? "",
      authorId: post.author_id ?? "",
      showInFooter: post.show_in_footer,
      tagIds: post.tagIds,
    });

  const toggleTag = (tagId: string) =>
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(tagId) ? f.tagIds.filter((id) => id !== tagId) : [...f.tagIds, tagId],
    }));

  return (
    <AppShell
      storeId={storeId}
      title="Blog & CMS"
      description="Blog yazılarını taslak, yayında veya zamanlanmış olarak yönet; kategori, etiket ve yazar tanımlarını düzenle."
    >
      <Tabs defaultValue="posts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="posts">Yazılar</TabsTrigger>
          <TabsTrigger value="categories">Kategoriler</TabsTrigger>
          <TabsTrigger value="tags">Etiketler</TabsTrigger>
          <TabsTrigger value="authors">Yazarlar</TabsTrigger>
        </TabsList>

        <TabsContent value="posts" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Taslak" value={counts.draft} />
            <StatCard label="Yayında" value={counts.published} />
            <StatCard label="Zamanlanmış" value={counts.scheduled} />
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <form
              className="surface-card space-y-4 p-6 lg:col-span-2"
              onSubmit={(event) => {
                event.preventDefault();
                savePost.mutate();
              }}
            >
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <PenLine className="size-4" />
                  {form.pageId ? "Yazıyı düzenle" : "Yeni yazı"}
                </h2>
                {form.pageId ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setForm(EMPTY_POST)}>
                    Vazgeç
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="b-title">Başlık</Label>
                <Input
                  id="b-title"
                  required
                  minLength={2}
                  value={form.title}
                  onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
                  placeholder="Örn. Kış bakım rehberi"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="b-slug">Adres (opsiyonel)</Label>
                <Input
                  id="b-slug"
                  value={form.slug}
                  onChange={(event) => setForm((f) => ({ ...f, slug: event.target.value }))}
                  placeholder="kis-bakim-rehberi"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Durum</Label>
                  <Select
                    value={form.status}
                    onValueChange={(value) =>
                      setForm((f) => ({ ...f, status: value as typeof EMPTY_POST.status }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Taslak</SelectItem>
                      <SelectItem value="published">Yayında</SelectItem>
                      <SelectItem value="scheduled">Zamanlanmış</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="b-sched">Yayın tarihi</Label>
                  <Input
                    id="b-sched"
                    type="datetime-local"
                    disabled={form.status !== "scheduled"}
                    value={form.scheduledAt}
                    onChange={(event) => setForm((f) => ({ ...f, scheduledAt: event.target.value }))}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select
                    value={form.categoryId || "none"}
                    onValueChange={(value) =>
                      setForm((f) => ({ ...f, categoryId: value === "none" ? "" : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kategori seç" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kategorisiz</SelectItem>
                      {(categories.data ?? []).map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Yazar</Label>
                  <Select
                    value={form.authorId || "none"}
                    onValueChange={(value) =>
                      setForm((f) => ({ ...f, authorId: value === "none" ? "" : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Yazar seç" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Yazar yok</SelectItem>
                      {(authors.data ?? []).map((author) => (
                        <SelectItem key={author.id} value={author.id}>
                          {author.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Etiketler</Label>
                {(tags.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Henüz etiket yok. Etiketler sekmesinden ekleyebilirsin.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(tags.data ?? []).map((tag) => (
                      <Button
                        key={tag.id}
                        type="button"
                        size="sm"
                        variant={form.tagIds.includes(tag.id) ? "default" : "outline"}
                        onClick={() => toggleTag(tag.id)}
                      >
                        {tag.name}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="b-cover">Kapak görseli adresi</Label>
                <Input
                  id="b-cover"
                  value={form.coverUrl}
                  onChange={(event) => setForm((f) => ({ ...f, coverUrl: event.target.value }))}
                  placeholder="https://…"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="b-excerpt">Kısa özet</Label>
                <Textarea
                  id="b-excerpt"
                  rows={2}
                  value={form.excerpt}
                  onChange={(event) => setForm((f) => ({ ...f, excerpt: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="b-body">İçerik</Label>
                <Textarea
                  id="b-body"
                  rows={12}
                  value={form.body}
                  onChange={(event) => setForm((f) => ({ ...f, body: event.target.value }))}
                  placeholder="Yazı metnini buraya yaz…"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="b-seo">SEO açıklaması</Label>
                <Input
                  id="b-seo"
                  maxLength={300}
                  value={form.seoDescription}
                  onChange={(event) => setForm((f) => ({ ...f, seoDescription: event.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Alt menüde göster</p>
                  <p className="text-xs text-muted-foreground">Yazıyı vitrin alt menüsüne ekle.</p>
                </div>
                <Switch
                  checked={form.showInFooter}
                  onCheckedChange={(checked) => setForm((f) => ({ ...f, showInFooter: checked }))}
                />
              </div>

              <Button type="submit" className="w-full" disabled={savePost.isPending}>
                {savePost.isPending ? "Kaydediliyor…" : form.pageId ? "Yazıyı güncelle" : "Yazıyı oluştur"}
              </Button>
            </form>

            <div className="space-y-3 lg:col-span-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Yazılar</h2>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={publishMutation.isPending}
                  onClick={() => publishMutation.mutate()}
                >
                  <CalendarClock className="mr-2 size-4" />
                  Zamanı geleni yayına al
                </Button>
              </div>

              {posts.isLoading ? (
                <p className="text-sm text-muted-foreground">Yükleniyor…</p>
              ) : (posts.data ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                  Henüz blog yazısı yok. Soldaki formdan ilk yazını oluştur.
                </div>
              ) : (
                <div className="space-y-3">
                  {(posts.data ?? []).map((post) => {
                    const category = (categories.data ?? []).find((item) => item.id === post.category_id);
                    const postTags = (tags.data ?? []).filter((tag) => post.tagIds.includes(tag.id));
                    return (
                      <div key={post.id} className="surface-card space-y-2 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{post.title}</p>
                            <p className="text-xs text-muted-foreground">/{post.slug}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={post.status === "published" ? "default" : "secondary"}>
                              {BLOG_STATUS_LABELS[post.status] ?? post.status}
                            </Badge>
                            <Button size="sm" variant="outline" onClick={() => editPost(post)}>
                              Düzenle
                            </Button>
                            <Button
                              size="sm"
                              variant={post.status === "published" ? "outline" : "default"}
                              disabled={togglePublish.isPending}
                              onClick={() => togglePublish.mutate(post)}
                            >
                              {post.status === "published" ? "Taslağa al" : "Yayınla"}
                            </Button>
                            {storeSlug ? (
                              <Button size="sm" variant="ghost" asChild>
                                <a
                                  href={`/s/${storeSlug}/page/${post.slug}`}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                >
                                  Önizle
                                </a>
                              </Button>
                            ) : null}
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deletePost.mutate(post.id)}
                              aria-label="Yazıyı sil"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {category ? <Badge variant="outline">{category.name}</Badge> : null}
                          {post.author_name ? (
                            <span className="inline-flex items-center gap-1">
                              <UserRound className="size-3" />
                              {post.author_name}
                            </span>
                          ) : null}
                          {post.status === "scheduled" && post.scheduled_at ? (
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="size-3" />
                              {formatDateTime(post.scheduled_at)}
                            </span>
                          ) : post.published_at ? (
                            <span>{formatDateTime(post.published_at)}</span>
                          ) : null}
                          {postTags.length ? (
                            <span className="inline-flex items-center gap-1">
                              <Tags className="size-3" />
                              {postTags.map((tag) => tag.name).join(", ")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="grid gap-6 lg:grid-cols-5">
          <form
            className="surface-card space-y-4 p-6 lg:col-span-2"
            onSubmit={(event) => {
              event.preventDefault();
              categoryMutation.mutate();
            }}
          >
            <h2 className="text-lg font-semibold">Yeni kategori</h2>
            <div className="space-y-2">
              <Label htmlFor="c-name">Ad</Label>
              <Input
                id="c-name"
                required
                minLength={2}
                value={categoryDraft.name}
                onChange={(event) => setCategoryDraft((d) => ({ ...d, name: event.target.value }))}
                placeholder="Rehberler"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-desc">Açıklama</Label>
              <Textarea
                id="c-desc"
                rows={3}
                value={categoryDraft.description}
                onChange={(event) => setCategoryDraft((d) => ({ ...d, description: event.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={categoryMutation.isPending}>
              Kategori ekle
            </Button>
          </form>

          <div className="space-y-3 lg:col-span-3">
            {(categories.data ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                Henüz kategori yok.
              </div>
            ) : (
              (categories.data ?? []).map((category) => (
                <div key={category.id} className="surface-card flex items-start justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">/{category.slug}</p>
                    {category.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
                    ) : null}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Kategoriyi sil"
                    onClick={() => taxonomyDelete.mutate({ kind: "category", id: category.id })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="tags" className="grid gap-6 lg:grid-cols-5">
          <form
            className="surface-card space-y-4 p-6 lg:col-span-2"
            onSubmit={(event) => {
              event.preventDefault();
              tagMutation.mutate();
            }}
          >
            <h2 className="text-lg font-semibold">Yeni etiket</h2>
            <div className="space-y-2">
              <Label htmlFor="t-name">Ad</Label>
              <Input
                id="t-name"
                required
                minLength={2}
                value={tagDraft}
                onChange={(event) => setTagDraft(event.target.value)}
                placeholder="kampanya"
              />
            </div>
            <Button type="submit" className="w-full" disabled={tagMutation.isPending}>
              Etiket ekle
            </Button>
          </form>

          <div className="lg:col-span-3">
            {(tags.data ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                Henüz etiket yok.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(tags.data ?? []).map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm"
                  >
                    {tag.name}
                    <button
                      type="button"
                      aria-label={`${tag.name} etiketini sil`}
                      onClick={() => taxonomyDelete.mutate({ kind: "tag", id: tag.id })}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="authors" className="grid gap-6 lg:grid-cols-5">
          <form
            className="surface-card space-y-4 p-6 lg:col-span-2"
            onSubmit={(event) => {
              event.preventDefault();
              authorMutation.mutate();
            }}
          >
            <h2 className="text-lg font-semibold">Yeni yazar</h2>
            <div className="space-y-2">
              <Label htmlFor="a-name">Ad soyad</Label>
              <Input
                id="a-name"
                required
                minLength={2}
                value={authorDraft.name}
                onChange={(event) => setAuthorDraft((d) => ({ ...d, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-title">Ünvan</Label>
              <Input
                id="a-title"
                value={authorDraft.title}
                onChange={(event) => setAuthorDraft((d) => ({ ...d, title: event.target.value }))}
                placeholder="İçerik editörü"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="a-bio">Biyografi</Label>
              <Textarea
                id="a-bio"
                rows={4}
                value={authorDraft.bio}
                onChange={(event) => setAuthorDraft((d) => ({ ...d, bio: event.target.value }))}
              />
            </div>
            <Button type="submit" className="w-full" disabled={authorMutation.isPending}>
              Yazar ekle
            </Button>
          </form>

          <div className="space-y-3 lg:col-span-3">
            {(authors.data ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                Henüz yazar yok.
              </div>
            ) : (
              (authors.data ?? []).map((author) => (
                <div key={author.id} className="surface-card flex items-start justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium">{author.name}</p>
                    {author.title ? (
                      <p className="text-xs text-muted-foreground">{author.title}</p>
                    ) : null}
                    {author.bio ? <p className="mt-1 text-sm text-muted-foreground">{author.bio}</p> : null}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Yazarı sil"
                    onClick={() => taxonomyDelete.mutate({ kind: "author", id: author.id })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
