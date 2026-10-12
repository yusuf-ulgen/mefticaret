import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { PlatformContactForm } from "@/components/platform-contact-form";
import { platformPageQuery } from "@/lib/platform-pages-queries";

/** Platform kurumsal içerik sayfası (süper yönetici tarafından yönetilir). */

const FALLBACK_DESCRIPTION = "Mefticaret kurumsal bilgilendirme sayfası.";

function autoDescription(page: { seo_description?: string | null; excerpt?: string | null; body?: string | null }) {
  const raw =
    (page.seo_description ?? "").trim() ||
    (page.excerpt ?? "").trim() ||
    (page.body ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/[#*_>`|\-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const text = raw || FALLBACK_DESCRIPTION;
  return text.length <= 160 ? text : `${text.slice(0, 159).replace(/[\s,;.:-]+$/, "")}…`;
}

export const Route = createFileRoute("/sayfa/$slug")({
  loader: async ({ context, params }) => {
    try {
      const page = await context.queryClient.ensureQueryData(platformPageQuery(params.slug));
      return { page: page ?? null };
    } catch (error) {
      console.error(error);
      return { page: null };
    }
  },
  errorComponent: ({ error }) => (
    <main className="mx-auto w-full max-w-3xl px-5 py-14" role="alert">
      <h1 className="text-2xl font-semibold">Sayfa şu anda görüntülenemiyor</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto w-full max-w-3xl px-5 py-14">
      <h1 className="text-2xl font-semibold">Sayfa bulunamadı</h1>
    </main>
  ),
  head: ({ params, loaderData }) => {
    const page = loaderData?.page;
    const title = page
      ? page.meta_title?.trim() || `${page.title} — Mefticaret`
      : `${params.slug} — Mefticaret`;
    const description = page ? autoDescription(page) : FALLBACK_DESCRIPTION;
    const canonical =
      page?.canonical_url && /^https?:\/\//.test(page.canonical_url)
        ? page.canonical_url
        : `https://mefticaret.com/sayfa/${params.slug}`;
    const noindex = !page || page.noindex === true;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonical },
        { name: "twitter:card", content: "summary" },
        ...(noindex ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      ],
      links: noindex ? [] : [{ rel: "canonical", href: canonical }],
      scripts: page
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebPage",
                name: page.title,
                description,
                url: canonical,
                dateModified: page.updated_at,
                publisher: { "@type": "Organization", name: "Mefticaret" },
              }),
            },
          ]
        : [],
    };
  },
  component: PlatformPage,
});

function PlatformPage() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery(platformPageQuery(slug));

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Ana sayfa
      </Link>
      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Yükleniyor…</p>
      ) : !data ? (
        <div className="mt-8">
          <h1 className="text-2xl font-semibold">Sayfa bulunamadı</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Aradığın sayfa yayından kaldırılmış olabilir.
          </p>
        </div>
      ) : (
        <>
          <article className="mt-6">
            <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
            {data.excerpt ? <p className="mt-3 text-muted-foreground">{data.excerpt}</p> : null}
            <div className="mt-8 space-y-4 leading-relaxed whitespace-pre-line">{data.body}</div>
          </article>
          {data.show_contact_form ? <PlatformContactForm pageSlug={slug} /> : null}
        </>
      )}
    </main>
  );
}
