import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { publicPlatformPostQuery } from "@/lib/platform-blog-queries";
import { formatDateTime } from "@/lib/mefti";

/** Platform blog yazısı detay sayfası. */

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ context, params }) => {
    try {
      const post = await context.queryClient.ensureQueryData(publicPlatformPostQuery(params.slug));
      return { post: post ?? null };
    } catch (error) {
      console.error(error);
      return { post: null };
    }
  },
  errorComponent: ({ error }) => (
    <main className="mx-auto w-full max-w-3xl px-5 py-14" role="alert">
      <h1 className="text-2xl font-semibold">Yazı şu anda görüntülenemiyor</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto w-full max-w-3xl px-5 py-14">
      <h1 className="text-2xl font-semibold">Yazı bulunamadı</h1>
    </main>
  ),
  head: ({ params, loaderData }) => {
    const post = loaderData?.post;
    const title = post ? `${post.meta_title || post.title} — Mefticaret Blog` : "Mefticaret Blog";
    const description =
      post?.seo_description ||
      post?.excerpt ||
      "Mefticaret blogunda e-ticaret, pazaryeri ve büyüme rehberleri.";
    const cover = post?.cover_url;
    const absoluteCover = cover && /^https:\/\//.test(cover) ? cover : null;
    const canonical = post?.canonical_url && /^https?:\/\//.test(post.canonical_url)
      ? post.canonical_url
      : null;

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(absoluteCover
          ? [
              { property: "og:image", content: absoluteCover },
              { name: "twitter:image", content: absoluteCover },
            ]
          : []),
      ],
      links: canonical ? [{ rel: "canonical", href: canonical }] : [],
    };
  },
  component: BlogPostPage,
});


function BlogPostPage() {
  const { slug } = Route.useParams();
  const { data, isLoading } = useQuery(publicPlatformPostQuery(slug));

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14">
      <Link to="/blog" className="text-sm text-muted-foreground hover:underline">
        ← Tüm yazılar
      </Link>
      {isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Yükleniyor…</p>
      ) : !data ? (
        <div className="mt-8">
          <h1 className="text-2xl font-semibold">Yazı bulunamadı</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Aradığın yazı yayından kaldırılmış olabilir.
          </p>
        </div>
      ) : (
        <article className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight">{data.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {data.author_name ? `${data.author_name} • ` : ""}
            {data.published_at ? formatDateTime(data.published_at) : ""}
          </p>
          {data.cover_url ? (
            <img
              src={data.cover_url}
              alt={data.title}
              className="mt-6 w-full rounded-xl object-cover"
            />
          ) : null}
          {data.excerpt ? <p className="mt-5 text-muted-foreground">{data.excerpt}</p> : null}
          <div className="mt-8 space-y-4 leading-relaxed whitespace-pre-line">{data.body}</div>
          {(data.tags ?? []).length > 0 ? (
            <p className="mt-8 text-xs text-muted-foreground">
              Etiketler: {(data.tags ?? []).join(", ")}
            </p>
          ) : null}
        </article>
      )}
    </main>
  );
}
