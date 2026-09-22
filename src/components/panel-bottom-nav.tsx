import { Link, useRouterState } from "@tanstack/react-router";
import { Grid3x3, LayoutDashboard, Package, ShoppingBag, Users } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Mobil alt gezinme çubuğu — satıcı panelinde en sık kullanılan beş ekran
 * tek dokunuşla erişilebilir olsun diye. Masaüstünde gizlidir (yan menü var).
 */
export function PanelBottomNav({ storeId }: { storeId: string }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const p = (path: string) => `/store/${storeId}/${path}`;

  const items = [
    { label: "Panel", to: p("dashboard"), icon: LayoutDashboard },
    { label: "Siparişler", to: p("orders"), icon: ShoppingBag },
    { label: "Ürünler", to: p("products"), icon: Package },
    { label: "Müşteriler", to: p("customers"), icon: Users },
    { label: "Tümü", to: p("panels"), icon: Grid3x3 },
  ];

  return (
    <nav
      aria-label="Hızlı gezinme"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const active = pathname === item.to;
          return (
            <li key={item.to}>
              <Link
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[0.66rem] font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <item.icon className={cn("size-5", active && "stroke-[2.4]")} />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
