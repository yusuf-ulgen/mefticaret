import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { GUIDES, audienceLabel, guideBySlug } from "@/lib/guides";

export const Route = createFileRoute("/rehberler/$slug")({
  loader: ({ params }) => {
    const guide = guideBySlug(params.slug);
    if (!guide) throw notFound();
    return { guide };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Rehber bulunamadı — Mefticaret" }, { name: "robots", content: "noindex" }] };
    const { guide } = loaderData;
    const url = `https://mefticaret.com/rehberler/${params.slug}`;
    const title = `${guide.title} — Mefticaret Rehberleri`;
    return {
      meta: [
        { title },
        { name: "description", content: guide.summary },
        { property: "og:title", content: title },
        { property: "og:description", content: guide.summary },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: guide.title,
          description: guide.summary,
          step: guide.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.title, text: s.body })),
        }),
      }],
    };
  },
  notFoundComponent: GuideNotFound,
  component: GuidePage,
});

function GuideNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-20 text-center">
      <h1 className="text-2xl font-semibold">Rehber bulunamadı</h1>
      <Link to="/rehberler" className="mt-4 inline-block text-primary">Tüm rehberler</Link>
    </main>
  );
}

function GuidePage() {
  const { guide } = Route.useLoaderData();
  const related = GUIDES.filter((g) => g.audience === guide.audience && g.slug !== guide.slug);
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link to="/rehberler" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Tüm rehberler
        </Link>
        <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-primary">{audienceLabel(guide.audience)}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{guide.title}</h1>
        <p className="mt-3 text-muted-foreground">{guide.summary}</p>
        <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><Clock className="h-3.5 w-3.5" />{guide.minutes} dakikalık okuma</p>

        <ol className="mt-10 space-y-6">
          {guide.steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-2xl border border-border p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">{i + 1}</span>
              <div>
                <h2 className="font-semibold">{s.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                {s.bullets && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {s.bullets.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>

        {guide.cta && (
          <Button asChild className="mt-8 rounded-full">
            <a href={guide.cta.to}>{guide.cta.label}</a>
          </Button>
        )}

        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="text-lg font-semibold">İlgili rehberler</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((g) => (
                <Link key={g.slug} to="/rehberler/$slug" params={{ slug: g.slug }} className="rounded-xl border border-border p-4 text-sm hover:border-foreground">
                  <span className="font-medium">{g.title}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
