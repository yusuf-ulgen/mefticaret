import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { AdminStorePicker } from "@/components/admin-store-picker";

const DESCRIPTION =
  "Popup, hikâye, medya kütüphanesi ve kampanya içeriklerini mağaza bazında yönet.";

export const Route = createFileRoute("/_authenticated/admin/content")({
  head: () => ({
    meta: [
      { title: "İçerik Merkezi — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "İçerik Merkezi — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: AdminContentPage,
});

function AdminContentPage() {
  return (
    <AdminShell title="İçerik Merkezi" description={DESCRIPTION}>
      <AdminStorePicker
        links={[
          { path: "/store/:id/popups", label: "Popup" },
          { path: "/store/:id/media", label: "Medya" },
          { path: "/store/:id/campaigns", label: "Kampanyalar" },
          { path: "/store/:id/marketing", label: "Pazarlama" },
          { path: "/store/:id/theme-store", label: "Tema mağazası" },
        ]}
      />
    </AdminShell>
  );
}
