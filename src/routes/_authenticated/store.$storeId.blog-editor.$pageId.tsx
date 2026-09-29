import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ChevronDown, History, ImagePlus, Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { BlogEditor, resizeImage } from "@/components/blog/blog-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BLOG_POST_TYPES, BLOG_SCHEMA_TYPES, BLOG_STATUSES, contentStats, isHtmlBody, plainToHtml, seoScore } from "@/lib/blog-content";
import { blogAuthorsQuery, blogCategoriesQuery, blogPostsQuery, blogTagsQuery } from "@/lib/blog-queries";
import {
  getBlogPostV2,
  listBlogRevisions,
  restoreBlogRevision,
  saveBlogPostV2,
  setRelatedBlogPosts,
  uploadStoreBlogImage,
} from "@/lib/blog-v2.functions";
import { formatDateTime } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/blog-editor/$pageId")({
  head: () => ({ meta: [{ title: "Blog yazısı düzenle — Mefticaret" }, { name: "robots", content: "noindex" }] }),
  component: BlogEditorPage,
});

type Form = {
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  status: string;
  scheduledAt: string;
  categoryId: string;
  authorId: string;
  tagIds: string[];
  coverUrl: string;
  coverAlt: string;
  postType: keyof typeof BLOG_POST_TYPES;
  featured: boolean;
  allowComments: boolean;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  schemaType: (typeof BLOG_SCHEMA_TYPES)[number];
  canonicalUrl: string;
  noindex: boolean;
  relatedIds: string[];
};

