import { createFileRoute, redirect } from "@tanstack/react-router";

// /store/{id} kendi başına bir sayfa değil; doğrudan panele yönlendir.
export const Route = createFileRoute("/_authenticated/store/$storeId/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$storeId/dashboard", params: { storeId: params.storeId }, replace: true });
  },
});
