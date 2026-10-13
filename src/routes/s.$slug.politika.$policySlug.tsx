import { createFileRoute, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { PolicyArticle } from "@/components/policy-view";
import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { Breadcrumb, StorefrontFallback } from "@/components/storefront-parts";
import { getStorePublicPolicy } from "@/lib/policies-public.functions";
import { storefrontQuery } from "@/lib/storefront-queries";
import { DataRequestForm } from "@/components/data-request-form";

export const Route = createFileRoute("/s/$slug/politika/$policySlug")({
  loader: async ({ context, params }) => {
    const [store, res] = await Promise.all([
      context.queryClient.ensureQueryData(storefrontQuery(params.slug)),
      getStorePublicPolicy({ data: { slug: params.slug, policy: params.policySlug } }),
    ]);
    if (!store || !res) throw notFound();
    return res;
  },
  head: ({ loaderData, params }) => {
    const p = loaderData?.policy;
    const title = p ? `${p.seoTitle || p.title} — ${loaderData!.storeName}` : "Politika";
    const desc =
      p?.seoDescription ||
      (p ? `${loaderData!.storeName} ${p.title}. Sürüm ${p.version}.` : "Mağaza politikası");
    const url = `https://mefticaret.com/s/${params.slug}/politika/${params.policySlug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
        ...(!p ? [{ name: "robots", content: "noindex" }] : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: () => <StorefrontFallback text="Sayfa şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu politika bulunamadı." />,
  component: PolicyPage,
});

function PolicyPage() {
  const { slug } = Route.useParams();
  const res = Route.useLoaderData();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  if (!data) return null;
  const { store, theme, footerPages } = data;
  const { muted } = storefrontTokens(theme);
  return (
    <StorefrontChrome
      theme={theme}
      storeName={store.name}
      storeSlug={store.slug}
      footerPages={footerPages}
    >
      <Breadcrumb
        theme={theme}
        slug={slug}
        storeName={store.name}
        current={res.policy?.title ?? "Politika"}
      />
      {res.policy ? (
        <PolicyArticle policy={res.policy} muted={muted} />
      ) : (
        <p className="mx-auto max-w-3xl px-4 py-12 text-center" style={{ color: muted }}>
          Bu politika henüz yayınlanmadı. Sorularınız için mağaza ile iletişime geçebilirsiniz.
        </p>
      )}
      {res.policy?.key === "privacy" ? (
        <div className="mx-auto max-w-3xl px-4 pb-12">
          <DataRequestForm slug={slug} />
        </div>
      ) : null}
    </StorefrontChrome>
  );
}
