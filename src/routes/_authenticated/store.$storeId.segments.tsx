import { createFileRoute, redirect } from "@tanstack/react-router";

/** Eski ekran kaldırıldı; adres yeni sürüme yönlendirilir. */
export const Route = createFileRoute("/_authenticated/store/$storeId/segments")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$storeId/segments-v2", params: { storeId: params.storeId }, replace: true });
  },
});
