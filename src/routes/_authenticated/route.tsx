import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      // Süper admin bölümünün kendi giriş akışı var; mağaza girişine yönlendirilmez.
      if (location.pathname === "/admin" || location.pathname.startsWith("/admin/")) {
        throw redirect({ to: "/admin/login" });
      }
      throw redirect({ to: "/auth", search: { next: location.href } });
    }
  },
  component: () => <Outlet />,
});
