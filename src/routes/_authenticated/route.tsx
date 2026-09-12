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
  component: () => <Outlet />,
});
