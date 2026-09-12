import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutGrid, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { panelSections } from "@/lib/panel-catalog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/store/$storeId/panels")({
  head: () => ({
    meta: [
      { title: "Tüm Paneller — Mefticaret" },
      {
        name: "description",
        content:
          "Mağaza panelindeki tüm ekranlar tek sayfada: katalog, sipariş, müşteri, pazarlama, finans ve rapor ekranları.",
      },
      { property: "og:title", content: "Tüm Paneller — Mefticaret" },
      {
        property: "og:description",
        content: "Mağaza yönetim ekranlarının tamamı kategori kategori tek listede.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PanelsPage,
});

const FAV_KEY = "mefti.panel.favs";

function PanelsPage() {
  const { storeId } = Route.useParams();
  const sections = useMemo(() => panelSections(storeId), [storeId]);
  const [term, setTerm] = useState("");
  const [active, setActive] = useState<string>("all");
  const [favs, setFavs] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(FAV_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const toggleFav = (to: string) =>
    setFavs((prev) => {
      const next = prev.includes(to) ? prev.filter((x) => x !== to) : [...prev, to];
      try {
        window.localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        /* depolama kapalıysa yoksay */
      }
      return next;
    });

  const query = term.trim().toLocaleLowerCase("tr");

  const visible = useMemo(
    () =>
      sections
        .filter((section) => active === "all" || section.group === active)
        .map((section) => ({
          ...section,
          cards: query ? section.cards.filter((card) => card.search.includes(query)) : section.cards,
        }))
        .filter((section) => section.cards.length > 0),
    [sections, active, query],
  );

  const totalScreens = sections.reduce(
    (sum, s) => sum + s.cards.reduce((i, c) => i + 1 + c.related.length, 0),
    0,
  );
  const totalCards = sections.reduce((sum, s) => sum + s.cards.length, 0);
  const shownCards = visible.reduce((sum, s) => sum + s.cards.length, 0);

  const favCards = useMemo(
    () => sections.flatMap((s) => s.cards).filter((card) => favs.includes(card.main.to)),
    [sections, favs],
  );

  return (
    <AppShell
      storeId={storeId}
      title="Tüm Paneller"
      description={`${totalScreens} yönetim ekranı, ${totalCards} başlıkta birleştirildi.`}
    >
      {/* Filtre şeridi */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Panel ara…"
              className="h-10 pl-8"
              inputMode="search"
            />
          </div>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {shownCards}/{totalCards}
          </span>
        </div>

        <div className="-mx-1 mt-3 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1">
          {[{ group: "all" }, ...sections].map((section) => {
            const value = "group" in section ? section.group : "all";
            const label = value === "all" ? "Tümü" : value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setActive(value)}
                className={cn(
                  "shrink-0 snap-start rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  active === value
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {favCards.length > 0 && !query && active === "all" ? (
        <section className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Star className="size-4" /> Sık kullandıklarım
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {favCards.map((card) => (
              <PanelCardView
                key={`fav-${card.main.to}`}
                card={card}
                favorite
                onToggleFav={toggleFav}
              />
            ))}
          </div>
        </section>
      ) : null}

      {visible.length === 0 ? (
        <div className="surface-card p-10 text-center">
          <LayoutGrid className="mx-auto mb-3 size-6 text-muted-foreground" />
          <p className="font-medium">Bu aramada panel yok</p>
          <p className="text-sm text-muted-foreground">Başka bir kelime dene.</p>
        </div>
      ) : (
        <div className="space-y-7">
          {visible.map((section) => {
            const GroupIcon = section.icon;
            return (
              <section key={section.group}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <GroupIcon className="size-4" /> {section.group}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {section.cards.length}
                  </span>
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {section.cards.map((card) => (
                    <PanelCardView
                      key={card.main.to}
                      card={card}
                      favorite={favs.includes(card.main.to)}
                      onToggleFav={toggleFav}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function PanelCardView({
  card,
  favorite,
  onToggleFav,
}: {
  card: ReturnType<typeof panelSections>[number]["cards"][number];
  favorite: boolean;
  onToggleFav: (to: string) => void;
}) {
  const Icon = card.main.icon;
  return (
    <div className="surface-card relative flex h-full flex-col p-4 transition-shadow hover:shadow-md">
      <button
        type="button"
        aria-label={favorite ? `${card.main.label} favorilerden çıkar` : `${card.main.label} favorilere ekle`}
        onClick={() => onToggleFav(card.main.to)}
        className="absolute right-2.5 top-2.5 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted"
      >
        <Star className={cn("size-4", favorite && "fill-current text-foreground")} />
      </button>

      <Link to={card.main.to} className="flex min-w-0 items-start gap-3 pr-8">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-muted">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{card.main.label}</span>
          {card.description ? (
            <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
              {card.description}
            </span>
          ) : null}
        </span>
      </Link>

      {card.related.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
          {card.related.map((child) => (
            <Link
              key={child.to}
              to={child.to}
              className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {child.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
