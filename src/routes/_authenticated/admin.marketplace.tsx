import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/marketplace")({
  head: () => ({
    meta: [
      { title: "Marketplace — Süper Admin" },
      { name: "description", content: "Pazaryeri kanallarının bağlantı ve senkronizasyon durumu." },
      { property: "og:title", content: "Marketplace — Süper Admin" },
      { property: "og:description", content: "Pazaryeri kanallarının bağlantı ve senkronizasyon durumu." },
    ],
  }),
  component: AdminMarketplacePage,
});

function AdminMarketplacePage() {
  return (
    <AdminShell title="Marketplace" description="Pazaryeri kanallarının bağlantı ve senkronizasyon durumu.">
      <PlatformDataTable dataset="marketplace" />
    </AdminShell>
  );
}
