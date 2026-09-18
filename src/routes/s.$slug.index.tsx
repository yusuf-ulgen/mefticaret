import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { ShopierHome } from "@/components/storefront/shopier-home";
import { StorefrontSections } from "@/components/storefront-sections";
import { resolveSections, withEssentialSections, type ThemeSectionRow } from "@/lib/theme-sections";
import { storefrontQuery } from "@/lib/storefront-queries";
import { getRequestOrigin } from "@/lib/origin.functions";
import { getStoreSeoContext } from "@/lib/seo-public.functions";
import { faqSchema } from "@/lib/seo";
import {
  enrichShortDescription,
  microStoreSeoText,
  missingHead,
  storefrontHead,
} from "@/lib/storefront-seo";
import { useStorefrontLive } from "@/hooks/use-storefront-live";

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
    const micro = loaderData.ctx?.storeKind === "micro";
    const microText = microStoreSeoText(loaderData.ctx, loaderData.name);
    return storefrontHead({
      ctx: loaderData.ctx,
      origin: loaderData.origin,
      slug: params.slug,
      path: `/s/${params.slug}`,
      fallbackTitle: micro ? microText.title : `${loaderData.name} — Online Mağaza`,
      fallbackDescription: micro
        ? enrichShortDescription(loaderData.hero, microText.description)
        : loaderData.hero ||
          `${loaderData.name} vitrininde yeni sezon ürünlerini keşfedin; hızlı kargo ve güvenli ödeme.`,
      seo: settings?.homeTitle || settings?.homeDescription
        ? {
            ...(settings.homeTitle ? { title: settings.homeTitle } : {}),
            ...(settings.homeDescription
              ? {
                  // Kolay Panel mağazalarının çok kısa açıklaması arama sonuçları için tamamlanır.
                  description: micro
                    ? enrichShortDescription(settings.homeDescription, microText.description)
                    : settings.homeDescription,
                }
              : {}),
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
  useStorefrontLive(slug, data?.store?.id);
  if (!data) return <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />;

  const { store, theme, products, collections, footerPages } = data;
  const { t, muted, cardBg, border } = storefrontTokens(theme);
  const isHomeMakerStorefront = data.isHomeMakerStorefront;
  // Mağaza yalnızca tek bir bileşen tanımladıysa vitrin boş kalmasın: hero,
  // kategoriler ve ürün listesi tema metinleriyle otomatik tamamlanır.
  // Vitrin gövdesi Shopier düzeniyle geldiği için otomatik hero/ürün/kategori
  // blokları eklenmez; mağazanın kendi tanımladığı ek bölümler altta kalır.
  const sectionRows = data.sections as ThemeSectionRow[];
  const sections = resolveSections(
    isHomeMakerStorefront
      ? sectionRows
      : withEssentialSections(sectionRows, {
          overrides: {
            hero: {
              title: t.hero_title,
              subtitle: t.hero_subtitle,
            },
          },
          skip: [
            ...(collections.length ? [] : (["category_grid"] as const)),
            ...(products.length ? [] : (["product_grid"] as const)),
          ],
        }),
  );
  const bodySections = sections.filter(
    (section) =>
      section.isEnabled &&
      section.definition.slot === "body" &&
      !["hero", "product_grid", "category_grid"].includes(section.definition.type),
  );

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
      simpleStorefront={isHomeMakerStorefront}
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

      {isHomeMakerStorefront ? (
        <ShopierHome
          storeName={store.name}
          storeSlug={store.slug}
          logoUrl={store.logo_url ?? null}
          tagline={data.profile?.bio || t.hero_subtitle}
          currency={store.currency}
          products={products}
          collections={collections}
          contactEmail={data.profile?.contact_email ?? null}
          salesPaused={store.status !== "active"}
          footerPages={footerPages}
          tokens={{ muted, border, cardBg, accent: t.accent_color }}
        />
      ) : null}

      {(isHomeMakerStorefront ? bodySections : sections).length ? (
        <StorefrontSections
          sections={isHomeMakerStorefront ? bodySections : sections}
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
