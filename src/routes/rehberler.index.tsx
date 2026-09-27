import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock } from "lucide-react";

import { GUIDE_AUDIENCES, GUIDES, audienceLabel, type GuideAudience } from "@/lib/guides";

const TITLE = "Rehberler — Mefticaret";
const DESC = "Satıcılar, ev hanımları, tedarikçiler ve müşteriler için adım adım Mefticaret kullanım rehberleri.";

export const Route = createFileRoute("/rehberler/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://mefticaret.com/rehberler" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://mefticaret.com/rehberler" }],
  }),
  component: GuidesPage,
});

function GuidesPage() {
  const [filter, setFilter] = useState<GuideAudience | "all">("all");
  const list = filter === "all" ? GUIDES : GUIDES.filter((g) => g.audience === filter);
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">Mefticaret</Link>
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">Blog</Link>
        </div>
      </header>
      <section className="mx-auto max-w-5xl px-5 pb-8 pt-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Rehberler</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Mefticaret'i adım adım öğren</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">{DESC}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {[{ id: "all" as const, label: "Tümü" }, ...GUIDE_AUDIENCES].map((a) => (
            <button
              key={a.id}
              onClick={() => setFilter(a.id)}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${filter === a.id ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground"}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-5 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((g) => (
          <Link
            key={g.slug}
            to="/rehberler/$slug"
            params={{ slug: g.slug }}
            className="group flex flex-col rounded-2xl border border-border p-5 transition hover:border-foreground"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">{audienceLabel(g.audience)}</span>
            <h2 className="mt-2 text-lg font-semibold leading-snug">{g.title}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{g.summary}</p>
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3.5 w-3.5" />{g.minutes} dk</span>
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
