import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/transactions")({
  head: () => ({
    meta: [
      { title: "İşlemler — Süper Admin" },
      { name: "description", content: "Değiştirilemez finans defterindeki tüm hareketler." },
      { property: "og:title", content: "İşlemler — Süper Admin" },
      { property: "og:description", content: "Değiştirilemez finans defterindeki tüm hareketler." },
    ],
  }),
  component: AdminTransactionsPage,
});

function AdminTransactionsPage() {
  return (
    <AdminShell title="İşlemler" description="Değiştirilemez finans defterindeki tüm hareketler.">
      <PlatformDataTable dataset="transactions" />
    </AdminShell>
  );
}
