import { createFileRoute, redirect } from "@tanstack/react-router";

/** Eski ekran kaldırıldı; adres yeni sürüme yönlendirilir. */
export const Route = createFileRoute("/_authenticated/store/$storeId/products/$productId")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$storeId/catalog-v2/$productId", params: { storeId: params.storeId, productId: params.productId }, replace: true });
  },
});
