import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ExternalLink, FileWarning, Link2, Plus, Search, Settings2, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/mefti";
import { storePagesQuery } from "@/lib/pages-queries";
import { seo404Query, seoRedirectsQuery, type Seo404, type SeoRedirect } from "@/lib/seo-management-queries";
import { createRedirectFrom404, deleteSeoRedirect, upsertSeoRedirect } from "@/lib/seo-management.functions";
import { readStoreSeo, serpPreview, type SeoTemplate, type StoreSeoSettings } from "@/lib/seo";
import { saveStoreSeo } from "@/lib/seo.functions";
import { storeSeoAuditQuery } from "@/lib/seo-queries";
import { storeDomainsQuery, storeQuery, storeSettingsQuery } from "@/lib/store-queries";
import { storeThemeQuery } from "@/lib/theme-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/seo")({
  head: () => ({ meta: [
    { title: "SEO Merkezi — Mefticaret" },
    { name: "description", content: "Meta şablonları, URL yapısı, yönlendirmeler, 404 kayıtları ve mağaza SEO sağlığını tek merkezden yönetin." },
    { property: "og:title", content: "SEO Merkezi — Mefticaret" },
    { property: "og:description", content: "Mağazanızın arama motoru görünürlüğünü gerçek verilerle yönetin." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: SeoAuditPage,
});

type Check = { id: string; label: string; hint: string; ok: boolean; to?: string };
type TemplateKey = "product" | "collection" | "page" | "blog";
const templateLabels: Record<TemplateKey, string> = { product: "Ürün", collection: "Koleksiyon", page: "Sayfa", blog: "Blog" };
const templateDefaults: Record<TemplateKey, SeoTemplate> = {
  product: { title: "{{product_name}} | {{store_name}}", description: "{{product_name}} ürününü {{store_name}} mağazasında keşfedin. Hızlı kargo ve güvenli ödeme seçenekleri." },
  collection: { title: "{{collection_name}} | {{store_name}}", description: "{{store_name}} içinde {{collection_name}} koleksiyonunu keşfedin." },
  page: { title: "{{page_title}} | {{store_name}}", description: "{{page_excerpt}}" },
  blog: { title: "{{page_title}} | {{store_name}} Blog", description: "{{page_excerpt}}" },
};

function SeoAuditPage() {
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
  const saveSeo = useServerFn(saveStoreSeo);
  const saveRedirect = useServerFn(upsertSeoRedirect);
  const removeRedirect = useServerFn(deleteSeoRedirect);
  const makeRedirect = useServerFn(createRedirectFrom404);
  const [tab, setTab] = useState("overview");
  const [draft, setDraft] = useState<StoreSeoSettings>({});
  const [templateKey, setTemplateKey] = useState<TemplateKey>("product");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [code, setCode] = useState<"301" | "302">("301");
  const [errorTargets, setErrorTargets] = useState<Record<string, string>>({});
  const seo = useMemo(() => readStoreSeo(settings?.seo), [settings?.seo]);
  const current = Object.keys(draft).length ? draft : seo;
  const updateSeo = (patch: Partial<StoreSeoSettings>) => setDraft((old) => ({ ...current, ...patch }));
  const updateTemplate = (field: "title" | "description", value: string) => {
    const templates = { ...(current.templates ?? {}) };
    templates[templateKey] = { ...(templates[templateKey] ?? templateDefaults[templateKey]), [field]: value };
    updateSeo({ templates });
  };
  const checks = useMemo<Check[]>(() => {
    const active = (products ?? []).filter((p) => p.status === "active");
    return [
      { id: "title", label: "Mağaza SEO başlığı tanımlı", hint: "60 karakteri aşmayan bir başlık girin.", ok: Boolean(seo.homeTitle && seo.homeTitle.length > 3) },
      { id: "description", label: "Mağaza meta açıklaması tanımlı", hint: "160 karaktere kadar açıklayıcı bir metin ekleyin.", ok: Boolean(seo.homeDescription && seo.homeDescription.length > 20) },
      { id: "contact", label: "İletişim bilgileri dolu", hint: "İletişim bilgileri güven sinyalini destekler.", ok: Boolean(settings?.contact_email), to: `/store/${storeId}/settings` },
      { id: "theme", label: "Tema yayınlanmış", hint: "Vitrin yayınlanmadan sayfalar taranamaz.", ok: Boolean(theme?.is_published), to: `/store/${storeId}/themes` },
      { id: "hero", label: "Vitrin başlığı özelleştirilmiş", hint: "Ana sayfa H1 metninizi markanıza göre düzenleyin.", ok: Boolean(theme?.hero_title && theme.hero_title.length > 8), to: `/store/${storeId}/themes` },
      { id: "products", label: "En az 3 aktif ürün var", hint: "Aktif ürünler sitemap verisini besler.", ok: active.length >= 3, to: `/store/${storeId}/products` },
      { id: "pages", label: "Kurumsal sayfa yayında", hint: "İade, gizlilik veya hakkımızda sayfası ekleyin.", ok: (pages ?? []).some((p) => p.is_published), to: `/store/${storeId}/pages` },
      { id: "domain", label: "Doğrulanmış alan adı", hint: "Kendi alan adınız marka görünürlüğünü artırır.", ok: (domains ?? []).some((d) => d.status === "verified"), to: `/store/${storeId}/domains` },
    ];
  }, [domains, pages, products, seo, settings?.contact_email, storeId, theme]);
  const issues = useMemo(() => (products ?? []).filter((p) => p.status === "active").map((p) => {
    const list: string[] = [];
    if (!p.seo?.description || p.seo.description.length < 40) list.push("Meta açıklama eksik");
    if (!p.seo?.title || p.seo.title.length < 5) list.push("SEO başlığı eksik");
    if (!p.description || p.description.replace(/<[^>]*>/g, "").trim().length < 80) list.push("Açıklama kısa");
    if (p.imageCount === 0) list.push("Görsel yok");
    if (p.slug.length > 70) list.push("URL çok uzun");
    return { ...p, issues: list };
  }).filter((p) => p.issues.length).sort((a, b) => b.issues.length - a.issues.length), [products]);
  const activeCount = (products ?? []).filter((p) => p.status === "active").length;
  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round(((passed / checks.length) * 0.6 + (activeCount ? Math.max(activeCount - issues.length, 0) / activeCount : 0) * 0.4) * 100);
  const preview = serpPreview(current.homeTitle || store?.name || "Mağazanız", current.homeDescription || "Mağazanız için açıklama ekleyin.", `/s/${store?.slug ?? "magazaniz"}`);
  const saveMutation = useMutation({
    mutationFn: () => saveSeo({ data: { storeId, homeTitle: current.homeTitle, homeDescription: current.homeDescription, keywords: current.keywords, defaultOgImage: current.defaultOgImage, noindexStore: current.noindexStore, robotsExtra: current.robotsExtra, urlStructure: current.urlStructure, templates: current.templates } }),
    onSuccess: async () => { setDraft({}); await client.invalidateQueries({ queryKey: ["store-settings", storeId] }); toast.success("SEO ayarları kaydedildi"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const redirectMutation = useMutation({
    mutationFn: () => saveRedirect({ data: { storeId, sourcePath: source, targetPath: target, statusCode: Number(code) as 301 | 302, isActive: true } }),
    onSuccess: async () => { setSource(""); setTarget(""); await client.invalidateQueries({ queryKey: ["seo-redirects", storeId] }); toast.success("Yönlendirme kaydedildi"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeRedirect({ data: { storeId, id } }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["seo-redirects", storeId] }); toast.success("Yönlendirme silindi"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const errorMutation = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) => makeRedirect({ data: { storeId, id, targetPath: path } }),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["seo-redirects", storeId] }); toast.success("404 kaydından 301 oluşturuldu"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return <AppShell storeId={storeId} title="SEO Merkezi" description="Arama görünürlüğü, meta şablonları ve teknik SEO operasyonları.">
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Görünürlük operasyonu</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">SEO Merkezi</h1><p className="mt-1 text-sm text-muted-foreground">İçerik, teknik yapı ve hata takibini tek merkezden yönetin.</p></div>{store?.slug ? <Button asChild variant="outline" className="gap-2"><a href={`/api/public/sitemap/${store.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Sitemap&apos;i görüntüle</a></Button> : null}</header>
      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1"><TabsTrigger value="overview" className="gap-2"><ShieldCheck className="h-4 w-4" /> Genel bakış</TabsTrigger><TabsTrigger value="meta" className="gap-2"><Settings2 className="h-4 w-4" /> Meta şablonları</TabsTrigger><TabsTrigger value="urls" className="gap-2"><Link2 className="h-4 w-4" /> URL yapısı</TabsTrigger><TabsTrigger value="redirects" className="gap-2"><Link2 className="h-4 w-4" /> 301 / 302</TabsTrigger><TabsTrigger value="errors" className="gap-2"><FileWarning className="h-4 w-4" /> 404 izleme</TabsTrigger></TabsList>
        <TabsContent value="overview"><Overview checks={checks} score={score} passed={passed} active={activeCount} issueCount={issues.length} issues={issues} loading={isLoading} storeId={storeId} /></TabsContent>
        <TabsContent value="meta" className="grid gap-6 xl:grid-cols-[1fr_360px]"><Meta current={current} templateKey={templateKey} template={current.templates?.[templateKey] ?? templateDefaults[templateKey]} preview={preview} pending={saveMutation.isPending} setTemplateKey={setTemplateKey} updateSeo={updateSeo} updateTemplate={updateTemplate} save={() => saveMutation.mutate()} /></TabsContent>
        <TabsContent value="urls"><Urls current={current} updateSeo={updateSeo} save={() => saveMutation.mutate()} pending={saveMutation.isPending} /></TabsContent>
        <TabsContent value="redirects"><Redirects rows={redirects ?? []} source={source} target={target} code={code} setSource={setSource} setTarget={setTarget} setCode={setCode} add={() => redirectMutation.mutate()} pending={redirectMutation.isPending} remove={(id) => deleteMutation.mutate(id)} /></TabsContent>
        <TabsContent value="errors"><Errors rows={errors404 ?? []} targets={errorTargets} setTarget={(id, value) => setErrorTargets((old) => ({ ...old, [id]: value }))} create={(id, path) => errorMutation.mutate({ id, path })} pending={errorMutation.isPending} /></TabsContent>
      </Tabs>
    </div>
  </AppShell>;
}

function Metric({ label, value, hint, children }: { label: string; value: string; hint?: string; children?: ReactNode }) { return <div className="surface-card p-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-semibold">{value}</p>{children}{hint ? <p className="mt-2 text-sm text-muted-foreground">{hint}</p> : null}</div>; }
function Overview({ checks, score, passed, active, issueCount, issues, loading, storeId }: { checks: Check[]; score: number; passed: number; active: number; issueCount: number; issues: Array<{ id: string; title: string; slug: string; issues: string[] }>; loading: boolean; storeId: string }) { return <div className="space-y-6"><section className="grid gap-4 md:grid-cols-3"><Metric label="SEO skoru" value={`${score}/100`}><Progress value={score} className="mt-3" /></Metric><Metric label="Mağaza kontrolleri" value={`${passed}/${checks.length}`} hint="tamamlandı" /><Metric label="Eksiği olan ürün" value={formatNumber(issueCount)} hint={`${formatNumber(active)} aktif ürün içinde`} /></section><section className="surface-card"><div className="border-b px-5 py-4"><h2 className="font-medium">Mağaza kontrolleri</h2></div><ul className="divide-y">{checks.map((c) => <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3">{c.ok ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <TriangleAlert className="h-5 w-5 text-destructive" />}<div className="min-w-[220px] flex-1"><p className="text-sm font-medium">{c.label}</p>{!c.ok ? <p className="text-xs text-muted-foreground">{c.hint}</p> : null}</div>{!c.ok && c.to ? <Button asChild size="sm" variant="outline"><Link to={c.to}>Düzelt</Link></Button> : <Badge variant="secondary">Tamam</Badge>}</li>)}</ul></section><section className="surface-card"><div className="flex items-center gap-2 border-b px-5 py-4"><Search className="h-4 w-4 text-muted-foreground" /><h2 className="font-medium">Ürün sayfası eksikleri</h2></div>{loading ? <div className="space-y-2 p-5"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div> : issues.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Aktif ürünlerin tümü temel SEO kontrollerini geçiyor.</p> : <ul className="divide-y">{issues.slice(0, 50).map((p) => <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3"><div className="min-w-[220px] flex-1"><p className="text-sm font-medium">{p.title}</p><p className="text-xs text-muted-foreground">/{p.slug}</p></div><div className="flex flex-wrap gap-1">{p.issues.map((issue) => <Badge key={issue} variant="outline" className="text-xs">{issue}</Badge>)}</div><Button asChild size="sm" variant="outline"><Link to="/store/$storeId/products/$productId" params={{ storeId, productId: p.id }}>Düzenle</Link></Button></li>)}</ul>}</section></div>; }

function Meta({ current, templateKey, template, preview, pending, setTemplateKey, updateSeo, updateTemplate, save }: { current: StoreSeoSettings; templateKey: TemplateKey; template: SeoTemplate; preview: ReturnType<typeof serpPreview>; pending: boolean; setTemplateKey: (key: TemplateKey) => void; updateSeo: (patch: Partial<StoreSeoSettings>) => void; updateTemplate: (field: "title" | "description", value: string) => void; save: () => void }) { return <><div className="space-y-6"><section className="surface-card space-y-5 p-6"><div><p className="eyebrow">Ana sayfa</p><h2 className="mt-1 font-display text-lg font-semibold">Arama sonucu bilgileri</h2></div><Field label="Ana sayfa başlığı" id="seo-home-title"><Input id="seo-home-title" maxLength={60} value={current.homeTitle ?? ""} onChange={(e) => updateSeo({ homeTitle: e.target.value })} placeholder="Mağazanız | Kısa değer önerisi" /></Field><Field label="Meta açıklaması" id="seo-home-description"><Textarea id="seo-home-description" maxLength={160} rows={4} value={current.homeDescription ?? ""} onChange={(e) => updateSeo({ homeDescription: e.target.value })} placeholder="Mağazanızı ve ürünlerinizi kısaca anlatın." /></Field><Field label="Anahtar kelimeler" id="seo-keywords"><Input id="seo-keywords" value={current.keywords ?? ""} onChange={(e) => updateSeo({ keywords: e.target.value })} placeholder="spor ayakkabı, online mağaza" /></Field><Field label="Varsayılan sosyal görseli" id="seo-og-image"><Input id="seo-og-image" type="url" value={current.defaultOgImage ?? ""} onChange={(e) => updateSeo({ defaultOgImage: e.target.value })} placeholder="https://..." /></Field><div className="flex items-center justify-between rounded-lg border border-border p-3"><div><p className="text-sm font-medium">Mağazayı arama motorlarından gizle</p><p className="text-xs text-muted-foreground">Hazırlık aşamasında kullanın.</p></div><Switch checked={Boolean(current.noindexStore)} onCheckedChange={(v) => updateSeo({ noindexStore: v })} /></div><Button onClick={save} disabled={pending}>{pending ? "Kaydediliyor..." : "SEO ayarlarını kaydet"}</Button></section><section className="surface-card space-y-5 p-6"><div><p className="eyebrow">Dinamik içerik</p><h2 className="mt-1 font-display text-lg font-semibold">Meta şablonları</h2><p className="mt-1 text-sm text-muted-foreground">Değişkenler yayınlanan sayfalarda gerçek verilerle doldurulur.</p></div><Select value={templateKey} onValueChange={(v) => setTemplateKey(v as TemplateKey)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(templateLabels) as TemplateKey[]).map((key) => <SelectItem key={key} value={key}>{templateLabels[key]} sayfaları</SelectItem>)}</SelectContent></Select><Field label="Başlık şablonu" id="seo-template-title"><Input id="seo-template-title" value={template.title ?? ""} onChange={(e) => updateTemplate("title", e.target.value)} /></Field><Field label="Açıklama şablonu" id="seo-template-description"><Textarea id="seo-template-description" rows={4} value={template.description ?? ""} onChange={(e) => updateTemplate("description", e.target.value)} /></Field><p className="text-xs text-muted-foreground">Değişkenler: {