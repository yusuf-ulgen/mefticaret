import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { sectionIcon, type SiteSection, type SiteSectionItem } from "@/lib/site-content";

/**
 * Ana sayfa üst menüsündeki mega menü.
 * İçerik `site_sections` içindeki `header_mega` bölümünden gelir ve
 * süper yönetici panelindeki Ana Sayfa Yönetimi ekranından düzenlenir.
 */

type MenuTree = { menu: string; groups: { group: string; items: SiteSectionItem[] }[] }[];

function buildTree(items: SiteSectionItem[]): MenuTree {
  const tree: MenuTree = [];
  for (const item of items) {
    const menuName = item["menu"]?.trim() || "Menü";
    const groupName = item["group"]?.trim() || "Bağlantılar";
    let menu = tree.find((entry) => entry.menu === menuName);
    if (!menu) {
      menu = { menu: menuName, groups: [] };
      tree.push(menu);
    }
    let group = menu.groups.find((entry) => entry.group === groupName);
    if (!group) {
      group = { group: groupName, items: [] };
      menu.groups.push(group);
    }
    group.items.push(item);
  }
  return tree;
}

function PanelLinks({ groups, onNavigate }: { groups: MenuTree[number]["groups"]; onNavigate: () => void }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map((group) => (
        <div key={group.group}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">{group.group}</p>
          <ul className="mt-3 space-y-1">
            {group.items.map((item, index) => {
              const Icon = sectionIcon(item["icon"]);
              return (
                <li key={`${item["label"]}-${index}`}>
                  <a
                    href={item["href"] || "#"}
                    onClick={onNavigate}
                    className="flex gap-3 rounded-xl p-2 transition-colors hover:bg-secondary"
                  >
                    <Icon className="mt-0.5 size-4 shrink-0 text-brand" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        {item["label"]}
                        {item["badge"] ? (
                          <span className="rounded-full bg-brand/12 px-2 py-0.5 text-[10px] font-bold text-brand">
                            {item["badge"]}
                          </span>
                        ) : null}
                      </span>
                      {item["desc"] ? (
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          {item["desc"]}
                        </span>
                      ) : null}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Masaüstü: hover/klavye ile açılan geniş panel. */
export function LandingMegaMenu({
  section,
  extraLinks,
}: {
  section: SiteSection;
  extraLinks: SiteSectionItem[];
}) {
  const tree = buildTree(section.items);
  const [open, setOpen] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const schedule = (value: string | null) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(value), value ? 60 : 140);
  };

  if (tree.length === 0) return null;

  return (
    <nav aria-label="Ana gezinme" className="hidden items-center gap-6 text-sm font-medium md:flex">
      {tree.map((menu) => {
        const isOpen = open === menu.menu;
        return (
          <div
            key={menu.menu}
            className="relative"
            onMouseEnter={() => schedule(menu.menu)}
            onMouseLeave={() => schedule(null)}
          >
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : menu.menu)}
              className="flex items-center gap-1 py-2 text-muted-foreground transition-colors hover:text-foreground data-[open=true]:text-foreground"
              data-open={isOpen}
            >
              {menu.menu}
              <ChevronDown className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen ? (
              <div className="absolute left-1/2 top-full z-40 w-[min(52rem,90vw)] -translate-x-1/2 pt-3">
                <div className="surface-card rounded-3xl border border-border bg-background p-6 shadow-xl">
                  <PanelLinks groups={menu.groups} onNavigate={() => setOpen(null)} />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}

      {extraLinks.map((item, index) => (
        <a
          key={`${item["label"]}-${index}`}
          href={item["href"] || "#"}
          className="py-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          {item["label"]}
        </a>
      ))}
    </nav>
  );
}

/** Mobil: tam genişlikte açılır menü listesi. */
export function LandingMobileMenu({
  section,
  extraLinks,
  open,
  onClose,
}: {
  section: SiteSection | null;
  extraLinks: SiteSectionItem[];
  open: boolean;
  onClose: () => void;
}) {
  const tree = buildTree(section?.items ?? []);
  if (!open) return null;

  return (
    <div className="border-t border-border bg-background px-4 py-5 md:hidden">
      <div className="space-y-6">
        {tree.map((menu) => (
          <div key={menu.menu}>
            <p className="font-display text-base font-bold">{menu.menu}</p>
            <div className="mt-3">
              <PanelLinks groups={menu.groups} onNavigate={onClose} />
            </div>
          </div>
        ))}
        {extraLinks.length ? (
          <ul className="space-y-2 border-t border-border pt-4">
            {extraLinks.map((item, index) => (
              <li key={`${item["label"]}-${index}`}>
                <a href={item["href"] || "#"} onClick={onClose} className="text-sm font-semibold">
                  {item["label"]}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
