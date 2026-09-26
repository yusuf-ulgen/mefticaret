import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { SecurityPanel } from "@/components/admin/security-panel";

export const Route = createFileRoute("/_authenticated/admin/security")({
  head: () => ({
    meta: [
      { title: "Güvenlik ve Güvenlik Duvarı — Süper Admin" },
      {
        name: "description",
        content: "Saldırı kayıtları, IP ve ülke engelleri, WAF kuralları, dolandırıcılık incelemesi ve oturum yönetimi.",
      },
      { property: "og:title", content: "Güvenlik ve Güvenlik Duvarı — Süper Admin" },
      {
        property: "og:description",
        content: "Saldırı kayıtları, IP ve ülke engelleri, WAF kuralları, dolandırıcılık incelemesi ve oturum yönetimi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSecurityPage,
});

function AdminSecurityPage() {
  return (
    <AdminShell
      title="Güvenlik ve güvenlik duvarı"
      description="Saldırı kayıtları, IP/ülke engelleri, WAF, dolandırıcılık incelemesi, oturumlar ve KVKK saklama süreleri."
    >
      <SecurityPanel />
    </AdminShell>
  );
}
