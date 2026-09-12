import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Search, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { seoEntitiesQuery, type SeoEntity } from "@/lib/seo-entities-queries";
import { applySeoTemplates } from "@/lib/seo.functions";
import { seoTemplateLabels, type SeoTemplateKey } from "@/components/seo/seo-shared";
import type { StoreSeoSettings } from "@/lib/seo";

const KIND_LABELS: Record<SeoEntity["kind"], string> = {
  product: "Ürün",
  collection: "Kategori / Koleksiyon",
  page: "Sayfa",
  blog: "Blog yazısı",
};

const URL_PREFIX: Record<SeoEntity["kind"], string> = {
  product: "p",
  collection: "c",
  page: "page",
  blog: "page",
};

/**
 * İçerik SEO durumu: hangi ürün/kategori/sayfanın başlık ve açıklaması eksik,
 * ve mağaza şablonlarıyla eksikleri toplu tamamlama.
 */
export function SeoContentTab({
  storeId,
  storeSlug,
  settings,
}: {
  storeId: string;
  storeSlug: string;
  settings: StoreSeoSettings;
}) {
  const queryClient = useQueryClient();
  const { data: entities, isLoading } = useQuery(seoEntitiesQuery(storeId));
  const [kind, setKind] = useState<"all" | SeoEntity["kind"]>("all");
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [term, setTerm] = useState("");
  const [overwrite, setOverwrite] = useState(false);

  const rows = entities ?? [];

  const stats = useMemo(() => {
    const groups: Record<SeoEntity["kind"], { total: number; missing: number }> = {
      product: { total: 0, missing: 0 },
      collection: { total: 0, missing: 0 },
      page: { total: 0, missing: 0 },
      blog: { total: 0, missing: 0 },
    };
    for (const row of rows) {
      const group = groups[row.kind];
      group.total += 1;
      if (!row.seo.title || !row.seo.description) group.missing += 1;
    }
    return groups;
  }, [rows]);

  const filtered = useMemo(() => {
    const search = term.trim().toLocaleLowerCase("tr");
    return rows
      .filter((row) => (kind === "all" ? true : row.kind === kind))
      .filter((row) => (onlyMissing ? !row.seo.title || !row.seo.description : true))
      .filter((row) =>
        search ? `${row.title} ${row.slug}`.toLocaleLowerCase("tr").includes(search) : true,
      )
      .slice(0, 200);
  }, [rows, kind, onlyMissing, term]);

  const apply = useServerFn(applySeoTemplates);
  const mutation = useMutation({
    mutationFn: async (kinds: SeoTemplateKey[]) =>
      apply({ data: { storeId, kinds, overwrite } }),
    onSuccess: (result) => {
      toast.success(`${result.updated} içerik güncellendi, ${result.skipped} içerik atlandı.`);
      void queryClient.invalidateQueries({ queryKey: ["seo-entities", storeId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const templateKeys = Object.keys(settings.templates ?? {}) as SeoTemplateKey[];
  const selectedKinds: SeoTemplateKey[] =
    kind === "all" ? ["product", "collection", "page", "blog"] : [kind];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(Object.keys(stats) as SeoEntity["kind"][]).map((key) => (
          <div key={key} className="surface-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{KIND_LABELS[key]}</p>
            <p className="mt-1 text-3xl font-semibold">{stats[key].total}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {stats[key].missing > 0 ? `${stats[key].missing} içerikte meta eksik` : "Tüm metalar tam"}
            </p>
          </div>
        ))}
      </div>

      <div className="surface-card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Şablondan otomatik doldur</h2>
            <p className="text-xs text-muted-foreground">
              Meta şablonları sekmesinde tanımlı başlık ve açıklama kalıpları, eksik içeriklere uygulanır.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="seo-overwrite" checked={overwrite} onCheckedChange={setOverwrite} />
              <Label htmlFor="seo-overwrite" className="text-xs">
                Mevcut metaları da yenile
              </Label>
            </div>
            <Button
              onClick={() => mutation.mutate(selectedKinds)}
              disabled={mutation.isPending || templateKeys.length === 0}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              {mutation.isPending ? "Uygulanıyor…" : "Şablonu uygula"}
            </Button>
          </div>
        </div>
        {templateKeys.length === 0 ? (
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
            Henüz meta şablonu tanımlanmadı. "Meta şablonları" sekmesinden ürün, kategori, sayfa ve blog
            kalıplarını kaydedin.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {templateKeys.map((key) => (
              <Badge key={key} variant="secondary" className="gap-1">
                <Sparkles className="h-3 w-3" />
                {seoTemplateLabels[key] ?? key}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="surface-card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="İçerik veya URL ara"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
            />
          </div>
          <Select value={kind} onValueChange={(value) => setKind(value as typeof kind)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm içerikler</SelectItem>
              <SelectItem value="product">Ürünler</SelectItem>
              <SelectItem value="collection">Kategoriler</SelectItem>
              <SelectItem value="page">Sayfalar</SelectItem>
              <SelectItem value="blog">Blog yazıları</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch id="seo-only-missing" checked={onlyMissing} onCheckedChange={setOnlyMissing} />
            <Label htmlFor="seo-only-missing" className="text-xs">
              Sadece eksikler
            </Label>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">İçerikler yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu filtreye uyan içerik yok.</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {filtered.map((row) => {
              const complete = Boolean(row.seo.title && row.seo.description);
              return (
                <div
                  key={`${row.kind}-${row.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {KIND_LABELS[row.kind]} · /s/{storeSlug}/{URL_PREFIX[row.kind]}/{row.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.seo.noindex ? <Badge variant="outline">noindex</Badge> : null}
                    <Badge variant={complete ? "secondary" : "outline"}>
                      {complete ? "SEO tam" : !row.seo.title ? "Başlık eksik" : "Açıklama eksik"}
                    </Badge>
                    <Button asChild size="sm" variant="ghost">
                      <a
                        href={`/s/${storeSlug}/${URL_PREFIX[row.kind]}/${row.slug}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Tek tek düzenlemek için SEO Editörü sayfasını kullanabilirsiniz.
        </p>
      </div>
    </div>
  );
}
