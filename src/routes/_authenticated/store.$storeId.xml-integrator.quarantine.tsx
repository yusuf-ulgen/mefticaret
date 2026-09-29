import { createFileRoute } from "@tanstack/react-router";

import { FailedItemsPanel } from "@/components/xml-integrator/failed-items-panel";
import { QuarantinePanel } from "@/components/xml-integrator/quarantine-panel";

export const Route = createFileRoute("/_authenticated/store/$storeId/xml-integrator/quarantine")({
  head: () => ({
    meta: [
      { title: "İncelemeye Alınan Ürünler — XML Entegratör" },
      {
        name: "description",
        content:
          "Güvenlik sınırlarına takılan ürünleri inceleyin: gelen fiyat ve stoğu onaylayın veya reddedin.",
      },
      { property: "og:title", content: "İncelemeye Alınan Ürünler — XML Entegratör" },
      {
        property: "og:description",
        content: "Anormal fiyat ve stok verisi canlıya yazılmadan önce burada incelenir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XmlQuarantinePage,
});

function XmlQuarantinePage() {
  const { storeId } = Route.useParams();
  return (
    <div className="space-y-6">
      <FailedItemsPanel storeId={storeId} />
      <QuarantinePanel storeId={storeId} />
    </div>
  );
}
