import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownUp, ExternalLink, FileText, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/mefti";
import { deletePage, savePage } from "@/lib/pages.functions";
import { storePagesQuery } from "@/lib/pages-queries";

/**
 * Vitrin içerik sayfaları yöneticisi (liste öncelikli, Shopify benzeri düzen).
 * Hem satıcı panelinde hem süper yönetici panelinde kullanılır; yetki RLS +
 * server function ile korunur.
 */

const EMPTY = {
  pageId: undefined as string | undefined,
  title: "",
  slug: "",
  excerpt: "",
  body: "",
  seoDescription: "",
  isPublished: true,
  showInFooter: true,
  sortOrder: 0,
};

const TEMPLATES = [
  { title: "Hakkımızda", body: "Markamız hakkında kısa bir tanıtım yazısı." },
  { title: "İade ve Değişim", body: "Ürünlerinizi teslim tarihinden itibaren 14 gün içinde iade edebilirsiniz." },
  { title: "Teslimat Koşulları", body: "Siparişleriniz 1-3 iş günü içinde kargoya verilir." },
  { title: "Gizlilik Politikası", body: "Kişisel verileriniz yalnızca sipariş süreçleri için işlenir." },
  { title: "Sıkça Sorulan Sorular", body: "En çok sorulan soruların yanıtları." },
  { title: "Hizmet Şartları", body: "Üyelik ve hizmet kullanım koşulları." },
];

type Filter = "all" | "published" | "draft";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "published", label: "Görünür" },
  { key: "draft", label: "Taslak" },
];

export function PagesManager({ storeId, storeSlug }: { storeId: string; storeSlug?: string | undefined }) {
  const queryClient = useQueryClient();
  const { data: pages, isLoading } = useQuery(storePagesQuery(storeId));

  const save = useServerFn(savePage);
  const remove = useServerFn(deletePage);

  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [term, setTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [newestFirst, setNewestFirst] = useState(true);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["store-pages", storeId] });

  const rows = useMemo(() => {
    const needle = term.trim().toLocaleLowerCase("tr");
    const list = (pages ?? []).filter((page) => {
      if (filter === "published" && !page.is_published) return false;
      if (filter === "draft" && page.is_published) return false;
      if (!needle) return true;
      return `${page.title} ${page.slug}`.toLocaleLowerCase("tr").includes(needle);
    });
    return [...list].sort((a, b) => {
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return newestFirst ? diff : -diff;
    });
  }, [pages, filter, term, newestFirst]);

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
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (pageId: string) => remove({ data: { storeId, pageId } }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Sayfa silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="surface-card flex items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <FileText className="size-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Sayfalar</h2>
        </div>
        <Button
          className="gap-1"
          onClick={() => {
            setForm(EMPTY);
            setOpen(true);
          }}
        >
          <Plus className="size-4" />
          Sayfa ekle
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
                placeholder="Sayfa ara…"
                className="h-9 w-44"
                aria-label="Sayfa ara"
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
            <FileText className="mx-auto mb-3 size-6 text-muted-foreground" />
            <p className="font-medium">Sayfa bulunamadı</p>
            <p className="text-sm text-muted-foreground">
              “Sayfa ekle” ile hazır şablonlardan hızlıca başlayabilirsin.
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((page) => (
              <li key={page.id} className="flex items-start justify-between gap-3 p-4 hover:bg-muted/40">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
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
                    });
                    setOpen(true);
                  }}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{page.title}</span>
                    <Badge variant={page.is_published ? "default" : "secondary"}>
                      {page.is_published ? "Görünür" : "Taslak"}
                    </Badge>
                  </span>
                  <span className="mt-1 block truncate text-sm text-muted-foreground">
                    {page.excerpt || page.body || `/${page.slug}`}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {formatDateTime(page.created_at)}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  {storeSlug && page.is_published ? (
                    <Button asChild variant="ghost" size="icon" aria-label="Vitrinde görüntüle">
                      <a href={`/s/${storeSlug}/page/${page.slug}`} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Sayfayı sil"
                    className="text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(page.id)}
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
            <DialogTitle>{form.pageId ? "Sayfayı düzenle" : "Sayfa ekle"}</DialogTitle>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              saveMutation.mutate();
            }}
          >
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
              <Label htmlFor="p-body">İçerik</Label>
              <Textarea
                id="p-body"
                rows={10}
                value={form.body}
                onChange={(event) => setForm((f) => ({ ...f, body: event.target.value }))}
                placeholder="Sayfa metnini buraya yaz…"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <Label htmlFor="p-seo">SEO açıklaması</Label>
              <Input
                id="p-seo"
                maxLength={300}
                value={form.seoDescription}
                onChange={(event) => setForm((f) => ({ ...f, seoDescription: event.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="p-published" className="text-sm">
                  Görünür
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

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Vazgeç
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Kaydediliyor…" : form.pageId ? "Güncelle" : "Kaydet"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
