import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight, Check, Menu, X } from "lucide-react";

import { LandingMegaMenu, LandingMobileMenu } from "@/components/landing-mega-menu";


import {
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

const FALLBACK_TITLE = "Mefticaret — Mağazanı Kur, Hemen Satışa Başla";
const FALLBACK_DESCRIPTION =
  "Mefticaret ile dakikalar içinde mağazanı kur; ürün, stok, sipariş, kargo, ödeme ve pazaryeri yönetimi tek panelde. Çok kiracılı, ölçeklenebilir e-ticaret altyapısı.";

export const Route = createFileRoute("/")({
  loader: async () => ({ homeSeo: await fetchHomeSeo() }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData?.homeSeo?.title || FALLBACK_TITLE },
      { name: "description", content: loaderData?.homeSeo?.description || FALLBACK_DESCRIPTION },
      { property: "og:title", content: loaderData?.homeSeo?.title || FALLBACK_TITLE },
      { property: "og:description", content: loaderData?.homeSeo?.description || FALLBACK_DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/" }],
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
  const hero = get("hero");
  const showcase = get("showcase");
  const modules = get("modules");
  const pricing = get("pricing");
  const cta = get("cta");
  const footer = get("footer");

  const showcaseItems = showcase?.items ?? [];
  const half = Math.ceil(showcaseItems.length / 2);

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
          <div className="mx-auto flex h-18 max-w-7xl items-center gap-4 px-4 py-3 lg:px-8">
            <Link to="/" className="font-display text-2xl font-extrabold tracking-tighter">
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
              {loading ? null : session ? (
                <Button asChild className="rounded-full px-5">
                  <Link to="/stores">Panele git</Link>
                </Button>
              ) : (
                <>
                  <LinkButton
                    href={header.secondary_href}
                    label={header.secondary_label}
                    variant="ghost"
                  />
                  <LinkButton href={header.primary_href} label={header.primary_label} />
                </>
              )}
              <Button
                variant="outline"
                size="icon"
                className="rounded-full md:hidden"
                aria-label="Menüyü aç"
                aria-expanded={mobileOpen}
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
            <div className="mx-auto grid grid-cols-1 max-w-7xl items-center gap-8 px-4 py-16 lg:grid-cols-[minmax(180px,220px)_1fr_minmax(180px,220px)] lg:px-8 lg:py-24">
              <ShowcaseColumn items={showcaseItems.slice(0, half)} className="hidden lg:block" />

              <div className="mx-auto max-w-2xl text-center">
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

              <ShowcaseColumn items={showcaseItems.slice(half)} slow className="hidden lg:block" />
            </div>
          </section>
        ) : null}

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

        {pricing ? (
          <section id="paketler" className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
            <div className="text-center">
              {pricing.eyebrow ? <span className="eyebrow">{pricing.eyebrow}</span> : null}
              <h2 className="mt-6 text-3xl font-extrabold sm:text-4xl lg:text-5xl">{pricing.title}</h2>
              <p className="mx-auto mt-5 max-w-xl text-muted-foreground">{pricing.subtitle}</p>
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
                      {Number(plan.price_monthly) === 0
                        ? "Ücretsiz"
                        : formatMoney(Number(plan.price_monthly), plan.currency)}
                      {Number(plan.price_monthly) > 0 ? (
                        <span className="text-sm font-medium text-muted-foreground">/ay</span>
                      ) : null}
                    </p>
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

        <BlogSection section={get("blog")} />

        <FaqSection section={get("faq")} />

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
            <div className="mt-10 flex flex-wrap gap-3 border-t border-border pt-6 text-sm text-muted-foreground">
              <span>© {new Date().getFullYear()} Mefticaret</span>
              <span className="ml-auto">{footer.badge}</span>
            </div>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
