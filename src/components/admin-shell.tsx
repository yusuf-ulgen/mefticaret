import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronDown, Menu, Search, ShieldAlert, ShieldCheck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ADMIN_NAV, ADMIN_QUICK_ACTIONS, filterAdminNav } from "@/lib/admin-nav";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

/** Süper admin panelinin bağımsız kabuğu: mega menü, yan menü ve erişim kontrolü. */

const NAV = ADMIN_NAV;

function isActivePath(pathname: string, to: string) {
  return to === "/admin" ? pathname === "/admin" : pathname.startsWith(to);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav className="space-y-1.5 px-3 py-4">
      {NAV.map((group) => (
        <details
          key={group.title}
          open={group.items.some((item) => isActivePath(pathname, item.to))}
          className="group rounded-xl"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-2.5 py-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition hover:bg-muted/70 hover:text-foreground">
            {group.title}
            <ChevronDown className="size-3.5 transition group-open:rotate-180" />
          </summary>
          <ul className="mt-1 space-y-0.5 border-l border-border/70 pl-2">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition",
                      active
                        ? "bg-foreground font-medium text-background"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </nav>
  );
}

/** Tüm yönetim alanlarını tek panelde açan mega menü. */
function MegaMenu() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const groups = filterAdminNav(term);

  useEffect(() => {
    setOpen(false);
    setTerm("");
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
        <span className="hidden sm:inline">Tüm yönetim</span>
        <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} />
      </Button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Menüyü kapat"
            className="fixed inset-0 z-40 cursor-default bg-foreground/10"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            aria-label="Süper admin mega menü"
            className="surface-card absolute left-0 z-50 mt-2 max-h-[75vh] w-[min(92vw,64rem)] overflow-y-auto p-4 shadow-xl"
          >
            <div className="relative mb-4 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Ara: ön uç, blog, tema, ödeme…"
                className="pl-9"
                aria-label="Yönetim menüsünde ara"
              />
            </div>

            {groups.length === 0 ? (
              <p className="px-1 py-6 text-sm text-muted-foreground">Sonuç bulunamadı.</p>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {groups.map((group) => (
                  <section key={group.title}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {group.title}
                    </p>
                    <p className="mb-2 text-[11px] text-muted-foreground">{group.description}</p>
                    <ul className="space-y-0.5">
                      {group.items.map((item) => {
                        const active = isActivePath(pathname, item.to);
                        return (
                          <li key={item.to}>
                            <Link
                              to={item.to}
                              onClick={() => setOpen(false)}
                              className={cn(
                                "flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition",
                                active
                                  ? "bg-primary/10 font-medium text-primary"
                                  : "hover:bg-muted/60",
                              )}
                            >
                              <item.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                              <span className="min-w-0">
                                <span className="block truncate">{item.label}</span>
                                {item.hint ? (
                                  <span className="block truncate text-[11px] text-muted-foreground">
                                    {item.hint}
                                  </span>
                                ) : null}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}


export function AdminShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { isPlatformAdmin, loading } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!loading && !isPlatformAdmin) {
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="surface-card flex max-w-md flex-col items-center gap-4 px-6 py-14 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold">Erişim yetkiniz yok</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Süper admin paneli yalnızca platform yöneticilerine açıktır. Yetkiler veritabanı seviyesinde
              denetlenir.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/stores">Mağazalarıma dön</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <a href="#admin-content" className="skip-link">
        İçeriğe geç
      </a>
      <aside
        aria-label="Süper admin menüsü"
        className="hidden w-64 shrink-0 border-r border-border/70 bg-card/70 backdrop-blur lg:block"
      >
        <div className="sticky top-0 flex h-16 items-center gap-2.5 border-b border-border/70 bg-card/80 px-4 backdrop-blur">
          <span className="grid size-9 place-items-center rounded-xl bg-foreground text-background">
            <ShieldCheck className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold tracking-tight">Süper Admin</p>
            <p className="text-[11px] text-muted-foreground">Mefticaret platformu</p>
          </div>
        </div>
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto pb-6">
          <NavLinks />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b border-border/70 bg-card/75 px-3 py-2.5 backdrop-blur-md lg:px-5">
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-label="Menüyü aç"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
          </Button>
          <MegaMenu />
          <nav
            aria-label="Hızlı erişim"
            className="flex flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {ADMIN_QUICK_ACTIONS.map((item) => (
              <Button
                key={item.to}
                asChild
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground"
              >
                <Link to={item.to}>
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
          <Button asChild size="sm" className="shrink-0 rounded-full text-xs">
            <Link to="/stores">Mağaza paneli</Link>
          </Button>
        </div>

        <main id="admin-content" tabIndex={-1} className="min-w-0 flex-1 p-3 lg:p-6">
          <header className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-border/70 bg-card px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:px-6 lg:py-5">
            <div className="min-w-0">
              <p className="eyebrow mb-1">Yönetim</p>
              <h1 className="truncate font-display text-xl font-semibold tracking-tight lg:text-2xl">{title}</h1>
              {description ? (
                <p className="mt-1 max-w-2xl text-xs text-muted-foreground lg:text-sm">{description}</p>
              ) : null}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
          </header>
          <div className="space-y-4">{children}</div>
        </main>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 overflow-y-auto p-0">
          <NavLinks onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
