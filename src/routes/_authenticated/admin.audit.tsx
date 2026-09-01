import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Logs — Süper Admin" },
      { name: "description", content: "Platform genelinde denetim kayıtları." },
      { property: "og:title", content: "Audit Logs — Süper Admin" },
      { property: "og:description", content: "Platform genelinde denetim kayıtları." },
    ],
  }),
  component: AdminAuditPage,
});

function AdminAuditPage() {
  return (
    <AdminShell title="Audit Logs" description="Platform genelinde denetim kayıtları.">
      <PlatformDataTable dataset="audit" />
    </AdminShell>
  );
}
