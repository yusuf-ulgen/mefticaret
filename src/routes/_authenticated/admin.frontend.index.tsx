import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { AdminStorePicker } from "@/components/admin-store-picker";

const DESCRIPTION =
  "Mağaza vitrinlerinin tasarımını, metinlerini, bölümlerini ve içerik sayfalarını süper yönetici olarak düzenle.";

export const Route = createFileRoute("/_authenticated/admin/frontend/")({
  head: () => ({
    meta: [
      { title: "Ön Uç Yönetimi — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Ön Uç Yönetimi — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: AdminFrontendIndexPage,
});

function AdminFrontendIndexPage() {
  return (
    <AdminShell title="Ön Uç Yönetimi" description={DESCRIPTION}>
      <AdminStorePicker
        emptyHint="Henüz mağaza yok. Mağazalar ekranından yeni bir mağaza oluşturabilirsin."
        links={[
          { path: "/admin/frontend/:id", label: "Vitrin editörü" },
          { path: "/store/:id/theme-editor-v2", label: "Tema & metinler" },
          { path: "/store/:id/pages", label: "Sayfalar" },
          { path: "/store/:id/blog", label: "Blog" },
          { path: "/store/:id/navigation", label: "Menüler" },
        ]}
      />
    </AdminShell>
  );
}
