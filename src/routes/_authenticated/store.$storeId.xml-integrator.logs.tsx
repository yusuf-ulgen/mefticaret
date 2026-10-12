import { createFileRoute } from "@tanstack/react-router";

import { XmlLogsPanel } from "@/components/xml-integrator/logs-panel";

export const Route = createFileRoute("/_authenticated/store/$storeId/xml-integrator/logs")({
  head: () => ({
    meta: [
      { title: "Çalışma Kayıtları — XML Entegratör" },
      {
        name: "description",
        content: "İçe ve dışa aktarım çalışmalarının satır sayıları, süreleri ve hata detayları.",
      },
      { property: "og:title", content: "Çalışma Kayıtları — XML Entegratör" },
      { property: "og:description", content: "Besleme bazlı filtreyle tüm çalışma geçmişi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XmlLogsPage,
});

function XmlLogsPage() {
  const { storeId } = Route.useParams();
  return <XmlLogsPanel storeId={storeId} />;
}
