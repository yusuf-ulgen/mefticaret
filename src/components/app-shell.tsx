import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  ChevronsUpDown,
  ChevronDown,
  LogOut,
  Menu,
  Pin,
  PinOff,
  Plus,
  Rocket,
  Search,
  Store,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AiCreditBadge } from "@/components/ai-credit-badge";
import { CommandPalette } from "@/components/command-palette";
import { NotificationBell } from "@/components/notification-bell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { myStoresQuery } from "@/lib/store-queries";
import { STORE_ROLE_LABELS } from "@/lib/mefti";
import { PanelBottomNav } from "@/components/panel-bottom-nav";
import { storeNavGroups, storeQuickLinks, type StoreNavItem } from "@/lib/store-nav";
import { useRecentPaths } from "@/lib/store-recent-nav";
import { storeEntitlementsQuery } from "@/lib/entitlements-queries";
import { moduleKeyForPath } from "@/lib/plan-features";
import { cn } from "@/lib/utils";
import { useSellerDesignV2 } from "@/lib/seller-design";
import { useSellerDesignV2 } from "@/lib/seller-design";

const PIN_STORAGE_KEY = "mefti:pinned-nav";

function usePinnedNav() {
  const [pinned, setPinned] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PIN_STORAGE_KEY);
      if (raw) setPinned(JSON.parse(raw) as string[]);
    } catch {
      /* yoksay */
    }
  }, []);

  function toggle(label: string) {
    setPinned((prev) => {
      const next = prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label];
      try {
        window.localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* yoksay */
      }
      return next;
    });
  }

  return { pinned, toggle };
}

function NavLinkRow({
  item,
  active,
  pinned,
  onTogglePin,
  onNavigate,
}: {
  item: StoreNavItem;
  active: boolean;
  pinned: boolean;
  onTogglePin: (label: string) => void;
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <li className="group/nav relative">
      <Link
        to={item.to}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-lg py-1.5 pl-2 pr-8 text-[0.84rem] font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          active && "bg-sidebar-accent font-semibold text-sidebar-accent-foreground",
        )}
      >
        <item.icon className="size-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
      <button
        type="button"
        onClick={() => onTogglePin(item.label)}
        aria-label={pinned ? `${item.label} sabitlemesini kaldır` : `${item.label} sabitle`}
        className={cn(
          "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-sidebar-foreground/45 opacity-0 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:opacity-100 group-hover/nav:opacity-100",
          pinned && "opacity-100 text-sidebar-foreground/80",
        )}
      >
        {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
      </button>
    </li>
  );
}

