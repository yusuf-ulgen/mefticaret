import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CreditCard,
  Globe,
  LayoutTemplate,
  Package,
  Store,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const TITLE = "How to Start an Online Store in 2026 — Step-by-Step Guide";
const DESCRIPTION =
  "How to start an online store: choose products, pick a platform, set up your storefront, connect payments and shipping, and understand the real costs of selling online.";
const URL = "https://mefticaret.com/en/how-to-start-an-online-store";
const TR_URL = "https://mefticaret.com/e-ticaret-nasil-yapilir";

const STEPS = [
  {
    icon: Package,
    title: "1. Decide what you will sell",
    body: "Start from what you can source or make reliably: your own craft, a supplier you trust, or a niche you know well. Launch with 10–20 products and let real orders tell you what to scale.",
  },
  {
    icon: LayoutTemplate,
    title: "2. Choose your ecommerce platform",
    body: "A hosted platform gives you storefront, cart, checkout, inventory and an admin panel in one subscription. Self-hosting open source means servers, updates and security are your job.",
    tip: "On Mefticaret a store goes live in minutes: pick a theme, add products, connect payments, open for sales.",
  },
  {
    icon: Globe,
    title: "3. Set up domain and storefront",
    body: "Register a short, memorable domain. Add your logo, colours and a clear brand story. Give every product 3–5 photos, an honest description and accurate stock — descriptions are also how search engines find you.",
  },
  {
    icon: CreditCard,
    title: "4. Connect payments and shipping",
    body: "Card payments need a payment provider with 3D Secure; bank transfer and cash on delivery widen your reach in many markets. On shipping, negotiate a carrier rate and automate tracking numbers and returns.",
  },
  {
    icon: BarChart3,
    title: "5. Get your first customers and measure",
    body: "Organic traffic takes months. Your first buyers come from social channels, messaging apps, your own network and marketplaces. Then watch cart abandonment, top viewed products and conversion rate, and improve from data.",
  },
];

const COSTS = [
  { item: "Domain name", range: "$10–25 / year", note: "A free platform subdomain works until you are ready." },
  { item: "Platform", range: "From $0 / month", note: "Hosted plans add a fixed fee plus a lower commission as you grow." },
  { item: "Payment fees", range: "1–3% per sale", note: "Charged by the payment provider on each transaction." },
  { item: "Shipping", range: "Per parcel", note: "Charge the buyer, absorb it, or offer free shipping above a threshold." },
  { item: "Marketing", range: "Your budget", note: "Organic social costs nothing but time; ads come later." },
];

const CHANNELS = [
  {
    icon: Store,
    title: "Your own online store",
    pros: [
      "You own the brand, the domain and the customer data",
      "Fixed platform cost instead of a high per-sale commission",
      "Your product pages get indexed and build organic traffic",
      "Full control over discounts, email and upsells",
    ],
    cons: ["You bring the first visitors yourself", "Trust has to be earned early on"],
  },
  {
    icon: Building2,
    title: "Selling on a marketplace",
    pros: ["Built-in traffic, faster first sale", "Payments and logistics handled for you"],
    cons: ["High commission per sale", "Customer data stays with the marketplace", "Price wars and rule changes"],
  },
];

const FAQ = [
  {
    q: "Do I need technical skills to start an online store?",
    a: "No. On a hosted ecommerce platform you add products, themes, payments and shipping from an admin panel without writing code. Self-hosting an open-source store does require technical skills or a developer.",
  },
  {
    q: "What do I need to start an online store?",
    a: "Products and starting stock, an ecommerce platform, a domain, a payment method, a shipping carrier, product photos, and a first marketing channel. You also need tax registration appropriate to your country.",
  },
  {
    q: "How much does an online store cost?",
    a: "You can start at zero platform cost on a free plan. Recurring costs are the domain, payment fees per sale and shipping; advertising is optional.",
  },
  {
    q: "Own store or marketplace — which is better?",
    a: "Both, in sequence. Marketplaces give instant traffic but take commission and keep the customer relationship; your own store keeps margin, data and brand. Many sellers start on a marketplace and grow their own store alongside it.",
  },
];

