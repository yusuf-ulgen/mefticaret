import { createFileRoute, redirect } from "@tanstack/react-router";

/** Tema bileşenleri, tek parça Tema çalışma alanına taşındı. */
export const Route = createFileRoute("/_authenticated/store/$storeId/theme-sections")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/store/$storeId/theme-editor", params: { storeId: params.storeId }, replace: true });
  },
});
