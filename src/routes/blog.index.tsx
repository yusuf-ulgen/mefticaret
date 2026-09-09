import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { publicPlatformPostsQuery } from "@/lib/platform-blog-queries";
import { formatDateTime } from "@/lib/mefti";

/** Mefticaret platform blogu — süper yönetici tarafından yönetilir. */

const TITLE = "Mefticaret Blog — E-ticaret rehberleri ve haberler";
const DESCRIPTION =
  "E-ticaret, pazaryeri entegrasyonu, SEO ve büyüme üzerine Mefticaret ekibinden rehberler.";

export const Route = createFileRoute("/blog/")({
  loader: async ({ context }) => {
    try {
      await context.queryClient.ensureQueryData(publicPlatformPostsQuery());
    } catch (error) {
      console.error(error);
    }
    return null;
  },
  errorComponent: ({ error }) => (
    <main className="mx-auto w-full max-w-4xl px-5 py-14" role="alert">
      <h1 className="text-2xl font-semibold">Blog şu anda görüntülenemiyor</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto w-full max-w-4xl px-5 py-14">
      <h1 className="text-2xl font-semibold">Yazı bulunamadı</h1>
    </main>
  ),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const { data: posts, isLoading } = useQuery(publicPlatformPostsQuery());

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-14">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Ana sayfa
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Mefticaret Blog</h1>
      <p className="mt-3 text-muted-foreground">{DESCRIPTION}</p>

      {isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Yükleniyor…</p>
      ) : (posts ?? []).length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">Henüz yayınlanmış bir yazı yok.</p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {(posts ?? []).map((post) => (
            <Link
              key={post.slug}
              to="/blog/$slug"
              params={{ slug: post.slug }}
              className="surface-card group overflow-hidden p-5 transition hover:shadow-md"
            >
              {post.cover_url ? (
                <img
                  src={post.cover_url}
                  alt={post.title}
                  loading="lazy"
                  className="mb-4 h-40 w-full rounded-lg object-cover"
                />
              ) : null}
              <h2 className="text-lg font-semibold group-hover:underline">{post.title}</h2>
              {post.excerpt ? (
                <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
              ) : null}
              <p className="mt-3 text-xs text-muted-foreground">
                {post.author_name ? `${post.author_name} • ` : ""}
                {post.published_at ? formatDateTime(post.published_at) : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
