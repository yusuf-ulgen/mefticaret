import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Copy, LayoutGrid, List, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { BLOG_STATUSES } from "@/lib/blog-content";
import { blogCategoriesQuery, blogPostsQuery } from "@/lib/blog-queries";
import {
  duplicateBlogPost,
  getBlogSettings,
  listBlogComments,
  moderateBlogComments,
  saveBlogSettings,
  setBlogPostStatus,
} from "@/lib/blog-v2.functions";
import { formatDateTime } from "@/lib/mefti";
import { storeQuery } from "@/lib/store-queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/blog-studio")({
  head: () => ({ meta: [{ title: "Blog Stüdyosu — Mefticaret" }, { name: "robots", content: "noindex" }] }),
  component: BlogStudio,
});

const statusLabel = (s: string) => BLOG_STATUSES[s as keyof typeof BLOG_STATUSES] ?? s;

function BlogStudio() {
  const { storeId } = Route.useParams();
  return (
    <AppShell storeId={storeId} title="Blog Stüdyosu" description="Zengin düzenleyici, yorumlar, yayın takvimi ve blog ayarları.">
      <Tabs defaultValue="posts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="posts">Yazılar</TabsTrigger>
          <TabsTrigger value="comments">Yorumlar</TabsTrigger>
          <TabsTrigger value="calendar">Takvim</TabsTrigger>
          <TabsTrigger value="settings">Ayarlar</TabsTrigger>
        </TabsList>
        <TabsContent value="posts"><PostsTab storeId={storeId} /></TabsContent>
        <TabsContent value="comments"><CommentsTab storeId={storeId} /></TabsContent>
        <TabsContent value="calendar"><CalendarTab storeId={storeId} /></TabsContent>
        <TabsContent value="settings"><SettingsTab storeId={storeId} /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

function PostsTab({ storeId }: { storeId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const posts = useQuery(blogPostsQuery(storeId));
  const categories = useQuery(blogCategoriesQuery(storeId));
  const store = useQuery(storeQuery(storeId));
  const setStatus = useServerFn(setBlogPostStatus);
  const duplicate = useServerFn(duplicateBlogPost);
  const [q, setQ] = useState("");
  const [status, setStatusFilter] = useState("all");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<string[]>([]);

  const rows = useMemo(
    () =>
      (posts.data ?? []).filter(
        (p) =>
          (status === "all" || p.status === status) &&
          (category === "all" || p.category_id === category) &&
          (!q || p.title.toLocaleLowerCase("tr").includes(q.toLocaleLowerCase("tr"))),
      ),
    [posts.data, status, category, q],
  );

  const bulk = useMutation({
    mutationFn: async (next: "draft" | "published" | "archived") => {
      for (const id of selected) await setStatus({ data: { storeId, pageId: id, status: next } });
    },
    onSuccess: () => {
      toast.success(`${selected.length} yazı güncellendi`);
      setSelected([]);
      void qc.invalidateQueries({ queryKey: ["blog-posts", storeId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "İşlem başarısız"),
  });
  const dup = useMutation({
    mutationFn: (pageId: string) => duplicate({ data: { storeId, pageId } }),
    onSuccess: (res) => navigate({ to: "/store/$storeId/blog-editor/$pageId", params: { storeId, pageId: res.id } }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kopyalanamadı"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="max-w-xs" placeholder="Başlıkta ara" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            {Object.entries(BLOG_STATUSES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm kategoriler</SelectItem>
            {(categories.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" aria-label="Görünüm" onClick={() => setView(view === "list" ? "grid" : "list")}>
          {view === "list" ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
        </Button>
        <Button className="ml-auto" asChild>
          <Link to="/store/$storeId/blog-editor/$pageId" params={{ storeId, pageId: "new" }}><Plus className="mr-1 size-4" /> Yeni yazı</Link>
        </Button>
      </div>

      {selected.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2 text-sm">
          <span>{selected.length} seçili</span>
          <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => bulk.mutate("published")}>Yayınla</Button>
          <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => bulk.mutate("draft")}>Taslağa al</Button>
          <Button size="sm" variant="outline" disabled={bulk.isPending} onClick={() => bulk.mutate("archived")}>Arşivle</Button>
        </div>
      ) : null}

      {posts.isLoading ? <p className="text-sm text-muted-foreground">Yükleniyor…</p> : null}
      {!posts.isLoading && !rows.length ? <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Yazı bulunamadı.</div> : null}

      <div className={cn(view === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-2")}>
        {rows.map((p) => (
          <div key={p.id} className={cn("surface-card flex gap-3 p-3", view === "grid" && "flex-col")}>
            <Checkbox
              checked={selected.includes(p.id)}
              onCheckedChange={(v) => setSelected((s) => (v ? [...s, p.id] : s.filter((x) => x !== p.id)))}
              aria-label="Seç"
            />
            {p.cover_url ? <img src={p.cover_url} alt="" className={cn("rounded-md object-cover", view === "grid" ? "aspect-[1200/630] w-full" : "size-14")} /> : null}
            <div className="min-w-0 flex-1">
              <p className="break-words font-medium">{p.title}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(p.published_at ?? p.updated_at)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Badge variant={p.status === "published" ? "default" : "secondary"}>{statusLabel(p.status)}</Badge>
              <Button size="sm" variant="outline" asChild>
                <Link to="/store/$storeId/blog-editor/$pageId" params={{ storeId, pageId: p.id }}>Düzenle</Link>
              </Button>
              <Button size="icon" variant="ghost" aria-label="Kopyala" onClick={() => dup.mutate(p.id)}><Copy className="size-4" /></Button>
              {store.data?.slug && p.status === "published" ? (
                <Button size="sm" variant="ghost" asChild><a href={`/s/${store.data.slug}/page/${p.slug}`} target="_blank" rel="noreferrer noopener">Görüntüle</a></Button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentsTab({ storeId }: { storeId: string }) {
  const [status, setStatus] = useState<"pending" | "approved" | "spam" | "all">("pending");
  const list = useServerFn(listBlogComments);
  const moderate = useServerFn(moderateBlogComments);
  const comments = useQuery({ queryKey: ["blog-comments", storeId, status], queryFn: () => list({ data: { storeId, status } }) });
  const [selected, setSelected] = useState<string[]>([]);
  const act = useMutation({
    mutationFn: ({ ids, next }: { ids: string[]; next: "approved" | "spam" | "deleted" | "pending" }) => moderate({ data: { storeId, ids, status: next } }),
    onSuccess: () => {
      setSelected([]);
      void comments.refetch();
      toast.success("Yorumlar güncellendi");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "İşlem başarısız"),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["pending", "approved", "spam", "all"] as const).map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => { setStatus(s); setSelected([]); }}>
            {{ pending: "Onay bekleyen", approved: "Onaylı", spam: "Spam", all: "Tümü" }[s]}
          </Button>
        ))}
        {selected.length ? (
          <div className="ml-auto flex gap-1">
            <Button size="sm" onClick={() => act.mutate({ ids: selected, next: "approved" })}>Onayla ({selected.length})</Button>
            <Button size="sm" variant="outline" onClick={() => act.mutate({ ids: selected, next: "spam" })}>Spam</Button>
            <Button size="sm" variant="ghost" onClick={() => act.mutate({ ids: selected, next: "deleted" })}>Sil</Button>
          </div>
        ) : null}
      </div>
      {comments.isLoading ? <p className="text-sm text-muted-foreground">Yükleniyor…</p> : null}
      {!comments.isLoading && !(comments.data ?? []).length ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Bu listede yorum yok.</p> : null}
      {(comments.data ?? []).map((c) => (
        <div key={c.id} className="surface-card flex gap-3 p-3 text-sm">
          <Checkbox checked={selected.includes(c.id)} onCheckedChange={(v) => setSelected((s) => (v ? [...s, c.id] : s.filter((x) => x !== c.id)))} aria-label="Seç" />
          <div className="min-w-0 flex-1 space-y-1">
            <p><span className="font-medium">{c.author_name}</span> <span className="text-muted-foreground">· {c.author_email} · {formatDateTime(c.created_at)}</span></p>
            <p className="text-xs text-muted-foreground">Yazı: {c.postTitle}</p>
            <p className="whitespace-pre-wrap break-words">{c.content}</p>
          </div>
          <div className="flex flex-col gap-1">
            {c.status !== "approved" ? <Button size="sm" onClick={() => act.mutate({ ids: [c.id], next: "approved" })}>Onayla</Button> : null}
            {c.status !== "spam" ? <Button size="sm" variant="outline" onClick={() => act.mutate({ ids: [c.id], next: "spam" })}>Spam</Button> : null}
            <Button size="sm" variant="ghost" onClick={() => act.mutate({ ids: [c.id], next: "deleted" })}>Sil</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarTab({ storeId }: { storeId: string }) {
  const posts = useQuery(blogPostsQuery(storeId));
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const days = useMemo(() => {
    const start = new Date(month);
    start.setDate(1 - ((start.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);
  const byDay = useMemo(() => {
    const map = new Map<string, typeof posts.data>();
    for (const p of posts.data ?? []) {
      const date = p.status === "scheduled" ? p.scheduled_at : p.published_at;
      if (!date) continue;
      const key = new Date(date).toDateString();
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [posts.data]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="icon" variant="outline" aria-label="Önceki ay" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="size-4" /></Button>
        <p className="min-w-40 text-center font-medium">{month.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })}</p>
        <Button size="icon" variant="outline" aria-label="Sonraki ay" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="size-4" /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => <div key={d} className="p-1 text-center font-medium text-muted-foreground">{d}</div>)}
        {days.map((d) => (
          <div key={d.toISOString()} className={cn("min-h-20 rounded-md border p-1", d.getMonth() !== month.getMonth() && "opacity-40")}>
            <p className="text-muted-foreground">{d.getDate()}</p>
            {(byDay.get(d.toDateString()) ?? []).map((p) => (
              <Link key={p.id} to="/store/$storeId/blog-editor/$pageId" params={{ storeId, pageId: p.id }}
                className={cn("mt-0.5 block truncate rounded px-1", p.status === "scheduled" ? "bg-primary/10 text-primary" : "bg-muted")}>
                {p.title}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Mor: zamanlanmış · Gri: yayınlanmış. Zamanı gelen yazılar otomatik yayına alınır.</p>
    </div>
  );
}

function SettingsTab({ storeId }: { storeId: string }) {
  const get = useServerFn(getBlogSettings);
  const save = useServerFn(saveBlogSettings);
  const settings = useQuery({ queryKey: ["blog-settings", storeId], queryFn: () => get({ data: { storeId } }) });
  const [draft, setDraft] = useState<NonNullable<typeof settings.data> | null>(null);
  const s = draft ?? settings.data;
  const mutation = useMutation({
    mutationFn: () => save({ data: { storeId, ...s! } }),
    onSuccess: () => toast.success("Blog ayarları kaydedildi"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Kaydedilemedi"),
  });
  if (!s) return <p className="text-sm text-muted-foreground">Yükleniyor…</p>;
  const upd = (patch: Partial<typeof s>) => setDraft({ ...s, ...patch });

  return (
    <div className="surface-card grid max-w-2xl gap-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Liste düzeni</Label>
          <Select value={s.layout} onValueChange={(v) => upd({ layout: v as typeof s.layout })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="list">Liste</SelectItem><SelectItem value="grid">Izgara</SelectItem><SelectItem value="magazine">Dergi</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Sayfa başına yazı</Label>
          <Input type="number" min={3} max={48} value={s.postsPerPage} onChange={(e) => upd({ postsPerPage: Math.min(48, Math.max(3, Number(e.target.value) || 12)) })} />
        </div>
      </div>
      {([["showAuthor", "Yazarı göster"], ["showDate", "Tarihi göster"], ["showTags", "Etiketleri göster"], ["showComments", "Yorumları göster"], ["moderationRequired", "Yorumlar onaydan sonra yayınlansın"]] as const).map(([k, label]) => (
        <label key={k} className="flex items-center justify-between text-sm">{label}<Switch checked={Boolean(s[k])} onCheckedChange={(v) => upd({ [k]: v } as Partial<typeof s>)} /></label>
      ))}
      <div className="space-y-2">
        <Label>Kimler yorum yapabilir</Label>
        <Select value={s.allowComments} onValueChange={(v) => upd({ allowComments: v as typeof s.allowComments })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">Herkes</SelectItem><SelectItem value="registered">Yalnız üyeler</SelectItem><SelectItem value="none">Kimse (kapalı)</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Yasaklı kelimeler (virgülle; içeren yorum spam'e düşer)</Label>
        <Textarea rows={2} value={s.bannedWords.join(", ")} onChange={(e) => upd({ bannedWords: e.target.value.split(",").map((w) => w.trim()).filter((w) => w.length >= 2).slice(0, 100) })} />
      </div>
      <Button className="justify-self-start" disabled={mutation.isPending} onClick={() => mutation.mutate()}>Kaydet</Button>
    </div>
  );
}
