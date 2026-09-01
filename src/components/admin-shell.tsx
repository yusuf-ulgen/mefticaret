import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BadgeCheck,
  Bell,
  Blocks,
  ChartNoAxesColumn,
  Coins,
  CreditCard,
  FileText,
  Gauge,
  Globe,
  History,
  LifeBuoy,
  Menu,
  Palette,
  PenLine,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Store,
  Tag,
  Terminal,
  Ticket,
  Users,
  Wallet,
  Webhook,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

/** Süper admin panelinin bağımsız kabuğu: platform yöneticisine özel menü ve erişim kontrolü. */

type NavItem = { to: string; label: string; icon: typeof Store };

const NAV: { title: string; items: NavItem[] }[] = [
  {
    title: "Genel",
    items: [
      { to: "/admin", label: "Dashboard", icon: Gauge },
      { to: "/admin/stores", label: "Mağazalar", icon: Store },
      { to: "/admin/users", label: "Kullanıcılar", icon: Users },
      { to: "/admin/sellers", label: "Satıcılar", icon: BadgeCheck },
      { to: "/admin/marketplace", label: "Marketplace", icon: Globe },
    ],
  },
  {
    title: "Gelir",
    items: [
      { to: "/admin/subscriptions", label: "Abonelikler", icon: Receipt },
      { to: "/admin/plans", label: "Paketler", icon: CreditCard },
      { to: "/admin/payments", label: "Ödemeler", icon: Wallet },
      { to: "/admin/transactions", label: "İşlemler", icon: Coins },
      { to: "/admin/commissions", label: "Komisyonlar", icon: Activity },
    ],
  },
  {
    title: "Ekosistem",
    items: [
      { to: "/admin/themes", label: "Temalar", icon: Palette },
      { to: "/admin/apps", label: "Uygulamalar", icon: Blocks },
      { to: "/admin/api", label: "API", icon: Terminal },
      { to: "/admin/webhooks", label: "Webhook", icon: Webhook },
    ],
  },
  {
    title: "Destek & içerik",
    items: [
      { to: "/admin/support", label: "Destek", icon: LifeBuoy },
      { to: "/admin/tickets", label: "Ticket", icon: Ticket },
      { to: "/admin/cms", label: "CMS", icon: FileText },
      { to: "/admin/blog", label: "Blog", icon: PenLine },
      { to: "/admin/notifications", label: "Bildirimler", icon: Bell },
      { to: "/admin/coupons", label: "Kuponlar", icon: Tag },
    ],
  },
  {
    title: "Sistem",
    items: [
      { to: "/admin/analytics", label: "Analitik", icon: ChartNoAxesColumn },
      { to: "/admin/settings", label: "Sistem ayarları", icon: ShieldCheck },
      { to: "/admin/security", label: "Güvenlik", icon: ShieldAlert },
      { to: "/admin/audit", label: "Audit Logs", icon: History },
    ],
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav className="space-y-5 px-3 py-4">
      {NAV.map((group) => (
        <div key={group.title}>
          <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {group.title}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = item.to === "/admin" ? pathname === "/admin" : pathname.startsWith(item.to);
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
        <header className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3">
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-label="Menüyü aç"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-semibold">{title}</h1>
            {description ? (
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {actions}
            <Button asChild variant="ghost" size="sm">
              <Link to="/stores">Mağaza paneli</Link>
            </Button>
          </div>
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
