import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/themes")({
  head: () => ({
    meta: [
      { title: "Temalar — Süper Admin" },
      { name: "description", content: "Mağaza temaları, yayın durumu ve özel kod kullanımı." },
      { property: "og:title", content: "Temalar — Süper Admin" },
      { property: "og:description", content: "Mağaza temaları, yayın durumu ve özel kod kullanımı." },
    ],
  }),
  component: AdminThemesPage,
});

function AdminThemesPage() {
  return (
    <AdminShell title="Temalar" description="Mağaza temaları, yayın durumu ve özel kod kullanımı.">
      <PlatformDataTable dataset="themes" />
    </AdminShell>
  );
}
