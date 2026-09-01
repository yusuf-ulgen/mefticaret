import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({
    meta: [
      { title: "Analitik — Süper Admin" },
      { name: "description", content: "Mağaza bazlı günlük ciro, sipariş ve ziyaretçi verileri." },
      { property: "og:title", content: "Analitik — Süper Admin" },
      { property: "og:description", content: "Mağaza bazlı günlük ciro, sipariş ve ziyaretçi verileri." },
    ],
  }),
  component: AdminAnalyticsPage,
});

function AdminAnalyticsPage() {
  return (
    <AdminShell title="Analitik" description="Mağaza bazlı günlük ciro, sipariş ve ziyaretçi verileri.">
      <PlatformDataTable dataset="analytics" />
    </AdminShell>
  );
}
