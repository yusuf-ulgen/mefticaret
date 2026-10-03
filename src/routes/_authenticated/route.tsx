import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // Süper admin bölümü tamamen ayrı bir giriş akışıyla korunur
    // (`/admin/login` + sunucu tarafı panel oturumu), bu yüzden mağaza
    // oturumu burada zorunlu tutulmaz.
    const isAdminArea =
      location.pathname === "/admin" || location.pathname.startsWith("/admin/");
    if (isAdminArea) return;

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/auth", search: { next: location.href } });
    }
  },
  // Panel tarayıcıda açılana kadar beyaz ekran yerine iskelet gösterilir.
  pendingMs: 0,
  pendingComponent: PanelLoading,
  component: () => <Outlet />,
});

function PanelLoading() {
  return (
    <div className="flex min-h-screen bg-background" aria-busy="true" aria-label="Panel yükleniyor">
      <div className="hidden w-64 shrink-0 border-r border-border bg-card p-4 lg:block">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-muted" />
        <div className="mt-6 space-y-3">{Array.from({ length: 8 }, (_, i) => <div key={i} className="h-4 animate-pulse rounded bg-muted" />)}</div>
      </div>
      <div className="flex-1 p-4 sm:p-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>
        <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}
