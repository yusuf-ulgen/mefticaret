import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/blog")({
  head: () => ({
    meta: [
      { title: "Blog — Süper Admin" },
      { name: "description", content: "Platform genelinde blog içerikleri ve yayın takvimi." },
      { property: "og:title", content: "Blog — Süper Admin" },
      { property: "og:description", content: "Platform genelinde blog içerikleri ve yayın takvimi." },
    ],
  }),
  component: AdminBlogPage,
});

function AdminBlogPage() {
  return (
    <AdminShell title="Blog" description="Platform genelinde blog içerikleri ve yayın takvimi.">
      <PlatformDataTable dataset="blog" />
    </AdminShell>
  );
}
