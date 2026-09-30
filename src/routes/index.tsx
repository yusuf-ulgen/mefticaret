import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Boxes, Check, Heart, Menu, MessageCircle, PackagePlus, Smartphone, X } from "lucide-react";

import gdprBadge from "@/assets/gdpr-badge.webp.asset.json";
import { CommerceFlowAnimation } from "@/components/commerce-flow-animation";
import { LandingGrowthSuite } from "@/components/landing-growth-suite";
import { LandingMegaMenu, LandingMobileMenu } from "@/components/landing-mega-menu";
import { PlatformLocaleSwitcher } from "@/components/platform-locale-switcher";
import { supabase } from "@/integrations/supabase/client";


import {
  AppShowcaseSection,
  BlogSection,
  FaqSection,
  IntegrationsSection,
  PlatformCapabilitiesSection,
} from "@/components/landing-sections";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { formatMoney, planLimitLabel } from "@/lib/mefti";
import { pickSection, sectionIcon, siteSectionsQuery, type SiteSection } from "@/lib/site-content";
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
    links: [{ rel: "canonical", href: "https://mefticaret.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Mefticaret",
          applicationCategory: "BusinessApplication",
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
  component: LandingPage,
});

function ShowcaseCard({ title, price }: { title?: string | undefined; price?: string | undefined }) {
  return (
    <article className="showcase-card">
      <div
        className="h-40 w-full"
        style={{
          background:
            "linear-gradient(150deg, color-mix(in oklab, var(--color-brand) 14%, var(--color-card)), var(--color-muted))",
        }}
      />
      <div className="p-4">
        <h3 className="text-sm font-semibold leading-snug">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{price}</p>
      </div>
    </article>
  );
}

function ShowcaseColumn({
  items,
  slow,
  className,
}: {
  items: Record<string, string>[];
  slow?: boolean;
  className?: string;
}) {
  if (items.length === 0) return null;
  const loop = [...items, ...items, ...items];
  return (
    <div className={`fade-mask-y h-[560px] overflow-hidden ${className ?? ""}`} aria-hidden="true">
      <div className={`space-y-4 ${slow ? "marquee-col-slow" : "marquee-col"}`}>
        {loop.map((item, index) => (
          <ShowcaseCard key={`${item["title"]}-${index}`} title={item["title"]} price={item["price"]} />
        ))}
      </div>
    </div>
  );
}

/** Panelden yönetilen bağlantılar serbest metin olduğu için standart <a> kullanılır. */
function LinkButton({
  href,
  label,
  variant,
  size,
  children,
}: {
  href?: string | null;
  label?: string | null;
  variant?: "default" | "outline" | "ghost";
  size?: "lg";
  children?: React.ReactNode;
}) {
  if (!label) return null;
  return (
    <Button asChild variant={variant ?? "default"} size={size} className="rounded-full">
      <a href={href || "/auth"}>
        {label}
        {children}
      </a>
    </Button>
  );
}

