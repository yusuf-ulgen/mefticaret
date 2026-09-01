import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Bildirimler — Süper Admin" },
      { name: "description", content: "Platform genelinde üretilen bildirim akışı." },
      { property: "og:title", content: "Bildirimler — Süper Admin" },
      { property: "og:description", content: "Platform genelinde üretilen bildirim akışı." },
    ],
  }),
  component: AdminNotificationsPage,
});

function AdminNotificationsPage() {
  return (
    <AdminShell title="Bildirimler" description="Platform genelinde üretilen bildirim akışı.">
      <PlatformDataTable dataset="notifications" />
    </AdminShell>
  );
}
