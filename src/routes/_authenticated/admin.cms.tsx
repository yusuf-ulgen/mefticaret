import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/cms")({
  head: () => ({
    meta: [
      { title: "CMS — Süper Admin" },
      { name: "description", content: "Tüm mağazaların kurumsal ve özel sayfaları." },
      { property: "og:title", content: "CMS — Süper Admin" },
      { property: "og:description", content: "Tüm mağazaların kurumsal ve özel sayfaları." },
    ],
  }),
  component: AdminCmsPage,
});

function AdminCmsPage() {
  return (
    <AdminShell title="CMS" description="Tüm mağazaların kurumsal ve özel sayfaları.">
      <PlatformDataTable dataset="cms" />
    </AdminShell>
  );
}
