import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({
    meta: [
      { title: "Ödemeler — Süper Admin" },
      { name: "description", content: "Mağaza hak edişleri, kesintiler ve ödeme durumları." },
      { property: "og:title", content: "Ödemeler — Süper Admin" },
      { property: "og:description", content: "Mağaza hak edişleri, kesintiler ve ödeme durumları." },
    ],
  }),
  component: AdminPaymentsPage,
});

function AdminPaymentsPage() {
  return (
    <AdminShell title="Ödemeler" description="Mağaza hak edişleri, kesintiler ve ödeme durumları.">
      <PlatformDataTable dataset="payments" />
    </AdminShell>
  );
}
