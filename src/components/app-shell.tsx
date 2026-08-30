import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Boxes,
  ChartNoAxesColumn,
  ChevronsUpDown,
  Cog,
  CreditCard,
  Globe,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Palette,
  Plus,
  Rocket,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  to?: string;
  icon: React.ComponentType<{ className?: string }>;
  phase?: string;
};

function storeNav(storeId: string): { group: string; items: NavItem[] }[] {
  return [
    {
      group: "Genel",
      items: [
        { label: "Panel", to: `/store/${storeId}/dashboard`, icon: LayoutDashboard },
        { label: "Analitik", to: `/store/${storeId}/analytics`, icon: ChartNoAxesColumn },
      ],
    },
    {
      group: "Katalog",
      items: [
        { label: "Ürünler", to: `/store/${storeId}/products`, icon: Package },
        { label: "Koleksiyonlar", to: `/store/${storeId}/collections`, icon: Boxes },
        { label: "Stok", to: `/store/${storeId}/inventory`, icon: Warehouse },
      ],
    },
    {
      group: "Satış",
      items: [
        { label: "Siparişler", to: `/store/${storeId}/orders`, icon: ShoppingBag },
        { label: "Müşteriler", to: `/store/${storeId}/customers`, icon: Users },
        { label: "Terk Sepetler", to: `/store/${storeId}/carts`, icon: ShoppingCart },
        { label: "İndirimler", to: `/store/${storeId}/discounts`, icon: Tag },
        { label: "Finans", to: `/store/${storeId}/finance`, icon: Wallet },
        { label: "Abonelik", to: `/store/${storeId}/billing`, icon: CreditCard },
      ],
    },
    {
      group: "Mağaza",
      items: [
        { label: "Domainler", to: `/store/${storeId}/domains`, icon: Globe },
        { label: "Ekip & Yetkiler", to: `/store/${storeId}/team`, icon: ShieldCheck },
        { label: "Ayarlar", to: `/store/${storeId}/settings`, icon: Cog },
        { label: "Ödeme", to: `/store/${storeId}/payments`, icon: BadgeCheck },
        { label: "Kargo", to: `/store/${storeId}/shipping`, icon: Truck },
        { label: "Temalar", to: `/store/${storeId}/themes`, icon: Palette },
        { label: "AI Asistan", to: `/store/${storeId}/ai`, icon: Sparkles },
        { label: "Denetim Kaydı", to: `/store/${storeId}/activity`, icon: History },
      ],
    },
  ];
}

function NavList({ storeId, onNavigate }: { storeId: string; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav aria-label="Mağaza menüsü" className="space-y-6">
      {storeNav(storeId).map((section) => (
        <div key={section.group}>
          <p className="px-3 pb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            {section.group}
          </p>
          <ul className="space-y-1">
            {section.items.map((item) => {
              const active = item.to ? pathname === item.to : false;
              return (
                <li key={item.label}>
                  {item.to ? (
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        active && "bg-sidebar-accent text-sidebar-accent-foreground",
                      )}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/35"
                      title={`${item.label} — ${item.phase} kapsamında geliyor`}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.label}
                      <span className="ml-auto rounded-full border border-sidebar-border px-1.5 py-0.5 text-[0.6rem] font-semibold">
                        {item.phase}
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
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
          <Link to="/onboarding" className="flex items-center gap-2">
            <Plus className="size-4" /> Yeni mağaza oluştur
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { profile, user, isPlatformAdmin, signOut } = useAuth();
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
        <Button variant="outline" size="sm" className="gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-primary text-[0.7rem] font-bold text-primary-foreground">
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
        {isPlatformAdmin ? (
          <DropdownMenuItem asChild>
            <Link to="/admin">Süper Admin</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 size-4" /> Çıkış yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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

  const sidebar = storeId ? (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to="/stores" className="flex items-center gap-2 px-1">
        <span className="grid size-8 place-items-center rounded-lg brand-gradient text-brand-foreground">
          <Rocket className="size-4" />
        </span>
        <span className="font-display text-lg font-semibold text-sidebar-foreground">
          Mefticaret
        </span>
      </Link>
      <StoreSwitcher storeId={storeId} />
      <div className="flex-1 overflow-y-auto">
        <NavList storeId={storeId} onNavigate={() => setOpen(false)} />
      </div>
    </div>
  ) : null;

  return (
    <div className="flex min-h-screen bg-background">
      {sidebar ? (
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
          {sidebar}
        </aside>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur lg:px-8">
          {sidebar ? (
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="Menüyü aç">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
                <SheetTitle className="sr-only">Mağaza menüsü</SheetTitle>
                {sidebar}
              </SheetContent>
            </Sheet>
          ) : (
            <Link to="/stores" className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg brand-gradient text-brand-foreground">
                <Rocket className="size-4" />
              </span>
              <span className="font-display text-lg font-semibold">Mefticaret</span>
            </Link>
          )}
          <div className="ml-auto flex items-center gap-2">{<UserMenu />}</div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
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
    </div>
  );
}
