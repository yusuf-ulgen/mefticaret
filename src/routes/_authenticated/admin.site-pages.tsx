import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformPagesManager } from "@/components/platform-pages-manager";

const DESCRIPTION =
  "Mefticaret'in kendi kurumsal içerik sayfalarını (hakkımızda, KVKK, iletişim) oluştur ve yayınla.";

export const Route = createFileRoute("/_authenticated/admin/site-pages")({
  head: () => ({
    meta: [
      { title: "Platform Sayfaları — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Platform Sayfaları — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSitePagesPage,
});

function AdminSitePagesPage() {
  return (
    <AdminShell title="Platform Sayfaları" description={DESCRIPTION}>
      <PlatformPagesManager />
    </AdminShell>
  );
}