export const Route = createFileRoute("/en/how-to-start-an-online-store")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "article" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: URL },
      { rel: "alternate", hrefLang: "en", href: URL },
      { rel: "alternate", hrefLang: "tr", href: TR_URL },
      { rel: "alternate", hrefLang: "x-default", href: TR_URL },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How to start an online store",
          description: DESCRIPTION,
          inLanguage: "en",
          totalTime: "P7D",
          step: STEPS.map((step, index) => ({
            "@type": "HowToStep",
            position: index + 1,
            name: step.title.replace(/^\d+\.\s*/, ""),
            text: step.body,
            url: `${URL}#steps`,
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://mefticaret.com/" },
            { "@type": "ListItem", position: 2, name: "How to start an online store", item: URL },
          ],
        }),
      },
    ],
  }),
  component: HowToStartPage,
});

function HowToStartPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
      <header className="mx-auto max-w-3xl text-center">
        <span className="eyebrow">Getting started</span>
        <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl lg:text-5xl">
          How to start an online store
        </h1>
        <p className="mt-5 text-muted-foreground">
          From choosing products to your first order: the five steps, everything you need, the real
          costs, and whether to sell on your own store or a marketplace.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild className="rounded-full">
            <Link to="/auth" search={{ mode: "register" }}>
              Start free
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/e-ticaret-paketleri">Compare plans</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Türkçe okumak için{" "}
          <Link to="/e-ticaret-nasil-yapilir" className="underline">
            e-ticaret nasıl yapılır rehberi
          </Link>
        </p>
      </header>

      <section aria-labelledby="steps" className="mt-20">
        <h2 id="steps" className="text-2xl font-extrabold sm:text-3xl">
          Five steps to launch
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step) => (
            <article key={step.title} className="showcase-card flex flex-col p-7">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-accent">
                <step.icon className="size-5 text-brand" aria-hidden />
              </span>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="mt-3 flex-1 text-sm text-muted-foreground">{step.body}</p>
              {step.tip ? (
                <p className="mt-4 rounded-xl bg-accent px-4 py-3 text-xs text-foreground/80">
                  {step.tip}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="costs" className="mt-20">
        <h2 id="costs" className="text-2xl font-extrabold sm:text-3xl">
          What does it cost?
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {COSTS.map((cost) => (
            <article key={cost.item} className="showcase-card p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{cost.item}</h3>
                <Truck className="size-5 text-brand" aria-hidden />
              </div>
              <p className="mt-3 font-display text-xl font-extrabold text-brand">{cost.range}</p>
              <p className="mt-2 text-xs text-muted-foreground">{cost.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="channels" className="mt-20">
        <h2 id="channels" className="text-2xl font-extrabold sm:text-3xl">
          Own store or marketplace?
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          {CHANNELS.map((channel) => (
            <article key={channel.title} className="showcase-card p-7">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent">
                  <channel.icon className="size-5 text-brand" aria-hidden />
                </span>
                <h3 className="text-lg font-bold">{channel.title}</h3>
              </div>
              <ul className="mt-5 space-y-2 text-sm">
                {channel.pros.map((pro) => (
                  <li key={pro} className="flex gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
              <ul className="mt-4 space-y-2 border-t pt-4 text-sm text-muted-foreground">
                {channel.cons.map((con) => (
                  <li key={con} className="flex gap-2">
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                      aria-hidden
                    />
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="faq" className="mt-20 max-w-3xl">
        <h2 id="faq" className="text-2xl font-extrabold sm:text-3xl">
          Frequently asked questions
        </h2>
        <dl className="mt-6 space-y-6">
          {FAQ.map((item) => (
            <div key={item.q} className="showcase-card p-6">
              <dt className="font-semibold">{item.q}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="showcase-card mt-20 px-6 py-14 text-center">
        <h2 className="text-2xl font-extrabold sm:text-3xl">Open your store today</h2>
        <p className="mx-auto mt-4 max-w-lg text-sm text-muted-foreground">
          Start on the free plan, add your first product and take orders the same day.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/auth" search={{ mode: "register" }}>
              Start free
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link to="/e-ticaret-paketleri">Compare plans</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
