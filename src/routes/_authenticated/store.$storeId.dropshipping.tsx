import { createFileRoute, redirect } from "@tanstack/react-router";

/** Eski Dropshipping sayfası kaldırıldı; tüm işlemler XML Entegratör ekranında yönetilir. */
export const Route = createFileRoute("/_authenticated/store/$storeId/dropshipping")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$storeId/xml-feed", params: { storeId: params.storeId } });
  },
});
