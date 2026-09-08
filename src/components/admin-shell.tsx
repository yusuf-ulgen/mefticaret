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
    <nav className="space-y-2 px-3 py-4">
      {NAV.map((group) => (
        <details
          key={group.title}
          open={group.items.some((item) => isActivePath(pathname, item.to))}
          className="group rounded-lg"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/60 hover:text-foreground">
            {group.title}
            <ChevronDown className="size-3.5 transition group-open:rotate-180" />
          </summary>
          <ul className="mt-0.5 space-y-0.5">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
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
    <div className="flex min-h-screen w-full bg-muted/20">
      <a href="#admin-content" className="skip-link">
        İçeriğe geç
      </a>
      <aside aria-label="Süper admin menüsü" className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">

        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="size-4" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-sm font-semibold">Süper Admin</p>
            <p className="text-[11px] text-muted-foreground">Mefticaret platformu</p>
          </div>
        </div>
        <div className="max-h-[calc(100vh-3.5rem)] overflow-y-auto">
          <NavLinks />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2">
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
          <nav aria-label="Hızlı erişim" className="flex flex-1 items-center gap-1 overflow-x-auto">
            {ADMIN_QUICK_ACTIONS.map((item) => (
              <Button key={item.to} asChild variant="ghost" size="sm" className="shrink-0 gap-1.5 text-xs">
                <Link to={item.to}>
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              </Button>
            ))}
          </nav>
          <Button asChild variant="ghost" size="sm" className="shrink-0 text-xs">
            <Link to="/stores">Mağaza paneli</Link>
          </Button>
        </div>
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-semibold">{title}</h1>
            {description ? (
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">{actions}</div>
        </header>

        <main id="admin-content" tabIndex={-1} className="min-w-0 flex-1 space-y-4 p-4 lg:p-6">
          {children}
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
