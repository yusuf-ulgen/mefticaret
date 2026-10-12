import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";

import { StorefrontChrome, storefrontTokens } from "@/components/storefront-chrome";
import { Breadcrumb, StorefrontFallback } from "@/components/storefront-parts";
import { getStorePublicPolicies } from "@/lib/policies-public.functions";
import { storefrontQuery } from "@/lib/storefront-queries";

export const Route = createFileRoute("/s/$slug/politikalar")({
  loader: async ({ context, params }) => {
    const [store, res] = await Promise.all([
      context.queryClient.ensureQueryData(storefrontQuery(params.slug)),
      getStorePublicPolicies({ data: { slug: params.slug } }),
    ]);
    if (!store || !res) throw notFound();
    return res;
  },
  head: ({ loaderData, params }) => {
    const title = `Yasal Bilgiler & Politikalar — ${loaderData?.storeName ?? "Mağaza"}`;
    const desc = "İade, gizlilik, kargo, çerez politikaları ve mesafeli satış sözleşmesi.";
    const url = `https://mefticaret.com/s/${params.slug}/politikalar`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: () => <StorefrontFallback text="Sayfa şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: PoliciesPage,
});

function PoliciesPage() {
  const { slug } = Route.useParams();
  const res = Route.useLoaderData();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  if (!data) return null;
  const { store, theme, footerPages } = data;
  const { muted, border, cardBg, radius } = storefrontTokens(theme);
  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      <Breadcrumb theme={theme} slug={slug} storeName={store.name} current="Politikalar" />
      <section className="mx-auto w-full max-w-3xl px-4 pb-12 pt-4">
        <h1 style={{ fontSize: "clamp(24px, 6vw, 32px)", fontWeight: 700, margin: 0 }}>Yasal Bilgiler & Politikalar</h1>
        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          {res.policies.map((p) => (
            <Link key={p.key} to="/s/$slug/politika/$policySlug" params={{ slug, policySlug: p.slug }}
              style={{ display: "block", padding: "14px 16px", border: `1px solid ${border}`, borderRadius: radius, background: cardBg, color: "inherit", textDecoration: "none" }}>
              <strong>{p.title}</strong>
              <span style={{ display: "block", color: muted, fontSize: 13, marginTop: 4 }}>
                Sürüm {p.version}{p.effectiveDate ? ` · Yürürlük ${new Date(p.effectiveDate).toLocaleDateString("tr-TR")}` : ""}
              </span>
            </Link>
          ))}
          {!res.policies.length ? (
            <p style={{ color: muted }}>
              Mağaza politikaları hazırlanıyor. <Link to="/s/$slug/returns" params={{ slug }} style={{ textDecoration: "underline", color: "inherit" }}>İade</Link>
              {" · "}<Link to="/s/$slug/privacy" params={{ slug }} style={{ textDecoration: "underline", color: "inherit" }}>Gizlilik</Link>
            </p>
          ) : null}
        </div>
      </section>
    </StorefrontChrome>
  );
}
