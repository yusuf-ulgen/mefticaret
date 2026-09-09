import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformSeoManager } from "@/components/platform-seo-manager";

const TITLE = "SEO Etiketleri — Süper Admin";
const DESCRIPTION =
  "Ana sayfa, platform içerik sayfaları ve blog yazıları için meta başlık, açıklama, canonical ve index durumunu yönet.";

export const Route = createFileRoute("/_authenticated/admin/site-seo")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSiteSeoPage,
});

function AdminSiteSeoPage() {
  return (
    <AdminShell title="SEO Etiketleri" description={DESCRIPTION}>
      <PlatformSeoManager />
    </AdminShell>
  );
}
