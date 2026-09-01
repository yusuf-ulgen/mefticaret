import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/webhooks")({
  head: () => ({
    meta: [
      { title: "Webhook — Süper Admin" },
      { name: "description", content: "Webhook uç noktaları, olaylar ve son hatalar." },
      { property: "og:title", content: "Webhook — Süper Admin" },
      { property: "og:description", content: "Webhook uç noktaları, olaylar ve son hatalar." },
    ],
  }),
  component: AdminWebhooksPage,
});

function AdminWebhooksPage() {
  return (
    <AdminShell title="Webhook" description="Webhook uç noktaları, olaylar ve son hatalar.">
      <PlatformDataTable dataset="webhooks" />
    </AdminShell>
  );
}
