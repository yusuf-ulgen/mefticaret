import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fetchPlatformSeoTargets, savePlatformSeoTarget } from "@/lib/platform-seo.functions";
import type { SeoTarget } from "@/lib/platform-seo.server";

/** Sayfa bazında meta başlık, açıklama, canonical ve index yönetimi. */

const KIND_LABEL: Record<SeoTarget["kind"], string> = {
  home: "Ana sayfa",
  page: "Platform sayfası",
  post: "Blog yazısı",
};

type Filter = "all" | "home" | "page" | "post";

export function PlatformSeoManager() {
  const fetchTargets = useServerFn(fetchPlatformSeoTargets);
  const saveTarget = useServerFn(savePlatformSeoTarget);
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<SeoTarget>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["platform-seo-targets"],
    queryFn: () => fetchTargets(),
  });

  const targets = useMemo(() => {
    const list = (data ?? []) as SeoTarget[];
    const term = search.trim().toLocaleLowerCase("tr");
    return list.filter(
      (t) =>
        (filter === "all" || t.kind === filter) &&
        (!term || t.label.toLocaleLowerCase("tr").includes(term) || t.url.includes(term)),
    );
  }, [data, filter, search]);

  const keyOf = (t: SeoTarget) => `${t.kind}:${t.id ?? "home"}`;
  const selected = (data as SeoTarget[] | undefined)?.find((t) => keyOf(t) === selectedKey) ?? null;

  const value = <K extends keyof SeoTarget>(field: K): SeoTarget[K] | undefined =>
    (draft[field] ?? selected?.[field]) as SeoTarget[K] | undefined;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      await saveTarget({
        data: {
          kind: selected.kind,
          id: selected.id,
          metaTitle: String(value("metaTitle") ?? ""),
          description: String(value("description") ?? ""),
          canonicalUrl: String(value("canonicalUrl") ?? ""),
          noindex: Boolean(value("noindex") ?? false),
        },
      });
    },
    onSuccess: async () => {
      toast.success("SEO etiketleri kaydedildi");
      setDraft({});
      await queryClient.invalidateQueries({ queryKey: ["platform-seo-targets"] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : "Kaydedilemedi"),
  });

  const titleLen = String(value("metaTitle") ?? "").length;
  const descLen = String(value("description") ?? "").length;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <Card className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "home", "page", "post"] as Filter[]).map((item) => (
            <Button
              key={item}
              size="sm"
              variant={filter === item ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setFilter(item)}
            >
              {item === "all" ? "Tümü" : KIND_LABEL[item]}
            </Button>
          ))}
        </div>
        <Input
          className="mt-3"
          placeholder="Sayfa veya adres ara…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="mt-3 divide-y">
          {isLoading ? (
            <p className="py-6 text-sm text-muted-foreground">Yükleniyor…</p>
          ) : targets.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">Kayıt bulunamadı.</p>
          ) : (
            targets.map((target) => {
              const key = keyOf(target);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedKey(key);
                    setDraft({});
                  }}
                  className={`w-full px-2 py-3 text-left transition ${
                    selectedKey === key ? "bg-muted" : "hover:bg-muted/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{target.label}</span>
                    {target.noindex ? (
                      <Badge variant="destructive">noindex</Badge>
                    ) : target.published ? (
                      <Badge variant="secondary">indexlenebilir</Badge>
                    ) : (
                      <Badge variant="outline">taslak</Badge>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{target.url}</p>
                </button>
              );
            })
          )}
        </div>
      </Card>

      <Card className="p-5">
        {!selected ? (
          <p className="text-sm text-muted-foreground">
            Düzenlemek için soldaki listeden bir sayfa seç. Alanları boş bırakırsan etiketler
            sayfanın kendi verisinden otomatik üretilir.
          </p>
        ) : (
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {KIND_LABEL[selected.kind]}
              </p>
              <h2 className="text-lg font-semibold">{selected.label}</h2>
              <a
                href={selected.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground underline"
              >
                {selected.url}
              </a>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seo-title">Meta başlık ({titleLen}/70)</Label>
              <Input
                id="seo-title"
                maxLength={70}
                placeholder={selected.effectiveTitle}
                value={String(value("metaTitle") ?? "")}
                onChange={(event) => setDraft((d) => ({ ...d, metaTitle: event.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seo-desc">Meta açıklama ({descLen}/160 önerilir)</Label>
              <Textarea
                id="seo-desc"
                rows={3}
                maxLength={320}
                placeholder={selected.effectiveDescription}
                value={String(value("description") ?? "")}
                onChange={(event) => setDraft((d) => ({ ...d, description: event.target.value }))}
              />
            </div>

            {selected.kind === "home" ? null : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="seo-canonical">Canonical adres</Label>
                  <Input
                    id="seo-canonical"
                    placeholder={selected.effectiveCanonical}
                    value={String(value("canonicalUrl") ?? "")}
                    onChange={(event) =>
                      setDraft((d) => ({ ...d, canonicalUrl: event.target.value }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Arama motorlarında gizle (noindex)</p>
                    <p className="text-xs text-muted-foreground">
                      Açıkken sayfa site haritasından çıkarılır ve noindex etiketi eklenir.
                    </p>
                  </div>
                  <Switch
                    checked={Boolean(value("noindex") ?? false)}
                    onCheckedChange={(checked) => setDraft((d) => ({ ...d, noindex: checked }))}
                  />
                </div>
              </>
            )}

            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Google önizlemesi
              </p>
              <p className="mt-1 text-xs text-emerald-700">{selected.url}</p>
              <p className="text-base text-blue-700">
                {String(value("metaTitle") || selected.effectiveTitle)}
              </p>
              <p className="text-sm text-muted-foreground">
                {String(value("description") || selected.effectiveDescription)}
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Kaydediliyor…" : "Kaydet"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDraft({})}>
                Değişiklikleri geri al
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
