import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/mefti";
import {
  adminBlogDelete,
  adminBlogPosts,
  adminBlogSave,
  adminBlogStores,
} from "@/lib/admin-blog.functions";

const DESCRIPTION = "Platform genelinde blog yazılarını oluştur, düzenle, yayınla veya zamanla.";

export const Route = createFileRoute("/_authenticated/admin/blog")({
  head: () => ({
    meta: [
      { title: "Blog Yönetimi — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Blog Yönetimi — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: AdminBlogPage,
});

type StoreOption = { id: string; name: string; slug: string; status: string };

type PostRow = {
  id: string;
  store_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  seo_description: string | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  updated_at: string;
  author_name: string | null;
  cover_url: string | null;
  show_in_footer: boolean;
  sort_order: number;
  store_name: string | null;
  store_slug: string | null;
};

type Draft = {
  id?: string;
  storeId: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  seoDescription: string;
  authorName: string;
  coverUrl: string;
  status: "draft" | "published" | "scheduled";
  scheduledAt: string;
  showInFooter: boolean;
  sortOrder: number;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Taslak",
  published: "Yayında",
  scheduled: "Zamanlanmış",
};

function emptyDraft(storeId: string): Draft {
  return {
    storeId,
    title: "",
    slug: "",
    excerpt: "",
    body: "",
    seoDescription: "",
    authorName: "",
    coverUrl: "",
    status: "draft",
    scheduledAt: "",
    showInFooter: false,
    sortOrder: 0,
  };
}

function toDraft(row: PostRow): Draft {
  return {
    id: row.id,
    storeId: row.store_id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt ?? "",
    body: row.body ?? "",
    seoDescription: row.seo_description ?? "",
    authorName: row.author_name ?? "",
    coverUrl: row.cover_url ?? "",
    status: (["draft", "published", "scheduled"].includes(row.status) ? row.status : "draft") as Draft["status"],
    scheduledAt: row.scheduled_at ? row.scheduled_at.slice(0, 16) : "",
    showInFooter: row.show_in_footer,
    sortOrder: row.sort_order,
  };
}

function AdminBlogPage() {
  const { isPlatformAdmin } = useAuth();
  const client = useQueryClient();
  const [storeFilter, setStoreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "published" | "scheduled">("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const stores = useQuery({
    queryKey: ["admin-blog-stores"],
    enabled: isPlatformAdmin,
    queryFn: async () => (await adminBlogStores()) as unknown as StoreOption[],
  });

  const posts = useQuery({
    queryKey: ["admin-blog-posts", storeFilter, statusFilter, search],
    enabled: isPlatformAdmin,
    queryFn: async () =>
      (await adminBlogPosts({
        data: {
          storeId: storeFilter || undefined,
          status: statusFilter,
          search: search.trim() || undefined,
        },
      })) as unknown as PostRow[],
  });

  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ["admin-blog-posts"] });
  };

  const save = useMutation({
    mutationFn: async (value: Draft) =>
      adminBlogSave({
        data: {
          id: value.id,
          storeId: value.storeId,
          title: value.title,
          slug: value.slug || undefined,
          excerpt: value.excerpt || undefined,
          body: value.body,
          seoDescription: value.seoDescription || undefined,
          authorName: value.authorName || undefined,
          coverUrl: value.coverUrl || undefined,
          status: value.status,
          scheduledAt: value.scheduledAt ? new Date(value.scheduledAt).toISOString() : undefined,
          showInFooter: value.showInFooter,
          sortOrder: value.sortOrder,
        },
      }),
    onSuccess: () => {
      toast.success("Yazı kaydedildi");
      setDraft(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => adminBlogDelete({ data: { id } }),
    onSuccess: () => {
      toast.success("Yazı silindi");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const storeOptions = useMemo(() => stores.data ?? [], [stores.data]);
  const rows = posts.data ?? [];

  const startNew = () => {
    const first = storeFilter || storeOptions[0]?.id;
    if (!first) {
      toast.error("Önce bir mağaza oluşturmalısın");
      return;
    }
    setDraft(emptyDraft(first));
  };

  return (
    <AdminShell
      title="Blog Yönetimi"
      description={DESCRIPTION}
      actions={
        <Button size="sm" onClick={startNew}>
          <Plus className="mr-1.5 size-4" /> Yeni yazı
        </Button>
      }
    >
      {!isPlatformAdmin ? (
        <p className="text-sm text-muted-foreground">Bu alan yalnızca platform yöneticileri içindir.</p>
      ) : (
        <div className="space-y-4">
          <div className="surface-card grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Mağaza</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={storeFilter}
                onChange={(event) => setStoreFilter(event.target.value)}
              >
                <option value="">Tüm mağazalar</option>
                {storeOptions.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Durum</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              >
                <option value="all">Tümü</option>
                <option value="draft">Taslak</option>
                <option value="published">Yayında</option>
                <option value="scheduled">Zamanlanmış</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Ara</Label>
              <Input
                className="mt-1"
                placeholder="Başlık veya adres"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          {draft ? (
            <section className="surface-card space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-base font-semibold">
                  {draft.id ? "Yazıyı düzenle" : "Yeni yazı"}
                </p>
                <div className="ml-auto flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
                    <X className="mr-1.5 size-4" /> Kapat
                  </Button>
                  <Button
                    size="sm"
                    disabled={save.isPending || draft.title.trim().length < 2}
                    onClick={() => save.mutate(draft)}
                  >
                    <Save className="mr-1.5 size-4" /> Kaydet
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label className="text-xs">Mağaza</Label>
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={draft.storeId}
                    onChange={(event) => setDraft({ ...draft, storeId: event.target.value })}
                  >
                    {storeOptions.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Durum</Label>
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={draft.status}
                    onChange={(event) =>
                      setDraft({ ...draft, status: event.target.value as Draft["status"] })
                    }
                  >
                    <option value="draft">Taslak</option>
                    <option value="published">Yayında</option>
                    <option value="scheduled">Zamanlanmış</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Başlık</Label>
                  <Input
                    className="mt-1"
                    value={draft.title}
                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Adres (boş bırakılırsa başlıktan üretilir)</Label>
                  <Input
                    className="mt-1"
                    value={draft.slug}
                    onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Yazar</Label>
                  <Input
                    className="mt-1"
                    value={draft.authorName}
                    onChange={(event) => setDraft({ ...draft, authorName: event.target.value })}
                  />
                </div>
                {draft.status === "scheduled" ? (
                  <div>
                    <Label className="text-xs">Yayın zamanı</Label>
                    <Input
                      type="datetime-local"
                      className="mt-1"
                      value={draft.scheduledAt}
                      onChange={(event) => setDraft({ ...draft, scheduledAt: event.target.value })}
                    />
                  </div>
                ) : null}
                <div>
                  <Label className="text-xs">Kapak görseli adresi</Label>
                  <Input
                    className="mt-1"
                    value={draft.coverUrl}
                    onChange={(event) => setDraft({ ...draft, coverUrl: event.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Özet</Label>
                  <Textarea
                    className="mt-1"
                    rows={2}
                    value={draft.excerpt}
                    onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">İçerik</Label>
                  <Textarea
                    className="mt-1"
                    rows={12}
                    value={draft.body}
                    onChange={(event) => setDraft({ ...draft, body: event.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">SEO açıklaması</Label>
                  <Textarea
                    className="mt-1"
                    rows={2}
                    value={draft.seoDescription}
                    onChange={(event) => setDraft({ ...draft, seoDescription: event.target.value })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={draft.showInFooter}
                    aria-label="Alt bilgide göster"
                    onCheckedChange={(checked) => setDraft({ ...draft, showInFooter: checked })}
                  />
                  <span className="text-sm">Alt bilgide göster</span>
                </div>
                <div>
                  <Label className="text-xs">Sıra</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={draft.sortOrder}
                    onChange={(event) =>
                      setDraft({ ...draft, sortOrder: Number(event.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </section>
          ) : null}

          <section className="surface-card overflow-hidden">
            {posts.isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Yazılar yükleniyor…</p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Kayıt bulunamadı. “Yeni yazı” ile ilk blog yazını oluştur.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((row) => (
                  <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{row.title}</p>
                        <Badge variant="secondary">{STATUS_LABEL[row.status] ?? row.status}</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {row.store_name ?? "—"} · /{row.slug} ·{" "}
                        {row.published_at
                          ? `Yayın: ${formatDateTime(row.published_at)}`
                          : row.scheduled_at
                            ? `Planlı: ${formatDateTime(row.scheduled_at)}`
                            : `Güncelleme: ${formatDateTime(row.updated_at)}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {row.store_slug ? (
                        <Button variant="ghost" size="icon" aria-label="Vitrinde aç" asChild>
                          <a
                            href={`/s/${row.store_slug}/page/${row.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        </Button>
                      ) : null}
                      <Button variant="outline" size="sm" onClick={() => setDraft(toDraft(row))}>
                        Düzenle
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Yazıyı sil"
                        onClick={() => {
                          if (window.confirm(`“${row.title}” silinsin mi?`)) remove.mutate(row.id);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AdminShell>
  );
}
