import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/admin-shell";
import { PlatformDataTable } from "@/components/platform-data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  head: () => ({
    meta: [
      { title: "Log Merkezi — Süper Admin" },
      {
        name: "description",
        content:
          "Denetim kayıtları, güvenlik olayları ve bildirim geçmişini kategorilere ayrılmış tek ekranda inceleyin.",
      },
      { property: "og:title", content: "Log Merkezi — Süper Admin" },
      {
        property: "og:description",
        content: "Denetim, güvenlik ve bildirim loglarını kategorilere ayrılmış şekilde görüntüleyin.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminLogsPage,
});

const TABS = [
  { value: "audit", label: "Denetim", dataset: "audit" as const },
  { value: "security", label: "Güvenlik", dataset: "security" as const },
  { value: "notifications", label: "Bildirimler", dataset: "notifications" as const },
];

function AdminLogsPage() {
  return (
    <AdminShell
      title="Log Merkezi"
      description="Denetim kayıtları, güvenlik olayları ve bildirim geçmişi kategorilere ayrılmış halde."
    >
      <Tabs defaultValue="audit">
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-6">
            <PlatformDataTable dataset={tab.dataset} />
          </TabsContent>
        ))}
      </Tabs>
    </AdminShell>
  );
}