const EMPTY: Form = {
  title: "", slug: "", excerpt: "", body: "", status: "draft", scheduledAt: "", categoryId: "", authorId: "",
  tagIds: [], coverUrl: "", coverAlt: "", postType: "article", featured: false, allowComments: true,
  seoTitle: "", seoDescription: "", seoKeywords: "", ogTitle: "", ogDescription: "", ogImageUrl: "",
  schemaType: "BlogPosting", canonicalUrl: "", noindex: false, relatedIds: [],
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

function BlogEditorPage() {
  const { storeId, pageId } = Route.useParams();
  const isNew = pageId === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const store = useQuery(storeQuery(storeId));
  const storeSlug = store.data?.slug ?? null;
  const categories = useQuery(blogCategoriesQuery(storeId));
  const tags = useQuery(blogTagsQuery(storeId));
  const authors = useQuery(blogAuthorsQuery(storeId));
  const posts = useQuery(blogPostsQuery(storeId));

  const getPost = useServerFn(getBlogPostV2);
  const save = useServerFn(saveBlogPostV2);
  const saveRelated = useServerFn(setRelatedBlogPosts);
  const upload = useServerFn(uploadStoreBlogImage);
  const listRevs = useServerFn(listBlogRevisions);
  const restoreRev = useServerFn(restoreBlogRevision);

  const [form, setForm] = useState<Form>(EMPTY);
  const [loaded, setLoaded] = useState(isNew);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [coverBusy, setCoverBusy] = useState(false);

  const post = useQuery({
    queryKey: ["blog-post-v2", storeId, pageId],
    enabled: !isNew,
    queryFn: () => getPost({ data: { storeId, pageId } }),
  });

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = post.data as any;
    if (!r) return;
    setForm({
      title: r.title ?? "", slug: r.slug ?? "", excerpt: r.excerpt ?? "",
      body: isHtmlBody(r.body) ? r.body : plainToHtml(r.body ?? ""),
      status: r.status ?? "draft", scheduledAt: toLocalInput(r.scheduled_at), categoryId: r.category_id ?? "",
      authorId: r.author_id ?? "", tagIds: r.tagIds ?? [], coverUrl: r.cover_url ?? "", coverAlt: r.cover_alt ?? "",
      postType: r.post_type ?? "article", featured: Boolean(r.featured), allowComments: r.allow_comments ?? true,
      seoTitle: r.seo_title ?? "", seoDescription: r.seo_description ?? "", seoKeywords: r.seo_keywords ?? "",
      ogTitle: r.og_title ?? "", ogDescription: r.og_description ?? "", ogImageUrl: r.og_image_url ?? "",
      schemaType: r.schema_type ?? "BlogPosting", canonicalUrl: r.canonical_url ?? "", noindex: Boolean(r.noindex),
      relatedIds: r.relatedIds ?? [],
    });
    setLoaded(true);
  }, [post.data]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  };

  const stats = useMemo(() => contentStats(form.body), [form.body]);
  const seo = useMemo(
    () => seoScore({ title: form.title, seoTitle: form.seoTitle, seoDescription: form.seoDescription, coverUrl: form.coverUrl, coverAlt: form.coverAlt, body: form.body, keywords: form.seoKeywords, slug: form.slug }),
    [form],
  );

  const mutation = useMutation({
    mutationFn: async ({ status, autosave }: { status: string; autosave?: boolean }) => {
      const author = (authors.data ?? []).find((a) => a.id === form.authorId);
      const res = await save({
        data: {
          storeId, pageId: isNew ? undefined : pageId, title: form.title, slug: form.slug || undefined,
          excerpt: form.excerpt || undefined, body: form.body, status,
          scheduledAt: status === "scheduled" && form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
          categoryId: form.categoryId || null, authorId: form.authorId || null, authorName: author?.name ?? null,
          tagIds: form.tagIds, coverUrl: form.coverUrl || null, coverAlt: form.coverAlt || null, postType: form.postType,
          featured: form.featured, allowComments: form.allowComments, seoTitle: form.seoTitle || null,
          seoDescription: form.seoDescription || null, seoKeywords: form.seoKeywords || null, ogTitle: form.ogTitle || null,
          ogDescription: form.ogDescription || null, ogImageUrl: form.ogImageUrl || null, schemaType: form.schemaType,
          canonicalUrl: form.canonicalUrl || null, noindex: form.noindex, autosave: Boolean(autosave),
        },
      });
      if (!autosave) await saveRelated({ data: { storeId, pageId: res.id, relatedIds: form.relatedIds } });
      return res;
    },
    onSuccess: (res, vars) => {
      setDirty(false);
      setLastSaved(new Date());
      setForm((f) => ({ ...f, slug: res.slug, status: res.status }));
      void qc.invalidateQueries({ queryKey: ["blog-posts", storeId] });
      if (!vars.autosave) toast.success(`Kaydedildi: ${BLOG_STATUSES[res.status as keyof typeof BLOG_STATUSES] ?? res.status}`);
      if (isNew) void navigate({ to: "/store/$storeId/blog-editor/$pageId", params: { storeId, pageId: res.id }, replace: true });
    },
    onError: (e, vars) => !vars.autosave && toast.error(e instanceof Error ? e.message : "Kaydedilemedi"),
  });

  // Otomatik kayıt: 30 saniyede bir, yalnız değişiklik varsa ve yazı taslaktaysa.
  useEffect(() => {
    if (!dirty || form.title.trim().length < 2) return;
    const t = setTimeout(() => {
      if (!mutation.isPending) mutation.mutate({ status: form.status === "published" ? "published" : form.status, autosave: true });
    }, 30_000);
    return () => clearTimeout(t);
  }, [dirty, form, mutation]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const revisions = useQuery({
    queryKey: ["blog-revisions", storeId, pageId],
    enabled: !isNew,
    queryFn: () => listRevs({ data: { storeId, pageId } }),
  });
  const restore = useMutation({
    mutationFn: (revisionId: string) => restoreRev({ data: { storeId, pageId, revisionId } }),
    onSuccess: () => {
      toast.success("Sürüm geri yüklendi");
      void post.refetch();
      void revisions.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Geri yüklenemedi"),
  });

  const uploadCover = async (file: File) => {
    setCoverBusy(true);
    try {
      const dataUrl = await resizeImage(file, 1600);
      const res = await upload({ data: { storeId, dataUrl, fileName: file.name } });
      set("coverUrl", res.url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kapak yüklenemedi");
    } finally {
      setCoverBusy(false);
    }
  };

  const submit = (status: string) => {
    if (form.title.trim().length < 2) return toast.error("Başlık en az 2 karakter olmalı");
    if (status === "scheduled" && !form.scheduledAt) return toast.error("Yayın tarihini seçin");
    mutation.mutate({ status });
  };

  const previewUrl = storeSlug && form.slug ? `/s/${storeSlug}/page/${form.slug}` : null;
  const scoreTone = seo.score >= 80 ? "text-success" : seo.score >= 50 ? "text-warning" : "text-destructive";

  if (!loaded) {
    return (
      <AppShell storeId={storeId} title="Blog yazısı">
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Yükleniyor…</p>
      </AppShell>
    );
  }

  return (
    <AppShell storeId={storeId} title={isNew ? "Yeni blog yazısı" : "Blog yazısını düzenle"}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/store/$storeId/blog-studio" params={{ storeId }}><ArrowLeft className="mr-1 size-4" /> Blog Stüdyosu</Link>
        </Button>
        <Badge variant="secondary">{BLOG_STATUSES[form.status as keyof typeof BLOG_STATUSES] ?? form.status}</Badge>
        <span className="text-xs text-muted-foreground">
          {mutation.isPending ? "Kaydediliyor…" : dirty ? "Kaydedilmemiş değişiklik var" : lastSaved ? `Son kayıt ${lastSaved.toLocaleTimeString("tr-TR")}` : ""}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button disabled={mutation.isPending} onClick={() => submit(form.status === "published" ? "published" : "draft")}>
            <Save className="mr-2 size-4" /> Kaydet
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Kaydetme seçenekleri"><ChevronDown className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => submit("draft")}>Taslak olarak kaydet</DropdownMenuItem>
              <DropdownMenuItem disabled={!previewUrl} onClick={() => previewUrl && window.open(previewUrl, "_blank", "noopener")}>Önizle</DropdownMenuItem>
              <DropdownMenuItem onClick={() => submit("review")}>İncelemeye gönder</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => submit("published")}>Şimdi yayınla</DropdownMenuItem>
              <DropdownMenuItem onClick={() => submit("scheduled")}>Zamanla (Ayarlar'daki tarih)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => submit("archived")}>Arşivle</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Tabs defaultValue="content" className="space-y-4">
        <TabsList>
          <TabsTrigger value="content">İçerik</TabsTrigger>
          <TabsTrigger value="seo">SEO <span className={cn("ml-1 font-semibold", scoreTone)}>{seo.score}</span></TabsTrigger>
          <TabsTrigger value="settings">Ayarlar</TabsTrigger>
          {!isNew ? <TabsTrigger value="history">Geçmiş</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <Input
            className="h-auto border-0 px-0 text-2xl font-bold shadow-none focus-visible:ring-0 sm:text-3xl"
            placeholder="Yazı başlığı"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
          <div className="surface-card space-y-2 p-4">
            <Label>Kapak görseli</Label>
            {form.coverUrl ? (
              <div className="relative">
                <img src={form.coverUrl} alt={form.coverAlt} className="aspect-[1200/630] w-full rounded-lg object-cover" />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => coverRef.current?.click()}>Değiştir</Button>
                  <Button size="sm" variant="ghost" onClick={() => set("coverUrl", "")}>Kaldır</Button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => coverRef.current?.click()} className="flex aspect-[1200/630] max-h-48 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-muted">
                {coverBusy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                Görsel yükle (önerilen 1200×630, en fazla 15 MB)
              </button>
            )}
            <Input placeholder="Kapak alt metni (SEO için)" value={form.coverAlt} onChange={(e) => set("coverAlt", e.target.value)} />
            <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadCover(f); }} />
          </div>
          <BlogEditor storeId={storeId} storeSlug={storeSlug} value={form.body} onChange={(html) => set("body", html)} />
          <p className="text-xs text-muted-foreground">{stats.words} kelime · yaklaşık {stats.minutes} dk okuma</p>
          <div className="space-y-2">
            <Label>Özet (boş bırakılırsa otomatik oluşur)</Label>
            <Textarea rows={3} maxLength={500} value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} />
          </div>
        </TabsContent>

        <TabsContent value="seo" className="grid gap-6 lg:grid-cols-5">
          <div className="surface-card space-y-4 p-5 lg:col-span-3">
            <Field label={`SEO başlığı (${(form.seoTitle || form.title).length}/60)`}>
              <Input value={form.seoTitle} placeholder={form.title} onChange={(e) => set("seoTitle", e.target.value)} />
            </Field>
            <Field label={`Meta açıklama (${form.seoDescription.length}/160)`}>
              <Textarea rows={3} value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} />
            </Field>
            <Field label="Adres (slug)"><Input value={form.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
            <Field label="Odak anahtar kelimeler (virgülle)"><Input value={form.seoKeywords} onChange={(e) => set("seoKeywords", e.target.value)} /></Field>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Google önizleme</p>
              <p className="truncate text-sm text-muted-foreground">mefticaret.com › s › {storeSlug} › page › {form.slug || "yazi"}</p>
              <p className="truncate text-lg text-primary">{form.seoTitle || form.title || "Başlık"}</p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{form.seoDescription || form.excerpt || "Açıklama girilmedi."}</p>
            </div>
            <Field label="Sosyal medya başlığı"><Input value={form.ogTitle} onChange={(e) => set("ogTitle", e.target.value)} /></Field>
            <Field label="Sosyal medya açıklaması"><Textarea rows={2} value={form.ogDescription} onChange={(e) => set("ogDescription", e.target.value)} /></Field>
            <Field label="Sosyal medya görseli (boşsa kapak)"><Input value={form.ogImageUrl} placeholder="https://" onChange={(e) => set("ogImageUrl", e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Schema türü">
                <Select value={form.schemaType} onValueChange={(v) => set("schemaType", v as Form["schemaType"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BLOG_SCHEMA_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Canonical adres"><Input value={form.canonicalUrl} placeholder="https://" onChange={(e) => set("canonicalUrl", e.target.value)} /></Field>
            </div>
            <label className="flex items-center justify-between gap-2 text-sm">Arama motorlarından gizle (noindex)<Switch checked={form.noindex} onCheckedChange={(v) => set("noindex", v)} /></label>
          </div>
          <div className="surface-card space-y-3 p-5 lg:col-span-2">
            <p className="text-sm font-medium">SEO skoru: <span className={cn("text-2xl font-bold", scoreTone)}>{seo.score}/100</span></p>
            <ul className="space-y-2 text-sm">
              {seo.checks.map((c) => (
                <li key={c.label} className="flex gap-2"><span className={c.ok ? "text-success" : "text-destructive"}>{c.ok ? "✓" : "✗"}</span>{c.label}</li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="surface-card grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Yazı türü">
            <Select value={form.postType} onValueChange={(v) => set("postType", v as Form["postType"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(BLOG_POST_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Kategori">
            <Select value={form.categoryId || "none"} onValueChange={(v) => set("categoryId", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Kategorisiz</SelectItem>
                {(categories.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Yazar">
            <Select value={form.authorId || "none"} onValueChange={(v) => set("authorId", v === "none" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Yazar yok</SelectItem>
                {(authors.data ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Yayın tarihi (zamanlama için)">
            <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Label>Etiketler</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(tags.data ?? []).map((t) => (
                <Button key={t.id} type="button" size="sm" variant={form.tagIds.includes(t.id) ? "default" : "outline"}
                  onClick={() => set("tagIds", form.tagIds.includes(t.id) ? form.tagIds.filter((x) => x !== t.id) : [...form.tagIds, t.id])}>
                  {t.name}
                </Button>
              ))}
              {!(tags.data ?? []).length ? <p className="text-xs text-muted-foreground">Etiketleri Blog & CMS sayfasından ekleyebilirsiniz.</p> : null}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>İlgili yazılar (en fazla 6; boşsa otomatik seçilir)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {(posts.data ?? []).filter((p) => p.id !== pageId).map((p) => (
                <Button key={p.id} type="button" size="sm" variant={form.relatedIds.includes(p.id) ? "default" : "outline"}
                  onClick={() => set("relatedIds", form.relatedIds.includes(p.id) ? form.relatedIds.filter((x) => x !== p.id) : [...form.relatedIds, p.id].slice(0, 6))}>
                  {p.title}
                </Button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-2 text-sm">Öne çıkan yazı<Switch checked={form.featured} onCheckedChange={(v) => set("featured", v)} /></label>
          <label className="flex items-center justify-between gap-2 text-sm">Yorumlara izin ver<Switch checked={form.allowComments} onCheckedChange={(v) => set("allowComments", v)} /></label>
        </TabsContent>

        {!isNew ? (
          <TabsContent value="history" className="space-y-2">
            {(revisions.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Henüz kayıtlı sürüm yok.</p> : null}
            {(revisions.data ?? []).map((r: any) => (
              <div key={r.id} className="surface-card flex flex-wrap items-center gap-3 p-3 text-sm">
                <History className="size-4 text-muted-foreground" />
                <span className="font-medium">Sürüm {r.revision_number}</span>
                <span className="text-muted-foreground">{formatDateTime(r.created_at)}</span>
                <span className="flex-1 truncate text-muted-foreground">{r.change_summary}</span>
                <Button size="sm" variant="outline" disabled={restore.isPending} onClick={() => confirm("Bu sürüm geri yüklensin mi? Mevcut içerik yeni sürüm olarak saklanır.") && restore.mutate(r.id)}>
                  Geri yükle
                </Button>
              </div>
            ))}
          </TabsContent>
        ) : null}
      </Tabs>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
