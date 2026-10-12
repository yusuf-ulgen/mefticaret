import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  Download,
  Globe,
  Languages,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/mefti";
import { LANGUAGE_CATALOG, languageFlag, languageNative } from "@/lib/languages";
import {
  BRAND_VOICES,
  BRAND_VOICE_LABELS,
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  QUALITY_LABELS,
  STATUS_LABELS,
  SWITCHER_STYLES,
  SWITCHER_STYLE_LABELS,
  TRANSLATION_STATUSES,
  checkTranslation,
  computeProgress,
  type ContentType,
} from "@/lib/translation";
import {
  glossaryQuery,
  storeLocalesQuery,
  translationEntriesQuery,
  translationJobsQuery,
  translationProgressQuery,
  translationSettingsQuery,
  translationUsageQuery,
} from "@/lib/translation-queries";
import {
  advanceTranslationJob,
  deleteGlossaryTerm,
  deleteStoreLocale,
  exportTranslations,
  importTranslations,
  initLanguageCenter,
  retryTranslationJob,
  saveGlossaryTerm,
  saveTranslationEntry,
  saveTranslationSettings,
  startBulkTranslation,
  syncTranslationSources,
  translateSelection,
  upsertStoreLocale,
} from "@/lib/translation.functions";

/** Dil ve Çeviri Merkezi: mağaza dilleri, çeviri yöneticisi, sözlük ve toplu çeviri. */
export const Route = createFileRoute("/_authenticated/store/$storeId/languages")({
  head: () => ({
    meta: [
      { title: "Dil ve Çeviri Merkezi | Mefticaret" },
      {
        name: "description",
        content:
          "Mağazanın ürün, kategori, sayfa, tema ve sistem metinlerini sınırsız dile çevir; AI destekli toplu çeviri ve SEO uyumlu çok dilli yapı.",
      },
      { property: "og:title", content: "Dil ve Çeviri Merkezi | Mefticaret" },
      {
        property: "og:description",
        content: "Mağazanı çok dilli hale getir: AI çeviri, çeviri hafızası, sözlük ve hreflang.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LanguageCenterPage,
});

function LanguageCenterPage() {
  const { storeId } = Route.useParams();
  const queryClient = useQueryClient();

  const locales = useQuery(storeLocalesQuery(storeId));
  const settings = useQuery(translationSettingsQuery(storeId));
  const progressRows = useQuery(translationProgressQuery(storeId));
  const jobs = useQuery(translationJobsQuery(storeId));
  const glossary = useQuery(glossaryQuery(storeId));
  const usage = useQuery(translationUsageQuery(storeId));

  const init = useServerFn(initLanguageCenter);
  useEffect(() => {
    init({ data: { storeId } })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["language-center", storeId] });
      })
      .catch(() => {
        /* ilk açılışta oluşturma başarısızsa panel yine görüntülenir */
      });
  }, [init, queryClient, storeId]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["language-center", storeId] });

  const activeLocales = (locales.data ?? []).filter((row) => row.is_active).map((row) => row.locale);
  const defaultLocale = (locales.data ?? []).find((row) => row.is_default)?.locale ?? "tr-TR";
  const progress = useMemo(
    () => computeProgress(progressRows.data ?? [], (locales.data ?? []).map((row) => row.locale)),
    [progressRows.data, locales.data],
  );

  return (
    <AppShell
      storeId={storeId}
      title="Dil ve Çeviri Merkezi"
      description="Mağazanın tüm içeriğini istediğin dile çevir."
    >
      <div className="w-full max-w-full space-y-6 overflow-x-hidden">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Language Center</p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold sm:text-3xl">
            <Globe className="h-6 w-6" /> Dil ve Çeviri Merkezi
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Mağazandaki ürün, kategori, koleksiyon, sayfa, blog, menü, tema, sistem metni ve SEO
            alanlarını istediğin dile çevir. Varsayılan dil çeviri bulunmadığında yedek olarak kullanılır.
          </p>
        </header>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="flex w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="overview">Diller</TabsTrigger>
            <TabsTrigger value="manager">Çeviri Yöneticisi</TabsTrigger>
            <TabsTrigger value="bulk">Toplu Çeviri</TabsTrigger>
            <TabsTrigger value="glossary">Sözlük</TabsTrigger>
            <TabsTrigger value="settings">Ayarlar</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <LocaleOverview
              storeId={storeId}
              locales={locales.data ?? []}
              loading={locales.isLoading}
              progress={progress}
              onChanged={invalidate}
            />
          </TabsContent>

          <TabsContent value="manager" className="mt-4">
            <TranslationManager
              storeId={storeId}
              locales={activeLocales}
              defaultLocale={defaultLocale}
              onChanged={invalidate}
            />
          </TabsContent>

          <TabsContent value="bulk" className="mt-4 space-y-4">
            <BulkPanel
              storeId={storeId}
              locales={activeLocales.filter((locale) => locale !== defaultLocale)}
              jobs={jobs.data ?? []}
              onChanged={invalidate}
            />
            <UsageCard rows={usage.data ?? []} />
          </TabsContent>

          <TabsContent value="glossary" className="mt-4">
            <GlossaryPanel
              storeId={storeId}
              rows={glossary.data ?? []}
              locales={activeLocales}
              onChanged={invalidate}
            />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            {settings.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <SettingsPanel
                storeId={storeId}
                row={settings.data ?? null}
                locales={activeLocales}
                onChanged={invalidate}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

/* --------------------------------------------------------------- diller */

function LocaleOverview({
  storeId,
  locales,
  loading,
  progress,
  onChanged,
}: {
  storeId: string;
  locales: { id: string; locale: string; label: string; is_active: boolean; is_default: boolean; dir: string; currency: string | null }[];
  loading: boolean;
  progress: ReturnType<typeof computeProgress>;
  onChanged: () => void;
}) {
  const [newLocale, setNewLocale] = useState("");
  const upsert = useServerFn(upsertStoreLocale);
  const remove = useServerFn(deleteStoreLocale);
  const sync = useServerFn(syncTranslationSources);

  const addMutation = useMutation({
    mutationFn: async (locale: string) => {
      const meta = LANGUAGE_CATALOG.find((entry) => entry.locale === locale);
      if (!meta) throw new Error("Dil seçilmedi");
      await upsert({
        data: {
          storeId,
          locale: meta.locale,
          label: meta.label,
          nativeLabel: meta.native,
          ...(meta.currency ? { currency: meta.currency } : {}),
          isActive: true,
          isDefault: false,
          fallbackCode: null,
          sortOrder: 0,
        },
      });
      await sync({ data: { storeId, locales: [meta.locale], contentTypes: [] } });
    },
    onSuccess: () => {
      toast.success("Dil eklendi ve çevrilecek metinler tarandı.");
      setNewLocale("");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (input: { row: (typeof locales)[number]; patch: { isActive?: boolean; isDefault?: boolean } }) =>
      upsert({
        data: {
          storeId,
          locale: input.row.locale,
          label: input.row.label,
          isActive: input.patch.isActive ?? input.row.is_active,
          isDefault: input.patch.isDefault ?? input.row.is_default,
          fallbackCode: null,
          sortOrder: 0,
          ...(input.row.currency ? { currency: input.row.currency } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Dil güncellendi.");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => remove({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("Dil kaldırıldı.");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rescan = useMutation({
    mutationFn: async () =>
      sync({ data: { storeId, locales: locales.map((row) => row.locale), contentTypes: [] } }),
    onSuccess: (result) => {
      toast.success(`${result.scanned} metin tarandı, ${result.created} yeni alan eklendi.`);
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const available = LANGUAGE_CATALOG.filter(
    (entry) => !locales.some((row) => row.locale === entry.locale),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Dil ekle</CardTitle>
            <CardDescription>Mağazan için istediğin kadar dil ekleyebilirsin.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => rescan.mutate()}
            disabled={rescan.isPending || locales.length === 0}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> İçerikleri tara
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Select value={newLocale} onValueChange={setNewLocale}>
            <SelectTrigger className="sm:max-w-xs">
              <SelectValue placeholder="Dil seç" />
            </SelectTrigger>
            <SelectContent>
              {available.map((entry) => (
                <SelectItem key={entry.locale} value={entry.locale}>
                  {entry.flag} {entry.label} — {entry.locale}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => addMutation.mutate(newLocale)} disabled={!newLocale || addMutation.isPending}>
            <Plus className="mr-2 h-4 w-4" /> Dil ekle
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {locales.map((row) => {
            const stats = progress.find((item) => item.locale === row.locale);
            return (
              <Card key={row.id}>
                <CardHeader className="space-y-1 pb-3">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span className="flex items-center gap-2">
                      <span aria-hidden>{languageFlag(row.locale)}</span>
                      {row.label}
                    </span>
                    <span className="flex gap-1">
                      {row.is_default ? <Badge>Varsayılan</Badge> : null}
                      <Badge variant={row.is_active ? "secondary" : "outline"}>
                        {row.is_active ? "Aktif" : "Pasif"}
                      </Badge>
                    </span>
                  </CardTitle>
                  <CardDescription>
                    {languageNative(row.locale)} · {row.locale} · {row.dir.toUpperCase()}
                    {row.currency ? ` · ${row.currency}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Çeviri durumu</span>
                      <span className="font-semibold">{stats?.percent ?? 0}%</span>
                    </div>
                    <Progress value={stats?.percent ?? 0} />
                    <p className="text-xs text-muted-foreground">
                      Çevrildi {stats?.translated ?? 0} · Makine {stats?.machine ?? 0} · İnceleme{" "}
                      {stats?.review ?? 0} · Eksik {stats?.missing ?? 0}
                    </p>
                    {stats?.updatedAt ? (
                      <p className="text-xs text-muted-foreground">
                        Son güncelleme: {formatDateTime(stats.updatedAt)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`active-${row.id}`}
                        checked={row.is_active}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ row, patch: { isActive: checked } })
                        }
                      />
                      <Label htmlFor={`active-${row.id}`} className="text-xs">
                        Vitrinde aktif
                      </Label>
                    </div>
                    {!row.is_default ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleMutation.mutate({ row, patch: { isDefault: true } })}
                        >
                          <Check className="mr-1 h-3 w-3" /> Varsayılan yap
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(row.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------ çeviri yöneticisi */

function TranslationManager({
  storeId,
  locales,
  defaultLocale,
  onChanged,
}: {
  storeId: string;
  locales: string[];
  defaultLocale: string;
  onChanged: () => void;
}) {
  const targets = locales.filter((locale) => locale !== defaultLocale);
  const [locale, setLocale] = useState(targets[0] ?? "");
  const [contentType, setContentType] = useState<ContentType | "all">("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!locale && targets[0]) setLocale(targets[0]);
  }, [locale, targets]);

  const entries = useQuery(translationEntriesQuery(storeId, { locale, contentType, search, status }));
  const save = useServerFn(saveTranslationEntry);
  const translate = useServerFn(translateSelection);
  const exportFn = useServerFn(exportTranslations);
  const importFn = useServerFn(importTranslations);

  const saveMutation = useMutation({
    mutationFn: async (input: { entryId: string; value: string; approve: boolean }) =>
      save({ data: { storeId, ...input } }),
    onSuccess: (result) => {
      const issues = result.issues.filter((issue) => issue !== "identical");
      if (issues.length > 0) {
        toast.warning(`Kaydedildi, kontrol et: ${issues.map((issue) => QUALITY_LABELS[issue]).join(", ")}`);
      } else {
        toast.success("Çeviri kaydedildi.");
      }
      void entries.refetch();
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const aiMutation = useMutation({
    mutationFn: async (entryIds: string[]) => translate({ data: { storeId, entryIds } }),
    onSuccess: (result) => {
      toast.success(
        `${result.translated} çeviri yapıldı, ${result.reused} hafızadan geldi${result.failed ? `, ${result.failed} başarısız` : ""}.`,
      );
      setSelected([]);
      void entries.refetch();
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const exportMutation = useMutation({
    mutationFn: async (format: "csv" | "json") => exportFn({ data: { storeId, locale, format } }),
    onSuccess: (result) => {
      const blob = new Blob([result.content], {
        type: result.format === "csv" ? "text/csv" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ceviriler-${locale}.${result.format}`;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const text = await file.text();
      const rows: { key: string; value: string }[] = [];
      if (file.name.endsWith(".json")) {
        const parsed = JSON.parse(text) as { translation_key?: string; key?: string; value?: string; translated_value?: string }[];
        for (const row of parsed) {
          const key = row.translation_key ?? row.key;
          const value = row.translated_value ?? row.value;
          if (key && typeof value === "string") rows.push({ key, value });
        }
      } else {
        const lines = text.split(/\r?\n/).slice(1);
        for (const line of lines) {
          const cells = line.match(/(".*?"|[^,]+)(?=,|$)/g);
          if (!cells || cells.length < 4) continue;
          const clean = cells.map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"'));
          if (clean[0]) rows.push({ key: clean[0], value: clean[3] ?? "" });
        }
      }
      if (rows.length === 0) throw new Error("Dosyada geçerli satır bulunamadı");
      return importFn({ data: { storeId, locale, rows } });
    },
    onSuccess: (result) => {
      toast.success(`${result.updated} çeviri güncellendi, ${result.skipped} satır atlandı.`);
      void entries.refetch();
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (targets.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Çeviri yapmak için önce varsayılan dilin dışında en az bir dil ekle.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg">Çeviri yöneticisi</CardTitle>
          <CardDescription>
            Kaynak dil <strong>{defaultLocale}</strong> — soldaki metni sağdaki alanda düzenle.
          </CardDescription>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger>
              <SelectValue placeholder="Hedef dil" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((item) => (
                <SelectItem key={item} value={item}>
                  {languageFlag(item)} {languageNative(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={contentType} onValueChange={(value) => setContentType(value as ContentType | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="İçerik tipi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm içerikler</SelectItem>
              {CONTENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {CONTENT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm durumlar</SelectItem>
              {TRANSLATION_STATUSES.map((item) => (
                <SelectItem key={item} value={item}>
                  {STATUS_LABELS[item]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Anahtar veya metin ara"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => aiMutation.mutate(selected)}
            disabled={selected.length === 0 || aiMutation.isPending}
          >
            <Sparkles className="mr-2 h-4 w-4" /> Seçileni AI ile çevir ({selected.length})
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportMutation.mutate("csv")}>
            <Download className="mr-2 h-4 w-4" /> CSV indir
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportMutation.mutate("json")}>
            <Download className="mr-2 h-4 w-4" /> JSON indir
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".csv,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importMutation.mutate(file);
                event.target.value = "";
              }}
            />
            <span className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-sm">
              <Upload className="mr-2 h-4 w-4" /> İçe aktar
            </span>
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (entries.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Bu filtrede kayıt yok. "İçerikleri tara" ile çevrilecek alanları oluşturabilirsin.
          </p>
        ) : (
          (entries.data ?? []).map((entry) => {
            const draft = drafts[entry.id] ?? entry.translated_value ?? "";
            const issues = draft ? checkTranslation(entry.source_value ?? "", draft) : [];
            return (
              <div key={entry.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2 pb-2">
                  <input
                    type="checkbox"
                    aria-label={`${entry.translation_key} seç`}
                    checked={selected.includes(entry.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, entry.id]
                          : current.filter((id) => id !== entry.id),
                      )
                    }
                  />
                  <code className="break-all text-xs text-muted-foreground">{entry.translation_key}</code>
                  <Badge variant="outline">{CONTENT_TYPE_LABELS[entry.content_type as ContentType] ?? entry.content_type}</Badge>
                  <Badge variant={entry.status === "approved" ? "default" : "secondary"}>
                    {STATUS_LABELS[entry.status]}
                  </Badge>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-wrap break-words">
                    {entry.source_value}
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      value={draft}
                      rows={Math.min(8, Math.max(2, Math.ceil((entry.source_value?.length ?? 40) / 60)))}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [entry.id]: event.target.value }))
                      }
                      placeholder="Çeviri"
                    />
                    {issues.length > 0 ? (
                      <p className="text-xs text-amber-600">
                        {issues.map((issue) => QUALITY_LABELS[issue]).join(" · ")}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          saveMutation.mutate({ entryId: entry.id, value: draft, approve: false })
                        }
                        disabled={saveMutation.isPending}
                      >
                        Kaydet
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          saveMutation.mutate({ entryId: entry.id, value: draft, approve: true })
                        }
                        disabled={saveMutation.isPending || !draft}
                      >
                        <Check className="mr-1 h-3 w-3" /> Onayla
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => aiMutation.mutate([entry.id])}
                        disabled={aiMutation.isPending}
                      >
                        <Sparkles className="mr-1 h-3 w-3" /> AI ile çevir
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------- toplu çeviri */

function BulkPanel({
  storeId,
  locales,
  jobs,
  onChanged,
}: {
  storeId: string;
  locales: string[];
  jobs: {
    id: string;
    status: string;
    target_locales: string[];
    content_types: string[];
    total_items: number;
    done_items: number;
    failed_items: number;
    created_at: string;
  }[];
  onChanged: () => void;
}) {
  const [targets, setTargets] = useState<string[]>([]);
  const [types, setTypes] = useState<ContentType[]>([]);
  const [onlyMissing, setOnlyMissing] = useState(true);

  const start = useServerFn(startBulkTranslation);
  const retry = useServerFn(retryTranslationJob);
  const advance = useServerFn(advanceTranslationJob);

  const startMutation = useMutation({
    mutationFn: async () =>
      start({ data: { storeId, targetLocales: targets, contentTypes: types, onlyMissing } }),
    onSuccess: (result) => {
      toast.success(`${result.total} metin kuyruğa alındı. Çeviri arka planda ilerliyor.`);
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const advanceMutation = useMutation({
    mutationFn: async (jobId: string) => advance({ data: { storeId, jobId } }),
    onSuccess: (result) => {
      toast.success(`${result.processed} metin çevrildi, ${result.remaining} sırada.`);
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const retryMutation = useMutation({
    mutationFn: async (jobId: string) => retry({ data: { storeId, jobId } }),
    onSuccess: () => {
      toast.success("Başarısız kalemler yeniden kuyruğa alındı.");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">AI ile toplu çeviri</CardTitle>
          <CardDescription>
            Büyük çeviriler arka plan kuyruğunda parça parça işlenir; sayfayı kapatabilirsin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">Hedef diller</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {locales.map((locale) => (
                <Button
                  key={locale}
                  size="sm"
                  variant={targets.includes(locale) ? "default" : "outline"}
                  onClick={() =>
                    setTargets((current) =>
                      current.includes(locale)
                        ? current.filter((item) => item !== locale)
                        : [...current, locale],
                    )
                  }
                >
                  {languageFlag(locale)} {locale}
                </Button>
              ))}
              {locales.length === 0 ? (
                <p className="text-sm text-muted-foreground">Önce dil ekle.</p>
              ) : null}
            </div>
          </div>
          <div>
            <Label className="text-sm">İçerik tipleri (boş bırakırsan tümü)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CONTENT_TYPES.map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant={types.includes(type) ? "secondary" : "outline"}
                  onClick={() =>
                    setTypes((current) =>
                      current.includes(type)
                        ? current.filter((item) => item !== type)
                        : [...current, type],
                    )
                  }
                >
                  {CONTENT_TYPE_LABELS[type]}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="only-missing" checked={onlyMissing} onCheckedChange={setOnlyMissing} />
            <Label htmlFor="only-missing" className="text-sm">
              Yalnızca eksik çevirileri işle
            </Label>
          </div>
          <Button
            onClick={() => startMutation.mutate()}
            disabled={targets.length === 0 || startMutation.isPending}
          >
            <Languages className="mr-2 h-4 w-4" /> Toplu çeviriyi başlat
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Çeviri işleri</CardTitle>
          <CardDescription>Kuyruk durumu ve ilerleme.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Henüz toplu çeviri başlatılmadı.</p>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="space-y-2 rounded-xl border p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={job.status === "completed" ? "default" : "secondary"}>{job.status}</Badge>
                  <span className="text-muted-foreground">{job.target_locales.join(", ")}</span>
                  <span className="text-muted-foreground">{formatDateTime(job.created_at)}</span>
                </div>
                <Progress
                  value={job.total_items === 0 ? 0 : Math.round((job.done_items / job.total_items) * 100)}
                />
                <p className="text-xs text-muted-foreground">
                  {job.done_items}/{job.total_items} tamamlandı
                  {job.failed_items ? ` · ${job.failed_items} başarısız` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {job.status !== "completed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => advanceMutation.mutate(job.id)}
                      disabled={advanceMutation.isPending}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" /> Şimdi çalıştır
                    </Button>
                  ) : null}
                  {job.failed_items > 0 ? (
                    <Button size="sm" variant="ghost" onClick={() => retryMutation.mutate(job.id)}>
                      Tekrar dene
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UsageCard({ rows }: { rows: { id: string; day: string; locale: string; characters: number; requests: number; provider: string }[] }) {
  const totals = rows.reduce(
    (acc, row) => ({ characters: acc.characters + row.characters, requests: acc.requests + row.requests }),
    { characters: 0, requests: 0 },
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Çeviri kullanımı</CardTitle>
        <CardDescription>Son 60 kayıt: toplam {totals.characters.toLocaleString("tr-TR")} karakter, {totals.requests} istek.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {rows.slice(0, 10).map((row) => (
          <div key={row.id} className="flex flex-wrap justify-between gap-2 border-b py-1 last:border-0">
            <span>{row.day} · {row.locale}</span>
            <span className="text-muted-foreground">
              {row.characters.toLocaleString("tr-TR")} karakter · {row.requests} istek · {row.provider}
            </span>
          </div>
        ))}
        {rows.length === 0 ? <p className="text-muted-foreground">Henüz kullanım yok.</p> : null}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------- sözlük */

function GlossaryPanel({
  storeId,
  rows,
  locales,
  onChanged,
}: {
  storeId: string;
  rows: { id: string; term: string; locale: string | null; translation: string | null; do_not_translate: boolean }[];
  locales: string[];
  onChanged: () => void;
}) {
  const [term, setTerm] = useState("");
  const [translation, setTranslation] = useState("");
  const [locale, setLocale] = useState<string>("all");
  const [dnt, setDnt] = useState(false);

  const save = useServerFn(saveGlossaryTerm);
  const remove = useServerFn(deleteGlossaryTerm);

  const saveMutation = useMutation({
    mutationFn: async () =>
      save({
        data: {
          storeId,
          term,
          locale: locale === "all" ? null : locale,
          translation: translation || null,
          doNotTranslate: dnt,
          notes: null,
        },
      }),
    onSuccess: () => {
      toast.success("Sözlük kaydı eklendi.");
      setTerm("");
      setTranslation("");
      setDnt(false);
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => remove({ data: { storeId, id } }),
    onSuccess: () => {
      toast.success("Kayıt silindi.");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Çeviri sözlüğü</CardTitle>
        <CardDescription>
          Marka ve ürün terimlerinin nasıl çevrileceğini belirle; "çevrilmesin" seçilirse terim aynen korunur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Terim (örn. Sneaker)" />
          <Input
            value={translation}
            onChange={(event) => setTranslation(event.target.value)}
            placeholder="Karşılığı"
            disabled={dnt}
          />
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger>
              <SelectValue placeholder="Dil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm diller</SelectItem>
              {locales.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <Switch id="dnt" checked={dnt} onCheckedChange={setDnt} />
            <Label htmlFor="dnt" className="text-xs">Çevrilmesin</Label>
          </div>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={!term || saveMutation.isPending}>
          <Plus className="mr-2 h-4 w-4" /> Sözlüğe ekle
        </Button>

        <div className="space-y-1 text-sm">
          {rows.map((row) => (
            <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
              <span className="font-medium">{row.term}</span>
              <span className="text-muted-foreground">
                {row.do_not_translate ? "Çevrilmesin" : row.translation} {row.locale ? `· ${row.locale}` : "· tüm diller"}
              </span>
              <Button size="sm" variant="ghost" onClick={() => deleteMutation.mutate(row.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {rows.length === 0 ? <p className="text-muted-foreground">Sözlük boş.</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------- ayarlar */

function SettingsPanel({
  storeId,
  row,
  locales,
  onChanged,
}: {
  storeId: string;
  row: {
    enabled: boolean;
    model: string;
    brand_voice: string;
    detect_browser_language: boolean;
    url_strategy: string;
    show_missing: boolean;
    translate_slugs: boolean;
    switcher_enabled: boolean;
    switcher_style: string;
    do_not_translate: string[];
    fallback_chain: string[];
  } | null;
  locales: string[];
  onChanged: () => void;
}) {
  const [form, setForm] = useState({
    enabled: row?.enabled ?? true,
    model: row?.model ?? "google/gemini-2.5-flash",
    brandVoice: (row?.brand_voice ?? "professional") as (typeof BRAND_VOICES)[number],
    detectBrowserLanguage: row?.detect_browser_language ?? true,
    urlStrategy: (row?.url_strategy ?? "subdirectory") as "subdirectory" | "subdomain" | "domain",
    showMissing: row?.show_missing ?? false,
    translateSlugs: row?.translate_slugs ?? true,
    switcherEnabled: row?.switcher_enabled ?? true,
    switcherStyle: (row?.switcher_style ?? "flags_text") as (typeof SWITCHER_STYLES)[number],
    doNotTranslate: (row?.do_not_translate ?? []).join(", "),
    fallbackChain: (row?.fallback_chain ?? []).join(", "),
  });

  const save = useServerFn(saveTranslationSettings);
  const saveMutation = useMutation({
    mutationFn: async () =>
      save({
        data: {
          storeId,
          enabled: form.enabled,
          provider: "lovable-ai",
          model: form.model,
          brandVoice: form.brandVoice,
          detectBrowserLanguage: form.detectBrowserLanguage,
          urlStrategy: form.urlStrategy,
          showMissing: form.showMissing,
          translateSlugs: form.translateSlugs,
          switcherEnabled: form.switcherEnabled,
          switcherStyle: form.switcherStyle,
          doNotTranslate: form.doNotTranslate
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          fallbackChain: form.fallbackChain
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: () => {
      toast.success("Ayarlar kaydedildi.");
      onChanged();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Çeviri ayarları</CardTitle>
        <CardDescription>Dil değiştirici, URL yapısı, yedek dil ve AI çeviri davranışı.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>AI modeli</Label>
            <Input value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Marka dili</Label>
            <Select
              value={form.brandVoice}
              onValueChange={(value) => setForm({ ...form, brandVoice: value as typeof form.brandVoice })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAND_VOICES.map((voice) => (
                  <SelectItem key={voice} value={voice}>
                    {BRAND_VOICE_LABELS[voice]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>URL yapısı</Label>
            <Select
              value={form.urlStrategy}
              onValueChange={(value) => setForm({ ...form, urlStrategy: value as typeof form.urlStrategy })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="subdirectory">Alt dizin (/en, /de)</SelectItem>
                <SelectItem value="subdomain">Alt alan adı (en.magaza.com)</SelectItem>
                <SelectItem value="domain">Ayrı alan adı (magaza.de)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dil değiştirici tasarımı</Label>
            <Select
              value={form.switcherStyle}
              onValueChange={(value) => setForm({ ...form, switcherStyle: value as typeof form.switcherStyle })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SWITCHER_STYLES.map((style) => (
                  <SelectItem key={style} value={style}>
                    {SWITCHER_STYLE_LABELS[style]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Çevrilmeyecek kelimeler (virgülle)</Label>
            <Input
              value={form.doNotTranslate}
              onChange={(event) => setForm({ ...form, doNotTranslate: event.target.value })}
              placeholder="Nike, Mefticaret, iPhone, SEO"
            />
          </div>
          <div className="space-y-2">
            <Label>Yedek dil zinciri (virgülle)</Label>
            <Input
              value={form.fallbackChain}
              onChange={(event) => setForm({ ...form, fallbackChain: event.target.value })}
              placeholder={locales.join(", ")}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { key: "enabled" as const, label: "Çeviri sistemi aktif" },
            { key: "switcherEnabled" as const, label: "Vitrinde dil değiştirici göster" },
            { key: "detectBrowserLanguage" as const, label: "Tarayıcı dilini algıla ve öner" },
            { key: "translateSlugs" as const, label: "URL adreslerini de çevir" },
            { key: "showMissing" as const, label: "Eksik çevirileri gizlemek yerine göster" },
          ].map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <Switch
                id={item.key}
                checked={form[item.key]}
                onCheckedChange={(checked) => setForm({ ...form, [item.key]: checked })}
              />
              <Label htmlFor={item.key} className="text-sm">
                {item.label}
              </Label>
            </div>
          ))}
        </div>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Kaydediliyor…" : "Ayarları kaydet"}
        </Button>
      </CardContent>
    </Card>
  );
}
