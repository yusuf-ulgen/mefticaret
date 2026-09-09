import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformBlogManager } from "@/components/platform-blog-manager";

const TITLE = "Platform Blogu — Süper Admin";
const DESCRIPTION =
  "Mefticaret'in kendi blog yazılarını oluştur, düzenle ve yayınla. Mağaza seçimi gerekmez.";

export const Route = createFileRoute("/_authenticated/admin/site-blog")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSiteBlogPage,
});

function AdminSiteBlogPage() {
  return (
    <AdminShell title="Platform Blogu" description={DESCRIPTION}>
      <PlatformBlogManager />
    </AdminShell>
  );
}
