import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, Search, TriangleAlert } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { storePagesQuery } from "@/lib/pages-queries";
import { storeSeoAuditQuery } from "@/lib/seo-queries";
import {
  storeDomainsQuery,
  storeQuery,
  storeSettingsQuery,
} from "@/lib/store-queries";
import { storeThemeQuery } from "@/lib/theme-queries";
import { formatNumber } from "@/lib/mefti";

export const Route = createFileRoute("/_authenticated/store/$storeId/seo")({
  head: () => ({
    meta: [
      { title: "SEO Denetimi — Mefticaret" },
      {
        name: "description",
        content:
          "Mağaza ve ürün sayfalarınızın SEO sağlığını puanlayın: eksik meta açıklamalar, görseller, alan adı ve içerik kontrolleri.",
      },
      { property: "og:title", content: "SEO Denetimi — Mefticaret" },
      {
        property: "og:description",
        content: "Arama motoru görünürlüğünüzü artıracak eksikleri tek ekranda görün.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SeoAuditPage,
});

type Check = {
  id: string;
  label: string;
  hint: string;
  ok: boolean;
  to?: string;
};

function SeoAuditPage() {
  const { storeId } = Route.useParams();

  const { data: store } = useQuery(storeQuery(storeId));
  const { data: settings } = useQuery(storeSettingsQuery(storeId));
  const { data: theme } = useQuery(storeThemeQuery(storeId));
  const { data: pages } = useQuery(storePagesQuery(storeId));
  const { data: domains } = useQuery(storeDomainsQuery(storeId));
  const { data: products, isLoading } = useQuery(storeSeoAuditQuery(storeId));

  const storeSeo = (settings?.seo ?? null) as { title?: string; description?: string } | null;

  const checks = useMemo<Check[]>(() => {
    const activeProducts = (products ?? []).filter((p) => p.status === "active");
    const publishedPages = (pages ?? []).filter((p) => p.is_published);
    const verifiedDomain = (domains ?? []).some((d) => d.status === "verified");

    return [
      {
        id: "store-title",
        label: "Mağaza SEO başlığı tanımlı",
        hint: "Ayarlar > SEO alanından 60 karakteri aşmayan bir başlık girin.",
        ok: Boolean(storeSeo?.title && storeSeo.title.trim().length > 3),
        to: `/store/${storeId}/settings`,
      },
      {
        id: "store-description",
        label: "Mağaza meta açıklaması tanımlı",
        hint: "160 karaktere kadar, mağazanızı özetleyen bir açıklama ekleyin.",
        ok: Boolean(storeSeo?.description && storeSeo.description.trim().length > 20),
        to: `/store/${storeId}/settings`,
      },
      {
        id: "contact",
        label: "İletişim bilgileri dolu",
        hint: "E-posta ve telefon, güven sinyali olarak arama sonuçlarını destekler.",
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
        hint: "Ana sayfadaki H1 metni markanızı ve ana anahtar kelimenizi içermeli.",
        ok: Boolean(theme?.hero_title && theme.hero_title.trim().length > 8),
        to: `/store/${storeId}/themes`,
      },
      {
        id: "products",
        label: "En az 3 aktif ürün var",
        hint: "Aktif ürünler sitemap ve ürün yapılandırılmış verisini besler.",
        ok: activeProducts.length >= 3,
        to: `/store/${storeId}/products`,
      },
      {
        id: "pages",
        label: "Yasal / kurumsal sayfa yayında",
        hint: "İade, gizlilik ve hakkımızda sayfaları güven ve SEO için gereklidir.",
        ok: publishedPages.length >= 1,
        to: `/store/${storeId}/pages`,
      },
      {
        id: "domain",
        label: "Doğrulanmış alan adı",
        hint: "Kendi alan adınız marka aramalarında görünürlüğü artırır.",
        ok: verifiedDomain,
        to: `/store/${storeId}/domains`,
      },
    ];
  }, [domains, pages, products, settings, storeId, storeSeo, theme]);

  const productIssues = useMemo(() => {
    return (products ?? [])
      .filter((p) => p.status === "active")
      .map((product) => {
        const issues: string[] = [];
        const metaDescription = product.seo?.description ?? "";
        if (!metaDescription || metaDescription.trim().length < 40) issues.push("Meta açıklama eksik");
        if (!product.seo?.title || product.seo.title.trim().length < 5) issues.push("SEO başlığı eksik");
        if (!product.description || product.description.replace(/<[^>]*>/g, "").trim().length < 80)
          issues.push("Ürün açıklaması kısa");
        if (product.imageCount === 0) issues.push("Görsel yok");
        if (product.slug.length > 70) issues.push("URL çok uzun");
        return { ...product, issues };
      })
      .filter((product) => product.issues.length > 0)
      .sort((a, b) => b.issues.length - a.issues.length);
  }, [products]);

  const passed = checks.filter((c) => c.ok).length;
  const activeCount = (products ?? []).filter((p) => p.status === "active").length;
  const healthyProducts = Math.max(activeCount - productIssues.length, 0);
  const score = Math.round(
    ((passed / checks.length) * 0.6 + (activeCount ? healthyProducts / activeCount : 0) * 0.4) * 100,
  );

  return (
    <AppShell storeId={storeId} title="SEO Denetimi">
      <div className="space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">SEO Denetimi</h1>
            <p className="text-sm text-muted-foreground">
              Vitrininizin arama motoru sağlığını puanlayın ve eksikleri tek tek kapatın.
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

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">SEO Skoru</p>
            <p className="mt-1 text-3xl font-semibold">{score}/100</p>
            <Progress value={score} className="mt-3" />
          </div>
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Mağaza kontrolleri</p>
            <p className="mt-1 text-3xl font-semibold">
              {passed}/{checks.length}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">tamamlandı</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Eksiği olan ürün</p>
            <p className="mt-1 text-3xl font-semibold">{formatNumber(productIssues.length)}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatNumber(activeCount)} aktif ürün içinde
            </p>
          </div>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="font-medium">Mağaza kontrolleri</h2>
          </div>
          <ul className="divide-y">
            {checks.map((check) => (
              <li key={check.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                {check.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <TriangleAlert className="h-5 w-5 text-destructive" />
                )}
                <div className="min-w-[220px] flex-1">
                  <p className="text-sm font-medium">{check.label}</p>
                  {!check.ok ? (
                    <p className="text-xs text-muted-foreground">{check.hint}</p>
                  ) : null}
                </div>
                {!check.ok && check.to ? (
                  <Button asChild size="sm" variant="outline">
                    <Link to={check.to}>Düzelt</Link>
                  </Button>
                ) : (
                  <Badge variant="secondary">Tamam</Badge>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-medium">Ürün sayfası eksikleri</h2>
          </div>
          {isLoading ? (
            <div className="space-y-2 p-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : productIssues.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              Harika — aktif ürünlerin tümü temel SEO kontrollerini geçiyor.
            </p>
          ) : (
            <ul className="divide-y">
              {productIssues.slice(0, 50).map((product) => (
                <li key={product.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-[220px] flex-1">
                    <p className="text-sm font-medium">{product.title}</p>
                    <p className="text-xs text-muted-foreground">/{product.slug}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {product.issues.map((issue) => (
                      <Badge key={issue} variant="outline" className="text-xs">
                        {issue}
                      </Badge>
                    ))}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/store/$storeId/products/$productId"
                      params={{ storeId, productId: product.id }}
                    >
                      Düzenle
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
