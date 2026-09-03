import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { AdminStorePicker } from "@/components/admin-store-picker";

const DESCRIPTION =
  "Meta başlıklar, yönlendirmeler, 404 kayıtları ve site kit ölçümlemesini mağaza bazında yönet.";

export const Route = createFileRoute("/_authenticated/admin/seo")({
  head: () => ({
    meta: [
      { title: "SEO Merkezi — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "SEO Merkezi — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: AdminSeoPage,
});

function AdminSeoPage() {
  return (
    <AdminShell title="SEO Merkezi" description={DESCRIPTION}>
      <AdminStorePicker
        links={[
          { path: "/store/:id/seo", label: "SEO paneli" },
          { path: "/store/:id/seo-editor", label: "Meta editörü" },
          { path: "/store/:id/site-kit", label: "Site Kit" },
          { path: "/store/:id/domains", label: "Alan adları" },
        ]}
      />
    </AdminShell>
  );
}