function NavList({ storeId, onNavigate }: { storeId: string; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [query, setQuery] = useState("");
  const { pinned, toggle } = usePinnedNav();
  const baseGroups = useMemo(() => storeNavGroups(storeId), [storeId]);
  const { data: entitlements } = useQuery(storeEntitlementsQuery(storeId));

  // Paketin kapsamadığı modüller menüde gösterilmez; asıl kontrol sunucudadır.
  const groups = useMemo(() => {
    if (!entitlements) return baseGroups;
    return baseGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const moduleKey = moduleKeyForPath(item.to);
          return !moduleKey || entitlements.modules[moduleKey] === true;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [baseGroups, entitlements]);

  const term = query.trim().toLocaleLowerCase("tr");
  const filtered = useMemo(() => {
    if (!term) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${item.label} ${item.keywords ?? ""}`.toLocaleLowerCase("tr").includes(term),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, term]);

  const pinnedItems = useMemo(
    () => groups.flatMap((group) => group.items).filter((item) => pinned.includes(item.label)),
    [groups, pinned],
  );

  // Son ziyaret edilen ekranlar, sabitlenmemiş olanlar arasından gösterilir.
  const { recent, clear: clearRecent } = useRecentPaths(storeId);
  const recentItems = useMemo(() => {
    const all = groups.flatMap((group) => group.items);
    return recent
      .map((path) => all.find((item) => item.to === path))
      .filter((item): item is StoreNavItem => Boolean(item))
      .filter((item) => !pinned.includes(item.label))
      .slice(0, 5);
  }, [groups, recent, pinned]);

  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const activeGroup = groups.find((group) =>
    group.items.some((item) => pathname.startsWith(item.to)),
  )?.group;

  const isOpen = (group: string) =>
    Boolean(term) ||
    openGroups.includes(group) ||
    (openGroups.length === 0 && group === activeGroup);

  function toggleGroup(group: string) {
    setOpenGroups((prev) => {
      const base = prev.length === 0 && activeGroup ? [activeGroup] : prev;
      return base.includes(group) ? base.filter((g) => g !== group) : [...base, group];
    });
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-sidebar-foreground/50" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Menüde ara…"
          aria-label="Menüde ara"
          className="h-9 border-sidebar-border bg-sidebar-accent/40 pl-8 pr-8 text-sm"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Aramayı temizle"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-sidebar-foreground/60 hover:text-sidebar-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <nav aria-label="Mağaza menüsü" className="space-y-1.5">
        {!term && pinnedItems.length ? (
          <div className="pb-1">
            <p className="px-2 pb-1 text-[0.66rem] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              Sabitlenenler
            </p>
            <ul className="space-y-0.5">
              {pinnedItems.map((item) => (
                <NavLinkRow
                  key={`pin-${item.label}`}
                  item={item}
                  active={pathname === item.to}
                  pinned
                  onTogglePin={toggle}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {!term && recentItems.length ? (
          <div className="pb-1">
            <div className="flex items-center justify-between gap-2 px-2 pb-1">
              <p className="text-[0.66rem] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                Son kullanılanlar
              </p>
              <button
                type="button"
                onClick={clearRecent}
                className="text-[0.66rem] text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground"
              >
                Temizle
              </button>
            </div>
            <ul className="space-y-0.5">
              {recentItems.map((item) => (
                <NavLinkRow
                  key={`recent-${item.label}`}
                  item={item}
                  active={pathname === item.to}
                  pinned={false}
                  onTogglePin={toggle}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-sidebar-foreground/60">
            Sonuç bulunamadı.
          </p>
        ) : null}

        {filtered.map((group) => {
          const open = isOpen(group.group);
          const hasActive = group.items.some((item) => pathname === item.to);
          return (
            <div key={group.group}>
              <button
                type="button"
                onClick={() => toggleGroup(group.group)}
                aria-expanded={open}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[0.78rem] font-semibold uppercase tracking-wide text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  hasActive && "text-sidebar-foreground",
                )}
              >
                <group.icon className="size-4 shrink-0" />
                <span className="truncate">{group.group}</span>
                <ChevronDown
                  className={cn(
                    "ml-auto size-3.5 shrink-0 transition-transform",
                    open ? "rotate-0" : "-rotate-90",
                  )}
                />
              </button>
              {open ? (
                <ul className="mt-0.5 space-y-0.5 border-l border-sidebar-border/70 pl-2 ml-3.5">
                  {group.items.map((item) => (
                    <NavLinkRow
                      key={item.label}
                      item={item}
                      active={pathname === item.to}
                      pinned={pinned.includes(item.label)}
                      onTogglePin={toggle}
                      onNavigate={onNavigate}
                    />
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

function StoreSwitcher({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const { data: stores } = useQuery(myStoresQuery(user?.id));
  const active = stores?.find((store) => store.id === storeId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 px-3 py-2.5 text-left transition-colors hover:bg-sidebar-accent">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg brand-gradient text-sm font-bold text-brand-foreground">
            {(active?.name ?? "M").slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-sidebar-foreground">
              {active?.name ?? "Mağaza seç"}
            </span>
            <span className="block truncate text-xs text-sidebar-foreground/60">
              {STORE_ROLE_LABELS[active?.myRole ?? "staff"]}
            </span>
          </span>
          <ChevronsUpDown className="size-4 text-sidebar-foreground/60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Mağazalarım</DropdownMenuLabel>
        {(stores ?? []).map((store) => (
          <DropdownMenuItem key={store.id} asChild>
            <Link
              to="/store/$storeId/dashboard"
              params={{ storeId: store.id }}
              className="flex items-center gap-2"
            >
              <Store className="size-4" />
              <span className="truncate">{store.name}</span>
              {store.id === storeId ? <Badge className="ml-auto">Aktif</Badge> : null}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/stores" className="flex items-center gap-2">
            <Boxes className="size-4" /> Tüm mağazalar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/sellers" className="flex items-center gap-2">
            <Store className="size-4" /> Pazaryeri satıcılığı
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/onboarding" className="flex items-center gap-2">
            <Plus className="size-4" /> Yeni mağaza oluştur
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    void navigate({ to: "/auth", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-sidebar-primary-foreground hover:bg-white/10 hover:text-sidebar-primary-foreground"
        >
          <span className="grid size-6 place-items-center rounded-md bg-primary text-[0.7rem] font-bold text-primary-foreground">
            {(profile?.full_name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="hidden max-w-[9rem] truncate sm:inline">
            {profile?.full_name ?? user?.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/stores">Mağazalarım</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 size-4" /> Çıkış yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function QuickLinks({ storeId }: { storeId: string }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const links = useMemo(() => storeQuickLinks(storeId), [storeId]);

  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {links.map((link) => {
        const active = pathname === link.to;
        return (
          <Link
            key={link.label}
            to={link.to}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground",
              active && "border-transparent bg-foreground text-background hover:text-background",
            )}
          >
            <link.icon className="size-3.5" />
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AppShell({
  storeId,
  title,
  description,
  actions,
  children,
}: {
  storeId?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const v2 = useSellerDesignV2();

  const sidebar = storeId ? (
    <div className={cn("flex h-full min-h-0 flex-col gap-4 p-3", v2 && "seller-v2-nav")}>
      <div className="lg:hidden">
        <Link to="/stores" className="flex items-center gap-2 px-1 py-1">
          <span className="grid size-8 place-items-center rounded-lg brand-gradient text-brand-foreground">
            <Rocket className="size-4" />
          </span>
          <span className="font-display text-lg font-semibold text-sidebar-foreground">
            Mefticaret
          </span>
        </Link>
      </div>
      <StoreSwitcher storeId={storeId} />
      <div className="-mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
        <NavList storeId={storeId} onNavigate={() => setOpen(false)} />
      </div>
    </div>
  ) : null;

  return (
    <div className={cn("min-h-screen", v2 ? "seller-v2 bg-background text-foreground" : "bg-muted/40")}>
      <a href="#panel-content" className="skip-link">
        İçeriğe geç
      </a>

      {/* Koyu üst çubuk — referans panel düzeniyle aynı hizada */}
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 bg-sidebar-primary px-3 text-sidebar-primary-foreground lg:px-4">
        {sidebar ? (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-primary-foreground hover:bg-white/10 lg:hidden"
                aria-label="Menüyü aç"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className={cn("w-80 border-sidebar-border bg-sidebar p-0", v2 && "seller-v2")}>
              <SheetTitle className="sr-only">Mağaza menüsü</SheetTitle>
              {sidebar}
            </SheetContent>
          </Sheet>
        ) : null}

        <Link to="/stores" className="flex shrink-0 items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md brand-gradient text-brand-foreground">
            <Rocket className="size-4" />
          </span>
          <span className="hidden font-display text-base font-semibold sm:inline">Mefticaret</span>
        </Link>

        <div className="mx-auto hidden w-full max-w-xl sm:block">
          {storeId ? <CommandPalette storeId={storeId} /> : null}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <div className="sm:hidden">{storeId ? <CommandPalette storeId={storeId} /> : null}</div>
          {storeId ? <AiCreditBadge storeId={storeId} /> : null}
          {storeId ? <NotificationBell storeId={storeId} /> : null}
          <UserMenu />
        </div>
      </header>

      <div className="flex">
        {sidebar ? (
          <aside className={cn("sticky top-16 hidden h-[calc(100vh-4rem)] w-[17rem] shrink-0 border-r border-sidebar-border/70 lg:block", v2 ? "bg-sidebar" : "bg-card")}>
            {sidebar}
          </aside>
        ) : null}

        <main
          id="panel-content"
          tabIndex={-1}
          className={cn(
            "min-w-0 flex-1 px-3 py-4 sm:px-5 lg:px-8 lg:py-6",
            storeId && "pb-24 lg:pb-6",
          )}
        >
          <div className="mx-auto w-full max-w-6xl space-y-4">
            {storeId ? <QuickLinks storeId={storeId} /> : null}
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] lg:px-6 lg:py-5">
              <div className="min-w-0">
                <p className={cn("eyebrow mb-1", v2 && "text-primary")}>Mağaza paneli</p>
                <h1 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
                  {title}
                </h1>
                {description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                ) : null}
              </div>
              {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
            </div>
            {children}
          </div>
        </main>
      </div>

      {storeId ? <PanelBottomNav storeId={storeId} /> : null}
    </div>
  );
}
