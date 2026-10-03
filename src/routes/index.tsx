import { createFileRoute } from "@tanstack/react-router";

import { LANDING_ALTERNATES } from "@/components/global-landing";
import { PlatformHome } from "@/components/platform-home";
import { supabase } from "@/integrations/supabase/client";


import { siteSectionsQuery } from "@/lib/site-content";
import { fetchHomeSeo } from "@/lib/seo-ai.functions";
import { plansQuery } from "@/lib/store-queries";

const FALLBACK_TITLE = "Mefticaret — Online Mağaza Kur, Pazaryerlerinde Sat";
const FALLBACK_DESCRIPTION =
  "Mefticaret ile dakikalar içinde online mağazanı aç; ürün, sipariş, ödeme, kargo ve pazaryeri satışlarını tek panelden yönet.";

type PlanOffer = { name: string; price: number; currency: string };

async function loadPlanOffers(): Promise<PlanOffer[]> {
  try {
    const { data, error } = await supabase
      .from("plans")
      .select("name, price_monthly, currency, is_active, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error || !data) return [];
    return data
      .filter((plan) => Number(plan.price_monthly) > 0)
      .map((plan) => ({
        name: plan.name as string,
        price: Number(plan.price_monthly),
        currency: (plan.currency as string) || "TRY",
      }));
  } catch {
    return [];
  }
}

type FaqItem = { q: string; a: string };

async function loadFaqItems(): Promise<FaqItem[]> {
  try {
    const { data, error } = await supabase
      .from("site_sections" as never)
      .select("items, is_enabled")
      .eq("section_key", "faq")
      .maybeSingle();
    if (error || !data) return [];
    const row = data as unknown as { items?: { q?: string; a?: string }[]; is_enabled?: boolean };
    if (row.is_enabled === false) return [];
    return (row.items ?? [])
      .filter((item) => item?.q && item?.a)
      .map((item) => ({ q: String(item.q), a: String(item.a) }));
  } catch {
    return [];
  }
}

function withTimeout<T>(p: Promise<T>, fallback: T, ms = 1500): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    // Hero/başlık metni sunucuda hazır gelsin (mobil LCP): bölümler loader'da önceden yüklenir.
    const [homeSeo, planOffers, faqItems] = await Promise.all([
      withTimeout(fetchHomeSeo(), null as Awaited<ReturnType<typeof fetchHomeSeo>> | null),
      withTimeout(loadPlanOffers(), [] as PlanOffer[]),
      withTimeout(loadFaqItems(), [] as FaqItem[]),
      withTimeout(context.queryClient.ensureQueryData(siteSectionsQuery()).then(() => null), null),
      withTimeout(context.queryClient.ensureQueryData(plansQuery()).then(() => null), null),
    ]);
    return { homeSeo, planOffers, faqItems };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.homeSeo?.title || FALLBACK_TITLE },
      { name: "description", content: loaderData?.homeSeo?.description || FALLBACK_DESCRIPTION },
      { property: "og:title", content: loaderData?.homeSeo?.title || FALLBACK_TITLE },
      { property: "og:description", content: loaderData?.homeSeo?.description || FALLBACK_DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://mefticaret.com/" },
      { property: "og:image", content: "https://mefticaret.com/og-mefticaret.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://mefticaret.com/og-mefticaret.jpg" },
    ],
    links: [
      { rel: "canonical", href: "https://mefticaret.com/" },
      ...LANDING_ALTERNATES.map((alt) => ({ rel: "alternate", hrefLang: alt.hrefLang, href: alt.href })),
      { rel: "alternate", hrefLang: "x-default", href: "https://mefticaret.com/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Mefticaret",
          applicationCategory: "BusinessApplication",
          applicationSubCategory: "E-commerce",
          operatingSystem: "Web",
          url: "https://mefticaret.com/",
          image: "https://mefticaret.com/og-mefticaret.jpg",
          description: loaderData?.homeSeo?.description || FALLBACK_DESCRIPTION,
          inLanguage: "tr-TR",
          publisher: { "@type": "Organization", name: "Mefticaret" },
          ...(loaderData?.planOffers?.[0]
            ? {
                offers: {
                  "@type": "AggregateOffer",
                  priceCurrency: loaderData.planOffers[0].currency,
                  lowPrice: Math.min(...loaderData.planOffers.map((plan) => plan.price)),
                  highPrice: Math.max(...loaderData.planOffers.map((plan) => plan.price)),
                  offerCount: loaderData.planOffers.length,
                  offers: loaderData.planOffers.map((plan) => ({
                    "@type": "Offer",
                    name: plan.name,
                    price: plan.price,
                    priceCurrency: plan.currency,
                    url: "https://mefticaret.com/#fiyatlandirma",
                    availability: "https://schema.org/InStock",
                  })),
                },
              }
            : {}),
        }),
      },
      ...((loaderData?.faqItems?.length ?? 0) > 0
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: loaderData!.faqItems.map((item) => ({
                  "@type": "Question",
                  name: item.q,
                  acceptedAnswer: { "@type": "Answer", text: item.a },
                })),
              }),
            },
          ]
        : []),
    ],
  }),
  errorComponent: () => (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Sayfa şu anda yüklenemedi</h1>
      <p className="mt-2 text-muted-foreground">Lütfen birkaç saniye sonra tekrar deneyin.</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Sayfa bulunamadı</h1>
    </main>
  ),
  component: () => <PlatformHome locale="tr" />,
});

