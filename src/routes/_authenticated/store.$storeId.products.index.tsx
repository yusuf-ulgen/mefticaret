import { createFileRoute, redirect } from "@tanstack/react-router";

/** Eski ekran kaldırıldı; adres yeni sürüme yönlendirilir. */
export const Route = createFileRoute("/_authenticated/store/$storeId/products/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$storeId/catalog-v2", params: { storeId: params.storeId }, replace: true });
  },
});
