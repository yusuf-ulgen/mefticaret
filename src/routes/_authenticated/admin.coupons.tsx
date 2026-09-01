import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/coupons")({
  head: () => ({
    meta: [
      { title: "Kuponlar — Süper Admin" },
      { name: "description", content: "Tüm mağazaların indirim kuponları ve kullanım oranları." },
      { property: "og:title", content: "Kuponlar — Süper Admin" },
      { property: "og:description", content: "Tüm mağazaların indirim kuponları ve kullanım oranları." },
    ],
  }),
  component: AdminCouponsPage,
});

function AdminCouponsPage() {
  return (
    <AdminShell title="Kuponlar" description="Tüm mağazaların indirim kuponları ve kullanım oranları.">
      <PlatformDataTable dataset="coupons" />
    </AdminShell>
  );
}
