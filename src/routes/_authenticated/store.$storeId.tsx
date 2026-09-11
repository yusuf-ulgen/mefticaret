import { Outlet, createFileRoute, isRedirect, redirect } from "@tanstack/react-router";

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
      const { checkStoreAccess } = await import("@/lib/access-guard.functions");
      const result = await checkStoreAccess({
        data: { storeId: params.storeId, route: location.pathname },
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
