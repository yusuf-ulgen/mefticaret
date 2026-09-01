import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/sellers")({
  head: () => ({
    meta: [
      { title: "Satıcılar — Süper Admin" },
      { name: "description", content: "Marketplace satıcı başvuruları, komisyon oranları ve durumları." },
      { property: "og:title", content: "Satıcılar — Süper Admin" },
      { property: "og:description", content: "Marketplace satıcı başvuruları, komisyon oranları ve durumları." },
    ],
  }),
  component: AdminSellersPage,
});

function AdminSellersPage() {
  return (
    <AdminShell title="Satıcılar" description="Marketplace satıcı başvuruları, komisyon oranları ve durumları.">
      <PlatformDataTable dataset="sellers" />
    </AdminShell>
  );
}
