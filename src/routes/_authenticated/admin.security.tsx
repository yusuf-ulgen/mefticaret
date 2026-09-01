import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/security")({
  head: () => ({
    meta: [
      { title: "Güvenlik — Süper Admin" },
      { name: "description", content: "Hız sınırı ihlalleri, yetkisiz erişim denemeleri ve şüpheli hareketler." },
      { property: "og:title", content: "Güvenlik — Süper Admin" },
      { property: "og:description", content: "Hız sınırı ihlalleri, yetkisiz erişim denemeleri ve şüpheli hareketler." },
    ],
  }),
  component: AdminSecurityPage,
});

function AdminSecurityPage() {
  return (
    <AdminShell title="Güvenlik" description="Hız sınırı ihlalleri, yetkisiz erişim denemeleri ve şüpheli hareketler.">
      <PlatformDataTable dataset="security" />
    </AdminShell>
  );
}
