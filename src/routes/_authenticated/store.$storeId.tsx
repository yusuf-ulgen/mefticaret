import { Outlet, createFileRoute, isRedirect, redirect } from "@tanstack/react-router";

import { checkStoreAccess } from "@/lib/access-guard.functions";

/**
 * Mağaza panelinin kapısı.
 *
 * Alt tüm `/store/{storeId}/*` sayfaları buradan geçer. Erişim sunucuda
 * mağaza üyeliği (sahip / store_users) veya platform yöneticiliği ile
 * doğrulanır; URL'ye başka bir mağaza kimliği yazan kullanıcı 403 alır.
 */
export const Route = createFileRoute("/_authenticated/store/$storeId")({
  beforeLoad: async ({ params, location }) => {
    try {
      const result = await checkStoreAccess({
        data: {
          storeId: params.storeId,
          route: location.pathname,
          expectedKind: location.pathname.includes("/kolay") ? "micro" : "corporate",
        },
      });

      if (!result.allowed) throw redirect({ to: "/unauthorized" });
      return { storeAccess: result };
    } catch (error) {
      if (isRedirect(error)) throw error;
      throw redirect({ to: "/unauthorized" });
    }
  },
  component: () => <Outlet />,
});
