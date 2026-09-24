import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/store/$storeId/customers-v2")({
  component: CustomersV2Layout,
});

function CustomersV2Layout() {
  return <Outlet />;
}
