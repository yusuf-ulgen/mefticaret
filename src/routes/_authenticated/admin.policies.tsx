import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PolicyManager } from "@/components/policy-manager";

export const Route = createFileRoute("/_authenticated/admin/policies")({
  head: () => ({
    meta: [
      { title: "Platform Politikaları — Süper Admin" },
      { name: "description", content: "Mefticaret platform sözleşmelerini düzenleyin, sürümleyin ve onayları izleyin." },
      { property: "og:title", content: "Platform Politikaları — Süper Admin" },
      { property: "og:description", content: "Platform sözleşmeleri, sürüm geçmişi ve onay kayıtları." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <AdminShell title="Platform Politikaları" description="Satıcı ve kullanıcı sözleşmeleri">
      <PolicyManager storeId={null} />
    </AdminShell>
  ),
});
