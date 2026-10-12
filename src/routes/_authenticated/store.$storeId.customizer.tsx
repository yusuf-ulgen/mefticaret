import { createFileRoute, redirect } from "@tanstack/react-router";

/** Eski ekran kaldırıldı; adres yeni sürüme yönlendirilir. */
export const Route = createFileRoute("/_authenticated/store/$storeId/customizer")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$storeId/theme-editor-v2", params: { storeId: params.storeId }, replace: true });
  },
});
