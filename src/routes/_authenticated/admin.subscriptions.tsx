import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/subscriptions")({
  head: () => ({
    meta: [
      { title: "Abonelikler — Süper Admin" },
      { name: "description", content: "Mağaza abonelikleri, dönemleri ve deneme süreleri." },
      { property: "og:title", content: "Abonelikler — Süper Admin" },
      { property: "og:description", content: "Mağaza abonelikleri, dönemleri ve deneme süreleri." },
    ],
  }),
  component: AdminSubscriptionsPage,
});

function AdminSubscriptionsPage() {
  return (
    <AdminShell title="Abonelikler" description="Mağaza abonelikleri, dönemleri ve deneme süreleri.">
      <PlatformDataTable dataset="subscriptions" />
    </AdminShell>
  );
}
