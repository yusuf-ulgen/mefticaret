import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/store/$storeId/catalog-v2")({
  component: CatalogV2Layout,
});

function CatalogV2Layout() {
  return <Outlet />;
}
