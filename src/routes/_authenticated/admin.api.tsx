import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/api")({
  head: () => ({
    meta: [
      { title: "API anahtarları — Süper Admin" },
      { name: "description", content: "Scope tabanlı API anahtarları ve kullanım istatistikleri." },
      { property: "og:title", content: "API anahtarları — Süper Admin" },
      { property: "og:description", content: "Scope tabanlı API anahtarları ve kullanım istatistikleri." },
    ],
  }),
  component: AdminApiPage,
});

function AdminApiPage() {
  return (
    <AdminShell title="API anahtarları" description="Scope tabanlı API anahtarları ve kullanım istatistikleri.">
      <PlatformDataTable dataset="api" />
    </AdminShell>
  );
}
