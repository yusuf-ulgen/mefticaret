import { Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Check, CreditCard, Globe2, Headphones, Languages, Menu, Package, ShieldCheck, Truck, X, Zap } from "lucide-react";
import { useState } from "react";

import { PlatformLocaleSwitcher } from "@/components/platform-locale-switcher";
import { Button } from "@/components/ui/button";

/**
 * mefticaret.com'un çok dilli tanıtım sayfası (İngilizce, Almanca, Arapça).
 * Metinler sözlükten gelir; Arapça'da düzen sağdan sola çevrilir.
 */

export type LandingCopy = {
  locale: "en" | "de" | "ar" | "fr";
  dir: "ltr" | "rtl";
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  menuLabel: string;
  closeMenuLabel: string;
  skipLabel: string;
  benefits: [string, string, string];
  featuresTitle: string;
  features: { title: string; body: string }[];
  exportTitle: string;
  exportBody: string;
  exportPoints: string[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  closingTitle: string;
  closingBody: string;
  trLink: string;
};

const ICONS = [Package, CreditCard, Truck, BarChart3, Languages, Globe2];

export function GlobalLanding({ copy }: { copy: LandingCopy }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div dir={copy.dir} className="min-h-screen overflow-x-clip bg-background">
      <a href="#content" className="skip-link">{copy.skipLabel}</a>
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto grid min-h-18 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 md:flex md:gap-4 lg:px-8">
          <Link to={copy.locale === "en" ? "/en" : copy.locale === "de" ? "/de" : copy.locale === "fr" ? "/fr" : "/ar"} className="min-w-0 truncate font-display text-xl font-extrabold tracking-tighter sm:text-2xl">
            mefticaret
          </Link>
          <nav aria-label={copy.menuLabel} className="mx-auto hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">{copy.featuresTitle}</a>
            <a href="#export" className="transition-colors hover:text-foreground">{copy.exportTitle}</a>
            <a href="#faq" className="transition-colors hover:text-foreground">{copy.faqTitle}</a>
          </nav>
          <div className="ms-auto flex min-w-0 items-center gap-2">
            <PlatformLocaleSwitcher active={copy.locale} />
            <Button asChild className="hidden max-w-44 rounded-full px-4 min-[360px]:inline-flex">
              <Link to="/auth" search={{ mode: "register" }}>
                <span className="truncate">{copy.primaryCta}</span>
              </Link>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full md:hidden"
              aria-label={mobileOpen ? copy.closeMenuLabel : copy.menuLabel}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>
        {mobileOpen ? (
          <nav aria-label={copy.menuLabel} className="border-t border-border bg-background px-4 py-3 md:hidden">
            <div className="mx-auto grid max-w-lg gap-1">
              <a href="#features" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold">{copy.featuresTitle}</a>
              <a href="#export" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold">{copy.exportTitle}</a>
              <a href="#faq" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-3 text-sm font-semibold">{copy.faqTitle}</a>
            </div>
          </nav>
        ) : null}
      </header>

      <main id="content" tabIndex={-1}>
        <section className="relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
          <div className="mx-auto max-w-7xl px-4 py-16 text-center lg:px-8 lg:py-24">
            <div className="mx-auto max-w-3xl">
            <span className="eyebrow">{copy.eyebrow}</span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
              {copy.title}
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">{copy.subtitle}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" variant="outline" className="min-w-0 rounded-full px-6">
                <Link to="/e-ticaret-paketleri"><span className="truncate">{copy.secondaryCta}</span></Link>
              </Button>
              <Button asChild size="lg" className="min-w-0 rounded-full px-6">
                <Link to="/auth" search={{ mode: "register" }}>
                  <span className="truncate">{copy.primaryCta}</span>
                  <ArrowRight className="ms-2 size-4" />
                </Link>
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-sm text-muted-foreground">
              {copy.benefits.map((label, index) => {
                const Icon = [Zap, Headphones, ShieldCheck][index] ?? Check;
                return <li key={label} className="flex items-center gap-2"><Icon className="size-4 text-brand" />{label}</li>;
              })}
            </ul>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
          <h2 className="font-display text-3xl font-bold tracking-tight">{copy.featuresTitle}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {copy.features.map((feature, index) => {
              const Icon = ICONS[index % ICONS.length]!;
              return (
                <article key={feature.title} className="showcase-card p-6">
                  <Icon className="size-6 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{feature.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="export" className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-7xl px-4 py-20 lg:px-8 lg:py-28">
            <h2 className="font-display text-3xl font-bold tracking-tight">{copy.exportTitle}</h2>
            <p className="mt-3 max-w-3xl text-muted-foreground">{copy.exportBody}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {copy.exportPoints.map((point) => (
                <li key={point} className="showcase-card p-4 text-sm">
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-4xl px-4 py-20 lg:px-8 lg:py-28">
          <h2 className="font-display text-3xl font-bold tracking-tight">{copy.faqTitle}</h2>
          <div className="mt-6 space-y-4">
            {copy.faq.map((item) => (
              <details key={item.q} className="showcase-card p-5">
                <summary className="cursor-pointer font-semibold">{item.q}</summary>
                <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center lg:px-8">
            <h2 className="font-display text-3xl font-bold tracking-tight">{copy.closingTitle}</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">{copy.closingBody}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="rounded-full px-6">
                <Link to="/auth" search={{ mode: "register" }}>
                  {copy.primaryCta}
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="rounded-full px-6">
                <Link to="/" hrefLang="tr">
                  {copy.trLink}
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

/** Dil bazlı head meta + hreflang alternatifleri. */
/** Dil karşılıkları tek yerde tutulur; yeni dil eklenince hreflang otomatik güncellenir. */
const LANDING_ALTERNATES = [
  { hrefLang: "tr", href: "https://mefticaret.com/" },
  { hrefLang: "en", href: "https://mefticaret.com/en" },
  { hrefLang: "de", href: "https://mefticaret.com/de" },
  { hrefLang: "fr", href: "https://mefticaret.com/fr" },
  { hrefLang: "ar", href: "https://mefticaret.com/ar" },
];

export function globalLandingHead(copy: LandingCopy, path: string) {
  const url = `https://mefticaret.com${path}`;
  return {
    meta: [
      { title: copy.title },
      { name: "description", content: copy.subtitle },
      { name: "content-language", content: copy.locale },
      { property: "og:title", content: copy.title },
      { property: "og:description", content: copy.subtitle },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:site_name", content: "Mefticaret" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: copy.title },
      { name: "twitter:description", content: copy.subtitle },
    ],
    links: [
      { rel: "canonical", href: url },
      ...LANDING_ALTERNATES.map((alt) => ({
        rel: "alternate",
        hrefLang: alt.hrefLang,
        href: alt.href,
      })),
      { rel: "alternate", hrefLang: "x-default", href: "https://mefticaret.com/" },
    ],
  };
}
