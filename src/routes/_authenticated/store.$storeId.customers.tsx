import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

/** Eski müşteri listesi kaldırıldı; liste yeni sürüme yönlendirilir. */
export const Route = createFileRoute("/_authenticated/store/$storeId/customers")({
  beforeLoad: ({ params, location }) => {
    if (location.pathname.replace(/\/$/, "").endsWith("/customers")) {
      throw redirect({ to: "/store/$storeId/customers-v2", params: { storeId: params.storeId }, replace: true });
    }
  },
  component: () => <Outlet />,
});
