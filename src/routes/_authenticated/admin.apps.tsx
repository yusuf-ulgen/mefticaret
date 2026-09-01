import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/apps")({
  head: () => ({
    meta: [
      { title: "Uygulamalar — Süper Admin" },
      { name: "description", content: "Uygulama mağazası kayıtları, kurulum sayıları ve fiyatlama." },
      { property: "og:title", content: "Uygulamalar — Süper Admin" },
      { property: "og:description", content: "Uygulama mağazası kayıtları, kurulum sayıları ve fiyatlama." },
    ],
  }),
  component: AdminAppsPage,
});

function AdminAppsPage() {
  return (
    <AdminShell title="Uygulamalar" description="Uygulama mağazası kayıtları, kurulum sayıları ve fiyatlama.">
      <PlatformDataTable dataset="apps" />
    </AdminShell>
  );
}
