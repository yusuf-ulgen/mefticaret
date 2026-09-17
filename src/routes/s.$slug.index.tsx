import { useMemo, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { WokieeProductCard } from "@/components/wokiee/product-card";
import { formatMoney } from "@/lib/mefti";
import { ShopierHome } from "@/components/storefront/shopier-home";
import { StorefrontSections } from "@/components/storefront-sections";
import { resolveSections, withEssentialSections, type ThemeSectionRow } from "@/lib/theme-sections";
import { storefrontQuery } from "@/lib/storefront-queries";
import { getRequestOrigin } from "@/lib/origin.functions";
import { getStoreSeoContext } from "@/lib/seo-public.functions";
import { faqSchema } from "@/lib/seo";
import { missingHead, storefrontHead } from "@/lib/storefront-seo";

export const Route = createFileRoute("/s/$slug/")({
  loader: async ({ context, params }) => {
    const [data, ctx, origin] = await Promise.all([
      context.queryClient.ensureQueryData(storefrontQuery(params.slug)),
      getStoreSeoContext({ data: { slug: params.slug } }),
      getRequestOrigin(),
    ]);
    if (!data) throw notFound();
    return { name: data.store.name, hero: data.theme?.hero_subtitle ?? "", ctx, origin };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return missingHead("Mağaza bulunamadı");
    const settings = loaderData.ctx?.settings;
    const faq = settings?.faq ?? [];
    return storefrontHead({
      ctx: loaderData.ctx,
      origin: loaderData.origin,
      slug: params.slug,
      path: `/s/${params.slug}`,
      fallbackTitle: `${loaderData.name} — Online Mağaza`,
      fallbackDescription:
        loaderData.hero ||
        `${loaderData.name} vitrininde yeni sezon ürünlerini keşfedin; hızlı kargo ve güvenli ödeme.`,
      seo: settings?.homeTitle || settings?.homeDescription
        ? {
            ...(settings.homeTitle ? { title: settings.homeTitle } : {}),
            ...(settings.homeDescription ? { description: settings.homeDescription } : {}),
          }
        : null,
      schemas: faq.length ? [faqSchema(faq)] : [],
    });
  },

  errorComponent: () => <StorefrontFallback text="Vitrin şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: StorefrontHome,
});

function StorefrontFallback({ text }: { text: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">{text}</h1>
      <Link to="/" className="text-sm underline">
        Mefticaret ana sayfası
      </Link>
    </div>
  );
}

function StorefrontHome() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLocaleLowerCase("tr");
    if (!q) return data.products;
    return data.products.filter((p) =>
      [p.title, p.description ?? "", p.product_type ?? "", ...(p.tags ?? [])]
        .join(" ")
        .toLocaleLowerCase("tr")
        .includes(q),
    );
  }, [data, query]);

  if (!data) return <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />;

  const { store, theme, products, collections, footerPages } = data;
  const { t, fonts, muted, cardBg, border, radius, dark } = storefrontTokens(theme);
  // Mağaza yalnızca tek bir bileşen tanımladıysa vitrin boş kalmasın: hero,
  // kategoriler ve ürün listesi tema metinleriyle otomatik tamamlanır.
  const sections = resolveSections(
    withEssentialSections(data.sections as ThemeSectionRow[], {
      overrides: {
        hero: {
          title: t.hero_title,
          subtitle: t.hero_subtitle,
          ctaLabel: t.hero_cta_label,
          ctaUrl: `/s/${store.slug}/products`,
        },
        product_grid: { title: "Ürünler", limit: 12 },
      },
      skip: [
        ...(products.length === 0 ? (["product_grid"] as const) : []),
        ...(collections.length === 0 ? (["category_grid"] as const) : []),
      ],
    }),
  );
  const bodySections = sections.filter((section) => section.isEnabled && section.definition.slot === "body");
  const split = t.layout === "split-screen";
  const columns = t.layout === "magazine" ? "repeat(auto-fill, minmax(320px, 1fr))" : "repeat(auto-fill, minmax(240px, 1fr))";

  return (
    <StorefrontChrome
      theme={theme}
      storeName={store.name}
      storeSlug={store.slug}
      footerPages={footerPages}
      commerce={data.commerce}
      sections={sections}
      customCss={theme?.custom_css ?? null}
      customJs={theme?.custom_js ?? null}
    >
      {data.campaign?.message ? (
        <div
          role="status"
          className="mb-6 rounded-2xl px-4 py-3 text-center text-sm font-semibold"
          style={{ background: cardBg, border: `1px solid ${border}` }}
        >
          {data.campaign.message}
        </div>
      ) : null}

      <ShopierHome
        storeName={store.name}
        storeSlug={store.slug}
        logoUrl={store.logo_url ?? null}
        tagline={t.hero_subtitle}
        currency={store.currency}
        products={products}
        collections={collections}
        tokens={{ muted, border, cardBg, accent: t.accent_color }}
      />

      {bodySections.length ? (
        <StorefrontSections
          sections={sections}
          context={{
            theme,
            storeSlug: store.slug,
            storeName: store.name,
            storeCurrency: store.currency,
            products,
            collections,
            pages: data.blogPages,
            commerce: data.commerce,
          }}
        />
      ) : null}

    </StorefrontChrome>
  );
}
