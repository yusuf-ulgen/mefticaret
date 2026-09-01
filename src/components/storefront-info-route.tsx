import { useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome } from "@/components/storefront-chrome";
import { Breadcrumb, InfoSections, StorefrontFallback } from "@/components/storefront-parts";
import { storefrontQuery } from "@/lib/storefront-queries";

export type InfoContent = {
  title: string;
  description: string;
  intro: string;
  sections: { heading: string; body: string }[];
};

/** Bilgi sayfası head meta üreticisi. */
export function infoHead(loaderData: { storeName: string } | undefined, content: InfoContent) {
  if (!loaderData) {
    return { meta: [{ title: "Mağaza bulunamadı" }, { name: "robots", content: "noindex" }] };
  }
  const title = `${content.title} — ${loaderData.storeName}`;
  const description = content.description;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}

/** Ortak bilgi sayfası gövdesi. */
export function InfoPage({ slug, content }: { slug: string; content: InfoContent }) {
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  if (!data) return <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme, footerPages } = data;
  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      <Breadcrumb theme={theme} slug={slug} storeName={store.name} current={content.title} />
      <InfoSections theme={theme} title={content.title} intro={content.intro} sections={content.sections} />
    </StorefrontChrome>
  );
}
