import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth-context";
import { deletePage, savePage } from "@/lib/pages.functions";
import { storePagesQuery } from "@/lib/pages-queries";
import { myStoresQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/pages")({
  head: () => ({
    meta: [
      { title: "İçerik Sayfaları — Mefticaret" },
      {
        name: "description",
        content: "Hakkımızda, iade koşulları, KVKK ve teslimat gibi vitrin içerik sayfalarını yönet.",
      },
      { property: "og:title", content: "İçerik Sayfaları — Mefticaret" },
      {
        property: "og:description",
        content: "Mefticaret vitrin CMS: içerik sayfaları, SEO açıklamaları ve alt menü yönetimi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PagesPage,
});

const EMPTY = {
  pageId: undefined as string | undefined,
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  seoDescription: "",
  isPublished: false,
  showInFooter: true,
  sortOrder: 0,
};

const TEMPLATES = [
  { title: "Hakkımızda", body: "Markamız hakkında kısa bir tanıtım yazısı." },
  { title: "İade ve Değişim", body: "Ürünlerinizi teslim tarihinden itibaren 14 gün içinde iade edebilirsiniz." },
  { title: "Teslimat Koşulları", body: "Siparişleriniz 1-3 iş günü içinde kargoya verilir." },
  { title: "Gizlilik ve KVKK", body: "Kişisel verileriniz yalnızca sipariş süreçleri için işlenir." },
];

function PagesPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: pages, isLoading } = useQuery(storePagesQuery(storeId));
  const { user } = useAuth();
  const { data: stores } = useQuery(myStoresQuery(user?.id));
  const storeSlug = (stores ?? []).find((s) => s.id === storeId)?.slug;

  const save = useServerFn(savePage);
  const remove = useServerFn(deletePage);
  const [form, setForm] = useState(EMPTY);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["store-pages", storeId] });

  const saveMutation = useMutation({
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
          isPublished: form.isPublished,
          showInFooter: form.showInFooter,
          sortOrder: form.sortOrder,
        },
      }),
    onSuccess: async () => {
      await invalidate();
      toast.success(form.pageId ? "Sayfa güncellendi" : "Sayfa oluşturuldu");
      setForm(EMPTY);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (pageId: string) => remove({ data: { storeId, pageId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Sayfa silindi");
      setForm(EMPTY);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      storeId={storeId}
      title="İçerik Sayfaları"
      description="Hakkımızda, iade, teslimat ve KVKK gibi vitrin sayfalarını oluştur, yayınla ve alt menüde göster."
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <form
          className="surface-card space-y-4 p-6 lg:col-span-2"
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{form.pageId ? "Sayfayı düzenle" : "Yeni sayfa"}</h2>
            {form.pageId ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setForm(EMPTY)}>
                Vazgeç
              </Button>
            ) : null}
          </div>

          {!form.pageId ? (
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
            <Label htmlFor="p-title">Başlık</Label>
            <Input
              id="p-title"
              required
              minLength={2}
              value={form.title}
              onChange={(event) => setForm((f) => ({ ...f, title: event.target.value }))}
              placeholder="Örn. İade ve Değişim"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-slug">Adres (opsiyonel)</Label>
            <Input
              id="p-slug"
              value={form.slug}
              onChange={(event) => setForm((f) => ({ ...f, slug: event.target.value }))}
              placeholder="iade-ve-degisim"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-excerpt">Kısa özet</Label>
            <Textarea
              id="p-excerpt"
              rows={2}
              value={form.excerpt}
              onChange={(event) => setForm((f) => ({ ...f, excerpt: event.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-body">İçerik</Label>
            <Textarea
              id="p-body"
              rows={10}
              value={form.body}
              onChange={(event) => setForm((f) => ({ ...f, body: event.target.value }))}
              placeholder="Sayfa metnini buraya yaz…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-seo">SEO açıklaması</Label>
            <Input
              id="p-seo"
              maxLength={300}
              value={form.seoDescription}
              onChange={(event) => setForm((f) => ({ ...f, seoDescription: event.target.value }))}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="p-published" className="text-sm">
                Yayında
              </Label>
              <Switch
                id="p-published"
                checked={form.isPublished}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, isPublished: checked }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor="p-footer" className="text-sm">
                Alt menüde
              </Label>
              <Switch
                id="p-footer"
                checked={form.showInFooter}
                onCheckedChange={(checked) => setForm((f) => ({ ...f, showInFooter: checked }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-sort">Sıra</Label>
            <Input
              id="p-sort"
              type="number"
              min={0}
              max={999}
              value={form.sortOrder}
              onChange={(event) => setForm((f) => ({ ...f, sortOrder: Number(event.target.value) || 0 }))}
            />
          </div>

          <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Kaydediliyor…" : form.pageId ? "Güncelle" : "Oluştur"}
          </Button>
        </form>

        <div className="lg:col-span-3">
          {isLoading ? (
            <p className="text-muted-foreground">Yükleniyor…</p>
          ) : (pages ?? []).length === 0 ? (
            <div className="surface-card p-10 text-center">
              <FileText className="mx-auto mb-3 size-6 text-muted-foreground" />
              <p className="font-medium">Henüz içerik sayfası yok</p>
              <p className="text-sm text-muted-foreground">
                Soldaki hazır şablonlardan biriyle hızlı başlayabilirsin.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {(pages ?? []).map((page) => (
                <li key={page.id} className="surface-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{page.title}</h3>
                        <Badge variant={page.is_published ? "default" : "secondary"}>
                          {page.is_published ? "Yayında" : "Taslak"}
                        </Badge>
                        {page.show_in_footer ? <Badge variant="outline">Alt menü</Badge> : null}
                      </div>
                      <p className="text-xs text-muted-foreground">/{page.slug}</p>
                      {page.excerpt ? (
                        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{page.excerpt}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {storeSlug && page.is_published ? (
                        <Button asChild variant="outline" size="sm" className="gap-1">
                          <a href={`/s/${storeSlug}/page/${page.slug}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-3.5" />
                            Görüntüle
                          </a>
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setForm({
                            pageId: page.id,
                            title: page.title,
                            slug: page.slug,
                            excerpt: page.excerpt ?? "",
                            body: page.body,
                            seoDescription: page.seo_description ?? "",
                            isPublished: page.is_published,
                            showInFooter: page.show_in_footer,
                            sortOrder: page.sort_order,
                          })
                        }
                      >
                        Düzenle
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(page.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
