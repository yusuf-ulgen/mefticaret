import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { readSeo, type SeoFields } from "@/lib/seo";
import { saveEntitySeo } from "@/lib/seo.functions";

/**
 * Mağaza sayfalarının (Hakkımızda, İletişim, blog sayfaları vb.) başlık,
 * açıklama, canonical ve indexleme ayarlarını yönetir. Kayıt sunucu tarafında
 * doğrulanır; RLS tenant izolasyonunu zorlar.
 */

type StorePageRow = {
  id: string;
  title: string;
  slug: string;
  status?: string | null;
  is_published?: boolean | null;
  seo_description?: string | null;
  seo?: unknown;
};

export function StorePagesSeoTab({
  storeId,
  storeSlug,
  pages,
  origin,
}: {
  storeId: string;
  storeSlug: string;
  pages: StorePageRow[];
  origin: string;
}) {
  const client = useQueryClient();
  const save = useServerFn(saveEntitySeo);
  const [selectedId, setSelectedId] = useState<string | null>(pages[0]?.id ?? null);
  const [draft, setDraft] = useState<SeoFields | null>(null);

  const selected = useMemo(
    () => pages.find((page) => page.id === selectedId) ?? pages[0] ?? null,
    [pages, selectedId],
  );

  const stored = readSeo(selected?.seo);
  const fallbackDescription = selected?.seo_description ?? "";
  const current: SeoFields =
    draft ??
    (stored.description || !fallbackDescription
      ? stored
      : { ...stored, description: fallbackDescription });

  const pageUrl = selected ? `${origin}/s/${storeSlug}/page/${selected.slug}` : "";

  const mutation = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("Sayfa seçilmedi");
      return save({
        data: {
          storeId,
          entity: "page" as const,
          id: selected.id,
          seo: {
            title: current.title || undefined,
            description: current.description || undefined,
            keywords: current.keywords || undefined,
            canonical: current.canonical || pageUrl,
            ogImage: current.ogImage || undefined,
            noindex: current.noindex ?? false,
          },
        },
      });
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["store-pages", storeId] });
      setDraft(null);
      toast.success("Sayfa SEO ayarları kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const update = (patch: Partial<SeoFields>) => setDraft({ ...current, ...patch });

  if (pages.length === 0) {
    return (
      <div className="surface-card p-10 text-center">
        <FileText className="mx-auto mb-3 size-6 text-muted-foreground" />
        <p className="font-medium">Henüz sayfa yok</p>
        <p className="text-sm text-muted-foreground">
          Sayfalar bölümünden içerik sayfası ekledikten sonra SEO etiketlerini buradan
          düzenleyebilirsin.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_1fr]">
      <div className="surface-card overflow-hidden">
        <p className="border-b p-3 text-sm font-semibold">Sayfalar</p>
        <ul className="max-h-[520px] divide-y overflow-auto">
          {pages.map((page) => {
            const seo = readSeo(page.seo);
            const missing = !seo.title || !(seo.description || page.seo_description);
            return (
              <li key={page.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(page.id);
                    setDraft(null);
                  }}
                  className={`flex w-full items-start justify-between gap-2 p-3 text-left text-sm hover:bg-muted/50 ${
                    selected?.id === page.id ? "bg-muted/60" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{page.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      /{page.slug}
                    </span>
                  </span>
                  {missing ? (
                    <Badge variant="secondary" className="shrink-0">
                      Eksik
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0">
                      Tam
                    </Badge>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {selected ? (
        <div className="surface-card space-y-4 p-5">
          <div>
            <h3 className="text-lg font-semibold">{selected.title}</h3>
            <p className="text-sm text-muted-foreground">{pageUrl}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sp-title">Meta başlık</Label>
            <Input
              id="sp-title"
              value={current.title ?? ""}
              maxLength={120}
              onChange={(event) => update({ title: event.target.value })}
              placeholder={`${selected.title} — ${storeSlug}`}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sp-desc">Meta açıklama</Label>
            <Textarea
              id="sp-desc"
              rows={3}
              maxLength={400}
              value={current.description ?? ""}
              onChange={(event) => update({ description: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sp-canonical">Canonical URL</Label>
            <Input
              id="sp-canonical"
              value={current.canonical ?? ""}
              onChange={(event) => update({ canonical: event.target.value })}
              placeholder={pageUrl}
            />
            <p className="text-xs text-muted-foreground">
              Boş bırakırsan sayfanın kendi adresi kullanılır.
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Google'da gösterilmesin (noindex)</p>
              <p className="text-xs text-muted-foreground">
                Yalnızca gizli kalması gereken sayfalarda aç.
              </p>
            </div>
            <Switch
              checked={current.noindex ?? false}
              onCheckedChange={(value) => update({ noindex: value })}
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs uppercase text-muted-foreground">Google önizleme</p>
            <p className="mt-1 truncate text-sm text-primary">
              {current.title || selected.title}
            </p>
            <p className="truncate text-xs text-emerald-700">{current.canonical || pageUrl}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {current.description || selected.seo_description || "Açıklama eklenmedi."}
            </p>
          </div>

          <Button
            className="gap-2"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <Save className="size-4" />
            {mutation.isPending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
