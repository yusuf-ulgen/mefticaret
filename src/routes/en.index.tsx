import { createFileRoute } from "@tanstack/react-router";

import { globalLandingHead, type LandingCopy } from "@/components/global-landing";
import { PlatformHome } from "@/components/platform-home";
import { siteSectionsQuery } from "@/lib/site-content";
import { plansQuery } from "@/lib/store-queries";

const COPY: LandingCopy = {
  locale: "en",
  dir: "ltr",
  eyebrow: "Ecommerce platform",
  title: "Mefticaret — Sell worldwide from one dashboard",
  subtitle:
    "Open an online store in minutes and run products, stock, orders, shipping, marketplaces and cross-border sales from a single panel. Multi-currency pricing, EU and US tax rules and export documents are built in.",
  primaryCta: "Start free",
  headerCta: "Sign up",
  secondaryCta: "Call us",
  menuLabel: "Main navigation",
  closeMenuLabel: "Close menu",
  skipLabel: "Skip to content",
  benefits: ["Quick setup", "24/7 support", "Secure infrastructure"],
  featuresTitle: "Everything a growing store needs",
  features: [
    {
      title: "Products and stock",
      body: "Variants, barcodes, warehouses and low-stock alerts. Stock stays in sync across your storefront and every connected marketplace.",
    },
    {
      title: "Payments and checkout",
      body: "Card payments with 3D Secure, bank transfer and cash on delivery. Local payment methods can be switched on per country and currency.",
    },
    {
      title: "Shipping and tracking",
      body: "Carrier rates at checkout, printed labels and automatic tracking updates, with branded tracking pages for your customers.",
    },
    {
      title: "Analytics you act on",
      body: "Daily revenue, conversion, abandoned carts and best sellers — plus country-level reporting for export sales.",
    },
    {
      title: "Translations with AI",
      body: "Translate product titles, descriptions and SEO metadata into English, German, Arabic, French and Russian in one click, then edit anything by hand.",
    },
    {
      title: "SEO by default",
      body: "Clean URLs, per-page metadata, structured data, language sitemaps and hreflang tags so every market can find you.",
    },
  ],
  exportTitle: "Cross-border selling without the paperwork",
  exportBody:
    "The Global & Export module prices every product in the buyer's currency, calculates the tax the destination country expects, and produces the documents your carrier asks for.",
  exportPoints: [
    "Country-specific prices plus a live exchange rate with your own risk margin",
    "EU OSS/IOSS VAT, the 150 EUR threshold and B2B reverse charge",
    "US state sales tax with nexus settings",
    "DDP/DDU landed-cost simulator shown at checkout",
    "Commercial invoice, packing list and ETGB export documents as PDF",
    "DHL, FedEx, UPS, PTT, Navlungo, ShipEntegra and Aramex connections",
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "How long does it take to open a store?",
      a: "Minutes. Pick a theme, add your first products, connect a payment method and you can accept orders the same day.",
    },
    {
      q: "Can I sell in other currencies?",
      a: "Yes. Live rates cover USD, EUR, GBP, AED, SAR and CAD, and you can set a fixed price per country when you want full control.",
    },
    {
      q: "Do I need a developer?",
      a: "No. Themes, pages, products, taxes and shipping are all configured from the dashboard.",
    },
  ],
  closingTitle: "Open your store today",
  closingBody: "Start free, invite your team, and upgrade only when your order volume asks for it.",
  trLink: "Türkçe sayfa",
};

export const Route = createFileRoute("/en/")({
  head: () => globalLandingHead(COPY, "/en"),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(siteSectionsQuery()).catch(() => null),
      context.queryClient.ensureQueryData(plansQuery()).catch(() => null),
    ]);
    return null;
  },
  component: () => <PlatformHome locale="en" />,
});
