import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";

import { StorefrontChrome } from "@/components/storefront-chrome";
import { Breadcrumb, StorefrontFallback } from "@/components/storefront-parts";
import { getRequestOrigin } from "@/lib/origin.functions";
import { getStoreSeoContext } from "@/lib/seo-public.functions";
import { storefrontCampaignQuery } from "@/lib/storefront-campaign";
import { storefrontQuery } from "@/lib/storefront-queries";
import { missingHead, storefrontHead } from "@/lib/storefront-seo";

export const Route = createFileRoute("/s/$slug/kampanya/$campaignSlug")({
  loader: async ({ context, params }) => {
    const [data, ctx, origin, campaign] = await Promise.all([
      context.queryClient.ensureQueryData(storefrontQuery(params.slug)),
      getStoreSeoContext({ data: { slug: params.slug } }),
      getRequestOrigin(),
      context.queryClient.ensureQueryData(
        storefrontCampaignQuery(params.slug, params.campaignSlug),
      ),
    ]);
    if (!data) throw notFound();
    return { ctx, origin, campaignName: campaign?.name ?? null, headline: campaign?.landingHeadline ?? null, body: campaign?.landingBody ?? null };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return missingHead("Kampanya bulunamadı");
    const base = `/s/${params.slug}`;
    const path = `${base}/kampanya/${params.campaignSlug}`;
    const title = loaderData.headline || loaderData.campaignName || "Kampanya";
    return storefrontHead({
      ctx: loaderData.ctx,
      origin: loaderData.origin,
      slug: params.slug,
      path,
      fallbackTitle: title,
      fallbackDescription:
        loaderData.body?.slice(0, 160) || `${title} — kampanya koşulları ve geçerlilik süresi.`,
      breadcrumbs: [
        { name: "Ana sayfa", path: base },
        { name: title, path },
      ],
      schemas: [],
    });
  },
  errorComponent: () => <StorefrontFallback text="Kampanya şu anda yüklenemedi." />,
  notFoundComponent: () => <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />,
  component: CampaignPage,
});

function CampaignPage() {
  const { slug, campaignSlug } = Route.useParams();
  const { data } = useSuspenseQuery(storefrontQuery(slug));
  const { data: campaign, isPending } = useQuery(storefrontCampaignQuery(slug, campaignSlug));

  if (!data) return <StorefrontFallback text="Bu adreste yayınlanmış bir mağaza yok." />;
  const { store, theme, footerPages } = data;
  const title = campaign?.landingHeadline || campaign?.name || "Kampanya";

  return (
    <StorefrontChrome theme={theme} storeName={store.name} storeSlug={store.slug} footerPages={footerPages}>
      <Breadcrumb theme={theme} slug={slug} storeName={store.name} current={title} />
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-6">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Kampanya yükleniyor…</p>
        ) : !campaign ? (
          <p className="text-sm text-muted-foreground">Bu kampanya artık yayında değil.</p>
        ) : (
          <>
            <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
            {campaign.landingBody ? (
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {campaign.landingBody}
              </p>
            ) : null}
            {campaign.discountCode ? (
              <div className="mt-6 rounded-xl border bg-muted/40 p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">İndirim kodu</p>
                <p className="mt-1 font-mono text-xl font-semibold">{campaign.discountCode}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Kodu ödeme adımında girerek indirimden yararlanabilirsin.
                </p>
              </div>
            ) : null}
            {campaign.endsAt ? (
              <p className="mt-4 text-xs text-muted-foreground">
                Kampanya bitişi: {new Date(campaign.endsAt).toLocaleString("tr-TR")}
              </p>
            ) : null}
            <Link
              to="/s/$slug/products"
              params={{ slug }}
              className="mt-8 inline-flex items-center rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background"
            >
              Kampanyalı ürünleri incele
            </Link>
          </>
        )}
      </div>
    </StorefrontChrome>
  );
}
