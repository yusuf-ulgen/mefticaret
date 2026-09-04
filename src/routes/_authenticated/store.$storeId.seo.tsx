import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, FileWarning, Gauge, Link2, Settings2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SeoAuditTab } from "@/components/seo/seo-audit";
import { SeoErrorsTab } from "@/components/seo/seo-errors";
import { SeoMetaTab } from "@/components/seo/seo-meta";
import { SeoOverviewTab, type SeoCheck } from "@/components/seo/seo-overview";
import { SeoRedirectsTab } from "@/components/seo/seo-redirects";
import { seoTemplateDefaults, type SeoTemplateKey } from "@/components/seo/seo-shared";
import { SeoUrlsTab } from "@/components/seo/seo-urls";
import { storePagesQuery } from "@/lib/pages-queries";
import { readStoreSeo, type StoreSeoSettings } from "@/lib/seo";
import { seo404Query, seoRedirectsQuery } from "@/lib/seo-management-queries";
import {
  latestSeoAuditQuery,
  seoAuditPagesQuery,
  seoIssuesQuery,
} from "@/lib/seo-audit-queries";
import { fixSeoIssuesBulk, runSeoAudit, updateSeoIssueStatus } from "@/lib/seo-audit.functions";
import {
  createRedirectFrom404,
  deleteSeoRedirect,
  upsertSeoRedirect,
} from "@/lib/seo-management.functions";
import { saveStoreSeo } from "@/lib/seo.functions";
import { storeSeoAuditQuery } from "@/lib/seo-queries";
import { storeDomainsQuery, storeQuery, storeSettingsQuery } from "@/lib/store-queries";
import { storeThemeQuery } from "@/lib/theme-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/seo")({
  head: () => ({
    meta: [
      { title: "SEO Merkezi — Mefticaret" },
      {
        name: "description",
        content:
          "Meta şablonları, URL yapısı, 301 yönlendirmeleri, 404 takibi ve mağaza SEO sağlığını tek merkezden yönetin.",
      },
      { property: "og:title", content: "SEO Merkezi — Mefticaret" },
      {
        property: "og:description",
        content: "Mağazanızın arama motoru görünürlüğünü gerçek verilerle yönetin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SeoCenterPage,
});

function SeoCenterPage() {
  const { storeId } = Route.useParams();
  const client = useQueryClient();
  const { data: store } = useQuery(storeQuery(storeId));
  const { data: settings } = useQuery(storeSettingsQuery(storeId));
  const { data: theme } = useQuery(storeThemeQuery(storeId));
  const { data: pages } = useQuery(storePagesQuery(storeId));
  const { data: domains } = useQuery(storeDomainsQuery(storeId));
  const { data: products, isLoading } = useQuery(storeSeoAuditQuery(storeId));
  const { data: redirects } = useQuery(seoRedirectsQuery(storeId));
  const { data: errors404 } = useQuery(seo404Query(storeId));
  const { data: audit } = useQuery(latestSeoAuditQuery(storeId));
  const { data: auditPages } = useQuery(seoAuditPagesQuery(storeId, audit?.id ?? null));
  const { data: seoIssues } = useQuery(seoIssuesQuery(storeId));

  const saveSeo = useServerFn(saveStoreSeo);
  const saveRedirect = useServerFn(upsertSeoRedirect);
  const removeRedirect = useServerFn(deleteSeoRedirect);
  const makeRedirect = useServerFn(createRedirectFrom404);
  const startAudit = useServerFn(runSeoAudit);
  const applyFixes = useServerFn(fixSeoIssuesBulk);
  const changeStatus = useServerFn(updateSeoIssueStatus);

  const refreshAudit = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["seo-audit-latest", storeId] }),
      client.invalidateQueries({ queryKey: ["seo-audit-pages", storeId] }),
      client.invalidateQueries({ queryKey: ["seo-issues", storeId] }),
      client.invalidateQueries({ queryKey: ["seo-audit", storeId] }),
    ]);
  };

  const auditMutation = useMutation({
    mutationFn: () => startAudit({ data: { storeId } }),
    onSuccess: async (result) => {
      await refreshAudit();
      toast.success(`Denetim tamamlandı — skor ${result.score}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const fixMutation = useMutation({
    mutationFn: (issueIds: string[]) => applyFixes({ data: { storeId, issueIds } }),
    onSuccess: async (result) => {
      await refreshAudit();
      toast.success(`${result.fixed} sorun düzeltildi`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "open" | "ignored" | "resolved" }) =>
      changeStatus({ data: { storeId, issueId: id, status } }),
    onSuccess: async () => {
      await refreshAudit();
      toast.success("Sorun durumu güncellendi");
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const [tab, setTab] = useState("overview");
  const [draft, setDraft] = useState<StoreSeoSettings>({});
  const [templateKey, setTemplateKey] = useState<SeoTemplateKey>("product");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState<"301" | "302">("301");
  const [errorTargets, setErrorTargets] = useState<Record<string, string>>({});

  const stored = useMemo(() => readStoreSeo(settings?.seo), [settings?.seo]);
  const current = Object.keys(draft).length ? draft : stored;

  const updateSeo = (patch: Partial<StoreSeoSettings>) =>
    setDraft(() => ({ ...current, ...patch }));

  const updateTemplate = (field: "title" | "description", value: string) => {
    const templates = { ...(current.templates ?? {}) };
    templates[templateKey] = {
      ...(templates[templateKey] ?? seoTemplateDefaults[templateKey]),
      [field]: value,
    };
    updateSeo({ templates });
  };

  const checks = useMemo<SeoCheck[]>(() => {
    const active = (products ?? []).filter((product) => product.status === "active");
    return [
      {
        id: "title",
        label: "Mağaza SEO başlığı tanımlı",
        hint: "60 karakteri aşmayan bir ana sayfa başlığı girin.",
        ok: Boolean(stored.homeTitle && stored.homeTitle.trim().length > 3),
      },
      {
        id: "description",
        label: "Mağaza meta açıklaması tanımlı",
        hint: "160 karaktere kadar açıklayıcı bir metin ekleyin.",
        ok: Boolean(stored.homeDescription && stored.homeDescription.trim().length > 20),
      },
      {
        id: "contact",
        label: "İletişim bilgileri dolu",
        hint: "İletişim bilgileri güven sinyalini destekler.",
        ok: Boolean(settings?.contact_email),
        to: `/store/${storeId}/settings`,
      },
      {
        id: "theme",
        label: "Tema yayınlanmış",
        hint: "Vitrin yayınlanmadan sayfalar taranamaz.",
        ok: Boolean(theme?.is_published),
        to: `/store/${storeId}/themes`,
      },
      {
        id: "hero",
        label: "Vitrin başlığı özelleştirilmiş",
        hint: "Ana sayfa H1 metnini markanıza göre düzenleyin.",
        ok: Boolean(theme?.hero_title && theme.hero_title.trim().length > 8),
        to: `/store/${storeId}/themes`,
      },
      {
        id: "products",
        label: "En az 3 aktif ürün var",
        hint: "Aktif ürünler sitemap ve yapılandırılmış veriyi besler.",
        ok: active.length >= 3,
        to: `/store/${storeId}/products`,
      },
      {
        id: "pages",
        label: "Kurumsal sayfa yayında",
        hint: "İade, gizlilik veya hakkımızda sayfası ekleyin.",
        ok: (pages ?? []).some((page) => page.is_published),
        to: `/store/${storeId}/pages`,
      },
      {
        id: "domain",
        label: "Doğrulanmış alan adı",
        hint: "Kendi alan adınız marka görünürlüğünü artırır.",
        ok: (domains ?? []).some((domain) => domain.status === "verified"),
        to: `/store/${storeId}/domains`,
      },
    ];
  }, [domains, pages, products, settings?.contact_email, stored, storeId, theme]);

  const issues = useMemo(
    () =>
      (products ?? [])
        .filter((product) => product.status === "active")
        .map((product) => {
          const list: string[] = [];
          if (!product.seo?.description || product.seo.description.trim().length < 40)
            list.push("Meta açıklama eksik");
          if (!product.seo?.title || product.seo.title.trim().length < 5)
            list.push("SEO başlığı eksik");
          if (
            !product.description ||
            product.description.replace(/<[^>]*>/g, "").trim().length < 80
          )
            list.push("Ürün açıklaması kısa");
          if (product.imageCount === 0) list.push("Görsel yok");
          if (product.slug.length > 70) list.push("URL çok uzun");
          return { id: product.id, title: product.title, slug: product.slug, issues: list };
        })
        .filter((product) => product.issues.length > 0)
        .sort((a, b) => b.issues.length - a.issues.length),
    [products],
  );

  const activeCount = (products ?? []).filter((product) => product.status === "active").length;
  const passed = checks.filter((check) => check.ok).length;
  const score = Math.round(
    ((passed / checks.length) * 0.6 +
      (activeCount ? Math.max(activeCount - issues.length, 0) / activeCount : 0) * 0.4) *
      100,
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      saveSeo({
        data: {
          storeId,
          homeTitle: current.homeTitle,
          homeDescription: current.homeDescription,
          keywords: current.keywords,
          defaultOgImage: current.defaultOgImage,
          noindexStore: current.noindexStore,
          robotsExtra: current.robotsExtra,
          urlStructure: current.urlStructure,
          templates: current.templates,
        },
      }),
    onSuccess: async () => {
      setDraft({});
      await client.invalidateQueries({ queryKey: ["store-settings", storeId] });
      toast.success("SEO ayarları kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const redirectMutation = useMutation({
    mutationFn: () =>
      saveRedirect({
        data: {
          storeId,
          sourcePath: source,
          targetPath: target,
          statusCode: Number(code) as 301 | 302,
          isActive: true,
        },
      }),
    onSuccess: async () => {
      setSource("");
      setTarget("");
      await client.invalidateQueries({ queryKey: ["seo-redirects", storeId] });
      toast.success("Yönlendirme kaydedildi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeRedirect({ data: { storeId, id } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["seo-redirects", storeId] });
      toast.success("Yönlendirme silindi");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const errorMutation = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) =>
      makeRedirect({ data: { storeId, id, targetPath: path } }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["seo-redirects", storeId] });
      await client.invalidateQueries({ queryKey: ["seo-404s", storeId] });
      toast.success("404 kaydından 301 oluşturuldu");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const slug = store?.slug ?? "magazaniz";

  return (
    <AppShell
      storeId={storeId}
      title="SEO Merkezi"
      description="Arama görünürlüğü, meta şablonları ve teknik SEO operasyonları."
    >
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Görünürlük operasyonu</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">SEO Merkezi</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              İçerik, teknik yapı ve hata takibini tek merkezden yönetin.
            </p>
          </div>
          {store?.slug ? (
            <Button asChild variant="outline" className="gap-2">
              <a href={`/api/public/sitemap/${store.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" /> Sitemap&apos;i görüntüle
              </a>
            </Button>
          ) : null}
        </header>

        <Tabs value={tab} onValueChange={setTab} className="space-y-5">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="overview" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> Genel bakış
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <Gauge className="h-4 w-4" /> Denetim &amp; skor
            </TabsTrigger>
            <TabsTrigger value="meta" className="gap-2">
              <Settings2 className="h-4 w-4" /> Meta şablonları
            </TabsTrigger>
            <TabsTrigger value="urls" className="gap-2">
              <Link2 className="h-4 w-4" /> URL yapısı
            </TabsTrigger>
            <TabsTrigger value="redirects" className="gap-2">
              <Link2 className="h-4 w-4" /> 301 / 302
            </TabsTrigger>
            <TabsTrigger value="errors" className="gap-2">
              <FileWarning className="h-4 w-4" /> 404 izleme
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <SeoOverviewTab
              checks={checks}
              score={audit ? audit.score : score}
              passed={passed}
              activeCount={activeCount}
              issues={issues}
              loading={isLoading}
              storeId={storeId}
            />
          </TabsContent>

          <TabsContent value="audit">
            <SeoAuditTab
              audit={audit ?? null}
              pages={auditPages ?? []}
              issues={seoIssues ?? []}
              running={auditMutation.isPending}
              pending={fixMutation.isPending || statusMutation.isPending}
              runAudit={() => auditMutation.mutate()}
              fixIssues={(ids) => fixMutation.mutate(ids)}
              setStatus={(id, status) => statusMutation.mutate({ id, status })}
            />
          </TabsContent>


          <TabsContent value="meta" className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
            <SeoMetaTab
              current={current}
              templateKey={templateKey}
              storeName={store?.name ?? "Mağazanız"}
              previewUrl={`/s/${slug}`}
              pending={saveMutation.isPending}
              setTemplateKey={setTemplateKey}
              updateSeo={updateSeo}
              updateTemplate={updateTemplate}
              save={() => saveMutation.mutate()}
            />
          </TabsContent>

          <TabsContent value="urls">
            <SeoUrlsTab
              current={current}
              storeSlug={slug}
              updateSeo={updateSeo}
              save={() => saveMutation.mutate()}
              pending={saveMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="redirects">
            <SeoRedirectsTab
              rows={redirects ?? []}
              source={source}
              target={target}
              code={code}
              setSource={setSource}
              setTarget={setTarget}
              setCode={setCode}
              add={() => redirectMutation.mutate()}
              remove={(id) => deleteMutation.mutate(id)}
              pending={redirectMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="errors">
            <SeoErrorsTab
              rows={errors404 ?? []}
              targets={errorTargets}
              setTarget={(id, value) =>
                setErrorTargets((old) => ({ ...old, [id]: value }))
              }
              create={(id, path) => errorMutation.mutate({ id, path })}
              pending={errorMutation.isPending}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
