import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [category, setCategory] = useState<string>("all");
  const [term, setTerm] = useState("");

  const categories = useMemo(
    () =>
      [...new Set((posts ?? []).map((post) => (post.category ?? "").trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "tr"),
      ),
    [posts],
  );

  const visible = useMemo(() => {
    const needle = term.trim().toLocaleLowerCase("tr");
    return (posts ?? []).filter((post) => {
      if (category !== "all" && (post.category ?? "") !== category) return false;
      if (!needle) return true;
      return `${post.title} ${post.excerpt ?? ""} ${post.category ?? ""} ${(post.tags ?? []).join(" ")}`
        .toLocaleLowerCase("tr")
        .includes(needle);
    });
  }, [posts, category, term]);

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-14">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Ana sayfa
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Mefticaret Blog</h1>
      <p className="mt-3 text-muted-foreground">{DESCRIPTION}</p>

      <div className="mt-8 space-y-4">
        <Input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Yazılarda ara…"
          aria-label="Yazılarda ara"
          className="max-w-md"
        />
        {categories.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {["all", ...categories].map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={category === item ? "default" : "outline"}
                className="rounded-full"
                onClick={() => setCategory(item)}
              >
                {item === "all" ? "Tümü" : item}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-10 text-sm text-muted-foreground">Yükleniyor…</p>
      ) : visible.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          {(posts ?? []).length === 0
            ? "Henüz yayınlanmış bir yazı yok."
            : "Aramanla eşleşen yazı bulunamadı."}
        </p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {visible.map((post) => (
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
              {post.category ? <span className="eyebrow">{post.category}</span> : null}
              <h2 className="mt-2 text-lg font-semibold group-hover:underline">{post.title}</h2>
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
