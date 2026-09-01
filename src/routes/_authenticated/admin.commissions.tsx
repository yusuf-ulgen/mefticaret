import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/commissions")({
  head: () => ({
    meta: [
      { title: "Komisyonlar — Süper Admin" },
      { name: "description", content: "Platform ücreti ve marketplace komisyon hareketleri." },
      { property: "og:title", content: "Komisyonlar — Süper Admin" },
      { property: "og:description", content: "Platform ücreti ve marketplace komisyon hareketleri." },
    ],
  }),
  component: AdminCommissionsPage,
});

function AdminCommissionsPage() {
  return (
    <AdminShell title="Komisyonlar" description="Platform ücreti ve marketplace komisyon hareketleri.">
      <PlatformDataTable dataset="commissions" />
    </AdminShell>
  );
}
