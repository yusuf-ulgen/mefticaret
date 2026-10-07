import { createFileRoute, redirect } from "@tanstack/react-router";

/** Eski ekran kaldırıldı; adres yeni sürüme yönlendirilir. */
export const Route = createFileRoute("/_authenticated/store/$storeId/collections")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$storeId/collections-v2", params: { storeId: params.storeId }, replace: true });
  },
});
