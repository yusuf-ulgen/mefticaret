import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { PolicyArticle } from "@/components/policy-view";
import { getStorePublicPolicy } from "@/lib/policies-public.functions";
import { notFound } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { StorefrontChrome } from "@/components/storefront-chrome";
import { Breadcrumb, InfoSections, StorefrontFallback } from "@/components/storefront-parts";
import { getRequestOrigin } from "@/lib/origin.functions";
import { faqSchema } from "@/lib/seo";
import { getStoreSeoContext, type StoreSeoContext } from "@/lib/seo-public.functions";
import { storefrontQuery } from "@/lib/storefront-queries";
import { missingHead, storefrontHead } from "@/lib/storefront-seo";

export type InfoContent = {
  title: string;
  description: string;
  intro: string;
  sections: { heading: string; body: string }[];
  /** Sayfanın vitrin rota adı (canonical adres için). */
  route: string;
  /** İçerik soru-cevap ise FAQPage yapısal verisi üretilir. */
  faq?: boolean;
};

type InfoLoaderData = {
  storeName: string;
  ctx: StoreSeoContext | null;
  origin: string;
};

/** Bilgi sayfaları için ortak loader: mağaza + SEO bağlamı + istek kökü. */
export async function infoLoader(queryClient: QueryClient, slug: string): Promise<InfoLoaderData> {
  const [data, ctx, origin] = await Promise.all([
    queryClient.ensureQueryData(storefrontQuery(slug)),
    getStoreSeoContext({ data: { slug } }),
    getRequestOrigin(),
  ]);
  if (!data) throw notFound();
  return { storeName: data.store.name, ctx, origin };
}

/** Bilgi sayfası head meta üreticisi: meta, canonical, OG/Twitter ve şemalar. */
export function infoHead(loaderData: InfoLoaderData | undefined, content: InfoContent, slug: string) {
  if (!loaderData) return missingHead("Mağaza bulunamadı");
  const base = `/s/${slug}`;
  const path = `${base}/${content.route}`;
  return storefrontHead({
    ctx: loaderData.ctx,
    origin: loaderData.origin,
    slug,
    path,
    fallbackTitle: content.title,
    fallbackDescription: content.description,
    breadcrumbs: [
      { name: "Ana sayfa", path: base },
      { name: content.title, path },
    ],
    schemas: content.faq
      ? [
          faqSchema(
            content.sections.map((section) => ({ question: section.heading, answer: section.body })),
          ),
        ]
      : [],
  });
}

/** Ortak bilgi sayfası gövdesi. */
export function InfoPage({
  slug,
  content,
  extra,
  policySlug,
}: {
  /** Mağaza bu politikayı Politika Sistemi'nden yayınladıysa o metin gösterilir. */
  policySlug?: string;
  slug: string;
  content: InfoContent;
  /** Sayfa altına eklenecek ek içerik (örn. KVKK veri talebi formu). */
  extra?: React.ReactNode;
}) {
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const published = useQuery({
    queryKey: ["store-policy", slug, policySlug],
    enabled: Boolean(policySlug),
    queryFn: () => getStorePublicPolicy({ data: { slug, policy: policySlug! } }),
  });
  const policy = published.data?.policy ?? null;
  if (!data) return <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme, footerPages } = data;
  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      <Breadcrumb theme={theme} slug={slug} storeName={store.name} current={content.title} />
      {policy ? (
        <PolicyArticle policy={policy} />
      ) : (
        <InfoSections theme={theme} title={content.title} intro={content.intro} sections={content.sections} />
      )}
      {extra ? <div className="mx-auto w-full max-w-3xl px-4 pb-12">{extra}</div> : null}
    </StorefrontChrome>
  );
}
