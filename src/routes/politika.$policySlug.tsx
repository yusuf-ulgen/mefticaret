import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { PolicyArticle } from "@/components/policy-view";
import { getPlatformPublicPolicy } from "@/lib/policies-public.functions";

export const Route = createFileRoute("/politika/$policySlug")({
  loader: async ({ params }) => {
    const res = await getPlatformPublicPolicy({ data: { policy: params.policySlug } });
    if (!res) throw notFound();
    return res;
  },
  head: ({ loaderData, params }) => {
    const title = loaderData ? `${loaderData.seoTitle || loaderData.title} — Mefticaret` : "Politika — Mefticaret";
    const desc = loaderData?.seoDescription || `Mefticaret ${loaderData?.title ?? "politikası"}.`;
    const url = `https://mefticaret.com/politika/${params.policySlug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: () => <p className="p-10 text-center">Sayfa şu anda yüklenemedi.</p>,
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p>Bu politika henüz yayınlanmadı.</p>
      <Link to="/" className="underline">Ana sayfa</Link>
    </div>
  ),
  component: () => {
    const policy = Route.useLoaderData();
    return (
      <main className="min-h-screen bg-background py-10 text-foreground">
        <div className="mx-auto max-w-3xl px-4"><Link to="/" className="text-sm text-muted-foreground">← Mefticaret</Link></div>
        <PolicyArticle policy={policy} />
      </main>
    );
  },
});
