import { createFileRoute } from "@tanstack/react-router";

import { XmlAnalyticsPanel } from "@/components/xml-integrator/analytics-panel";

export const Route = createFileRoute("/_authenticated/store/$storeId/xml-integrator/analytics")({
  head: () => ({
    meta: [
      { title: "Tedarikçi Analitiği — XML Entegratör" },
      {
        name: "description",
        content:
          "Tedarikçi bazında katalog büyüklüğü, stoksuz oranı, fiyat oynaklığı, senkronizasyon hızı ve performans puanı.",
      },
      { property: "og:title", content: "Tedarikçi Analitiği — XML Entegratör" },
      {
        property: "og:description",
        content: "Besleme performansını karşılaştırın, raporu CSV veya PDF olarak alın.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XmlAnalyticsPage,
});

function XmlAnalyticsPage() {
  const { storeId } = Route.useParams();
  return <XmlAnalyticsPanel storeId={storeId} />;
}
