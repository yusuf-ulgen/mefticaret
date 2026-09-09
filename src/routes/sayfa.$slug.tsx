import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { platformPageQuery } from "@/lib/platform-pages-queries";

/** Platform kurumsal içerik sayfası (süper yönetici tarafından yönetilir). */

export const Route = createFileRoute("/sayfa/$slug")({
  loader: async ({ context, params }) => {
    try {
      await context.queryClient.ensureQueryData(platformPageQuery(params.slug));
    } catch (error) {
      console.error(error);
    }
    return null;
  },
  errorComponent: ({ error }) => (
    <main className="mx-auto w-full max-w-3xl px-5 py-14" role="alert">
      <h1 className="text-2xl font-semibold">Sayfa şu anda görüntülenemiyor</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto w-full max-w-3xl px-5 py-14">
      <h1 className="text-2xl font-semibold">Sayfa bulunamadı</h1>
    </main>
  ),
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — Mefticaret` },
      { name: "description", content: "Mefticaret kurumsal bilgilendirme sayfası." },
      { property: "og:title", content: `${params.slug} — Mefticaret` },
      { property: "og:description", content: "Mefticaret kurumsal bilgilendirme sayfası." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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
        <article className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
          {data.excerpt ? <p className="mt-3 text-muted-foreground">{data.excerpt}</p> : null}
          <div className="mt-8 space-y-4 leading-relaxed whitespace-pre-line">{data.body}</div>
        </article>
      )}
    </main>
  );
}
