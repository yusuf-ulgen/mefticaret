import { createFileRoute, redirect } from "@tanstack/react-router";

/** Eski ekran kaldırıldı; adres yeni sürüme yönlendirilir. */
export const Route = createFileRoute("/_authenticated/store/$storeId/customers/$customerId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$storeId/customers-v2/$customerId", params: { storeId: params.storeId, customerId: params.customerId }, replace: true });
  },
});
