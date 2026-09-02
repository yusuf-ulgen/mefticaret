import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/store/$storeId/products")({
  component: ProductsLayout,
});

function ProductsLayout() {
  return <Outlet />;
}