function LandingPage() {
  const { session, loading } = useAuth();
  const { data: plans } = useQuery(plansQuery());
  const { data: sections } = useQuery(siteSectionsQuery());

  const get = (key: string): SiteSection | null => pickSection(sections, key);
  const header = get("header");
  const mega = get("header_mega");
  const [mobileOpen, setMobileOpen] = useState(false);
  const hero = get("hero");
  const modules = get("modules");
  const pricing = get("pricing");
  const [planInterval, setPlanInterval] = useState<"monthly" | "yearly">("monthly");

  const cta = get("cta");
  const footer = get("footer");

  const footerGroups = (footer?.items ?? []).reduce<Record<string, Record<string, string>[]>>(
    (acc, item) => {
      const group = item["group"] || "Bağlantılar";
      acc[group] = [...(acc[group] ?? []), item];
      return acc;
    },
    {},
  );

  return (
    <div className="min-h-screen bg-background">
      <a href="#icerik" className="skip-link">
        İçeriğe geç
      </a>

      {header ? (
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto grid min-h-18 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 md:flex md:gap-4 lg:px-8">
            <Link to="/" className="min-w-0 truncate font-display text-xl font-extrabold tracking-tighter sm:text-2xl">
              {header.title}
            </Link>

            <div className="mx-auto hidden md:block">
              {mega && mega.items.length ? (
                <LandingMegaMenu section={mega} extraLinks={header.items} />
              ) : (
                <nav
                  aria-label="Ana gezinme"
                  className="flex items-center gap-8 text-sm font-medium text-muted-foreground"
                >
                  {header.items.map((item, index) => (
                    <a
                      key={`${item["label"]}-${index}`}
                      href={item["href"] || "#"}
                      className="transition-colors hover:text-foreground"
                    >
                      {item["label"]}
                    </a>
                  ))}
                </nav>
              )}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <PlatformLocaleSwitcher active="tr" />
              {loading ? null : session ? (
                <Button asChild className="rounded-full px-5">
                  <Link to="/stores">Panele git</Link>
                </Button>
              ) : (
                <>
                   <span className="hidden sm:inline-flex">
                     <LinkButton
                       href={header.secondary_href}
                       label={header.secondary_label}
                       variant="ghost"
                     />
                   </span>
                   <span className="hidden min-[360px]:inline-flex">
                     <LinkButton href={header.primary_href} label={header.primary_label} />
                   </span>
                </>
              )}
              <Button
                variant="outline"
                size="icon"
                className="rounded-full md:hidden"
                aria-label={mobileOpen ? "Menüyü kapat" : "Menüyü aç"}
                aria-expanded={mobileOpen}
                aria-controls="mobil-ana-menu"
                onClick={() => setMobileOpen((value) => !value)}
              >
                {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              </Button>
            </div>
          </div>

          <LandingMobileMenu
            section={mega}
            extraLinks={header.items}
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
          />
        </header>
      ) : null}


      <main id="icerik" tabIndex={-1}>
        {hero ? (
          <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
            <div className="mx-auto max-w-7xl px-4 py-16 text-center lg:px-8 lg:py-24">
              <div className="mx-auto max-w-3xl">
                {hero.eyebrow ? <span className="eyebrow">{hero.eyebrow}</span> : null}
                <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
                  {hero.title}
                </h1>
                <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
                  {hero.subtitle}
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <LinkButton
                    href={hero.secondary_href}
                    label={hero.secondary_label}
                    variant="outline"
                    size="lg"
                  />
                  <LinkButton href={hero.primary_href} label={hero.primary_label} size="lg">
                    <ArrowRight className="ml-2 size-4" />
                  </LinkButton>
                </div>
                <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-muted-foreground">
                  {hero.items.map((item, index) => {
                    const Icon = sectionIcon(item["icon"]);
                    return (
                      <li key={`${item["label"]}-${index}`} className="flex items-center gap-2">
                        <Icon className="size-4 text-brand" />
                        {item["label"]}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        <section className="border-y border-border py-16 lg:py-24" aria-labelledby="satis-akisi">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-[minmax(0,1fr)_minmax(300px,400px)] lg:gap-20 lg:px-8">
            <div className="max-w-xl">
              <span className="eyebrow">Canlı Satış Akışı</span>
              <h2 id="satis-akisi" className="mt-5 text-3xl font-extrabold sm:text-4xl lg:text-5xl">
                Siparişten ödemeye, her adım tek yerde
              </h2>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                Ürün seçimi, güvenli ödeme ve sipariş bildirimi kesintisiz bir akışta ilerler.
              </p>
            </div>
            <CommerceFlowAnimation />
          </div>
        </section>

        <section className="border-y border-border bg-secondary/40 py-16 lg:py-20" aria-labelledby="evde-uretenler">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-8">
            <div>
              <span className="eyebrow">Evde Üretenlere Özel</span>
              <h2 id="evde-uretenler" className="mt-5 max-w-2xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">
                Ürettiklerinizi kolayca internette satın
              </h2>
              <p className="mt-5 max-w-xl leading-relaxed text-muted-foreground">
                Teknik bilgi gerekmeden ürün ekleyin, siparişlerinizi telefondan takip edin ve
                müşterilerinizle tek ekrandan iletişim kurun.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: Smartphone, label: "Telefona uygun Kolay Panel" },
                  { icon: PackagePlus, label: "Hızlı ürün ve sipariş yönetimi" },
                  { icon: Heart, label: "Evde üretime uygun sade kullanım" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 text-sm font-medium">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                      <item.icon className="size-4" />
                    </span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <article className="showcase-card p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="eyebrow">Kolay Başlangıç</span>
                  <h3 className="mt-3 text-2xl font-extrabold">Ücretsiz başlayın</h3>
                </div>
                <span className="rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                  Kredi kartı gerekmez
                </span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {["Mağazanızı kurun", "Ürünlerinizi ekleyin", "Kolay Panel’den siparişleri yönetin"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-3">
                      <Check className="size-4 shrink-0 text-success" />
                      {item}
                    </li>
                  ),
                )}
              </ul>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <Button asChild size="lg" className="rounded-full">
                  <Link to="/ev-hanimlari">
                    Ücretsiz başla <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full">
                  <Link to="/ev-hanimlari">
                    Kolay Panel girişi
                  </Link>
                </Button>
              </div>
              <div className="mt-4 border-t border-border pt-4 text-center">
                <Link
                  to="/auth"
                  search={{ mode: "login" }}
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Standart mağaza paneline giriş
                </Link>
              </div>
            </article>
          </div>
        </section>

        {modules ? (
          <section id="moduller" className="border-y border-border bg-secondary/40 py-20 lg:py-28">
            <div className="mx-auto max-w-7xl px-4 lg:px-8">
              <div className="text-center">
                {modules.eyebrow ? <span className="eyebrow">{modules.eyebrow}</span> : null}
                <h2 className="mx-auto mt-6 max-w-3xl text-3xl font-extrabold sm:text-4xl lg:text-5xl">
                  {modules.title}
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-muted-foreground">{modules.subtitle}</p>
              </div>
              <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {modules.items.map((module, index) => {
                  const Icon = sectionIcon(module["icon"]);
                  return (
                    <article key={`${module["title"]}-${index}`} className="showcase-card p-6">
                      <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
                        <Icon className="size-5" />
                      </span>
                      <h3 className="mt-5 text-base font-semibold">{module["title"]}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {module["text"]}
                      </p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        ) : null}

        <IntegrationsSection section={get("integrations")} />

        <PlatformCapabilitiesSection />

        <LandingGrowthSuite />

        <AppShowcaseSection />

        {pricing ? (
          <section id="paketler" className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
            <div className="text-center">
              {pricing.eyebrow ? <span className="eyebrow">{pricing.eyebrow}</span> : null}
              <h2 className="mt-6 text-3xl font-extrabold sm:text-4xl lg:text-5xl">{pricing.title}</h2>
              <p className="mx-auto mt-5 max-w-xl text-muted-foreground">{pricing.subtitle}</p>
              <div
                role="group"
                aria-label="Ödeme dönemi"
                className="mx-auto mt-8 inline-flex rounded-full border bg-card p-1"
              >
                {(["monthly", "yearly"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={planInterval === option}
                    onClick={() => setPlanInterval(option)}
                    className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                      planInterval === option
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {option === "monthly" ? "Aylık" : "Yıllık"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
              {(plans ?? []).map((plan) => {
                const limits = (plan.limits ?? {}) as Record<string, number>;
                const featured = plan.code === "professional";
                return (
                  <article
                    key={plan.id}
                    data-featured={featured}
                    className="showcase-card flex flex-col p-6 data-[featured=true]:border-brand data-[featured=true]:ring-1 data-[featured=true]:ring-brand/30"
                  >
                    <h3 className="text-base font-semibold">{plan.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{plan.description}</p>
                    <p className="mt-5 font-display text-2xl font-extrabold">
                      {(() => {
                        const price =
                          planInterval === "yearly"
                            ? Number(plan.price_yearly ?? 0)
                            : Number(plan.price_monthly ?? 0);
                        return price === 0
                          ? "Ücretsiz"
                          : formatMoney(price, plan.currency);
                      })()}
                      {(planInterval === "yearly"
                        ? Number(plan.price_yearly ?? 0)
                        : Number(plan.price_monthly ?? 0)) > 0 ? (
                        <span className="text-sm font-medium text-muted-foreground">
                          {planInterval === "yearly" ? "/yıl" : "/ay"}
                        </span>
                      ) : null}
                    </p>
                    {planInterval === "yearly" && Number(plan.price_yearly ?? 0) > 0 ? (
                      <p className="mt-1 text-xs text-success">
                        Aylık {formatMoney(Number(plan.price_yearly) / 12, plan.currency)} — yıllık
                        ödemede 2 ay avantaj
                      </p>
                    ) : null}

                    <ul className="mt-5 space-y-2 text-sm">
                      {[
                        [planLimitLabel(limits["products"]), "ürün"],
                        [planLimitLabel(limits["orders"]), "sipariş"],
                        [planLimitLabel(limits["staff"]), "personel"],
                        [planLimitLabel(limits["domains"]), "özel domain"],
                      ].map(([value, label]) => (
                        <li key={label} className="flex gap-2">
                          <Check className="mt-0.5 size-4 text-success" />
                          <span>
                            {value} {label}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {plan.trial_days > 0 ? (
                      <p className="mt-3 text-xs text-muted-foreground">{plan.trial_days} gün deneme</p>
                    ) : null}
                    <Button
                      asChild
                      className="mt-6 w-full rounded-full"
                      variant={featured ? "default" : "outline"}
                    >
                      <Link to="/auth" search={{ mode: "register" }}>
                        {pricing.primary_label ?? "Başla"}
                      </Link>
                    </Button>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <GuidesSection />

        <BlogSection section={get("blog")} />


        <FaqSection section={get("faq")} />

        <section className="border-y border-border bg-secondary/30 py-12" aria-labelledby="tedarikci-portali">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div className="flex max-w-2xl items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-brand">
                <Boxes className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow">İş ortakları</p>
                <h2 id="tedarikci-portali" className="mt-2 text-2xl font-bold sm:text-3xl">
                  Mefticaret tedarikçisi misiniz?
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Siparişlerinizi, ürün aktarımlarınızı, stok senkronunu ve hakedişlerinizi tedarikçi panelinden yönetin.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              <Button asChild className="rounded-full px-5">
                <Link to="/tedarikci-giris" search={{ mode: "login" }}>Tedarikçi girişi</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full px-5">
                <Link to="/tedarikci-giris" search={{ mode: "register" }}>Yeni kayıt</Link>
              </Button>
            </div>
          </div>
        </section>

        {cta ? (
          <section className="mx-auto max-w-7xl px-4 pb-24 lg:px-8">
            <div
              className="showcase-card px-6 py-14 text-center"
              style={{ background: "var(--gradient-hero)" }}
            >
              <h2 className="mx-auto max-w-2xl text-3xl font-extrabold sm:text-4xl">{cta.title}</h2>
              <p className="mx-auto mt-4 max-w-lg text-muted-foreground">{cta.subtitle}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <LinkButton href={cta.primary_href} label={cta.primary_label} size="lg">
                  <ArrowRight className="ml-2 size-4" />
                </LinkButton>
                <LinkButton
                  href={cta.secondary_href}
                  label={cta.secondary_label}
                  variant="outline"
                  size="lg"
                />
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <Link
        to="/mesajlar-giris"
        aria-label="Mefticaret Mesajlar"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:scale-105"
      >
        <MessageCircle className="h-5 w-5" />
        <span className="hidden sm:inline">Mesajlar</span>
      </Link>

      {footer ? (
        <footer className="border-t border-border py-14">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
              <div>
                <span className="font-display text-2xl font-extrabold tracking-tighter">
                  {footer.title}
                </span>
                <p className="mt-3 max-w-xs text-sm text-muted-foreground">{footer.subtitle}</p>
              </div>
              {Object.entries(footerGroups).map(([group, links]) => (
                <nav key={group} aria-label={group}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    {group}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    {links.map((link, index) => (
                      <li key={`${link["label"]}-${index}`}>
                        <a
                          href={link["href"] || "#"}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {link["label"]}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Başlayın
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <LinkButton href={footer.primary_href} label={footer.primary_label} />
                  <LinkButton
                    href={footer.secondary_href}
                    label={footer.secondary_label}
                    variant="outline"
                  />
                </div>
              </div>
            </div>
            <div className="mt-10 flex flex-col items-center gap-4 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:justify-between">
              <span>© {new Date().getFullYear()} Mefticaret</span>
              <img
                src={gdprBadge.url}
                alt="GDPR uyumlu"
                loading="lazy"
                width={48}
                height={48}
                className="size-12 object-contain"
              />
              <span>{footer.badge}</span>
            </div>

          </div>
        </footer>
      ) : null}
    </div>
  );
}

const GUIDES = [
  {
    to: "/e-ticaret-nasil-yapilir",
    eyebrow: "Başlangıç",
    title: "E-ticaret nasıl yapılır?",
    description:
      "Ürün seçiminden ilk siparişe 5 adım, gerekli her şey, maliyetler ve kanal kararı.",
  },
  {
    to: "/en-iyi-e-ticaret-altyapisi",
    eyebrow: "Karşılaştırma",
    title: "En iyi e-ticaret altyapısı rehberi",
    description:
      "Altyapı seçerken komisyon, özellik ve büyüme kriterlerini yan yana karşılaştırın.",
  },
  {
    to: "/dropshipping-nasil-yapilir",
    eyebrow: "Başlangıç",
    title: "Dropshipping nasıl yapılır?",
    description:
      "Tedarikçi bulmadan XML aktarımına kadar stoksuz satışın adım adım kurulumu.",
  },
  {
    to: "/pazaryeri-entegrasyonu",
    eyebrow: "Entegrasyon",
    title: "Pazaryeri entegrasyonu",
    description:
      "Trendyol, Hepsiburada, Amazon ve N11 stok, fiyat ve siparişlerini tek panelde yönetin.",
  },
  {
    to: "/e-ticaret-paketleri",
    eyebrow: "Fiyatlandırma",
    title: "E-ticaret paketleri",
    description:
      "Paket fiyatlarını, ürün ve sipariş limitlerini, komisyon oranlarını tek tabloda karşılaştırın.",
  },
  {
    to: "/seo-ve-raporlama",
    eyebrow: "SEO & Rapor",
    title: "SEO ve raporlama",
    description:
      "Dönüşüm ve kanal raporlarını tek ekranda izleyin, SEO ayarlarıyla organik trafiğinizi artırın.",
  },
] as const;

/** Ana sayfada rehber içeriklerini öne çıkaran bölüm. */
function GuidesSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8" aria-labelledby="rehberler">
      <p className="eyebrow">Rehberler</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <h2 id="rehberler" className="max-w-2xl text-3xl font-extrabold sm:text-4xl">
          Satışa başlamadan önce okunması gereken rehberler
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Mefticaret ekibinin hazırladığı ücretsiz Türkçe rehberlerle doğru kararı ilk seferde
          verin.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {GUIDES.map((guide) => (
          <Link
            key={guide.to}
            to={guide.to}
            className="showcase-card group flex flex-col p-7 transition-transform hover:-translate-y-1"
          >
            <span className="eyebrow">{guide.eyebrow}</span>
            <span className="mt-3 text-xl font-bold tracking-tight">{guide.title}</span>
            <span className="mt-3 flex-1 text-sm text-muted-foreground">{guide.description}</span>
            <span className="mt-6 inline-flex items-center gap-1 text-sm font-semibold">
              Rehberi oku
              <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
