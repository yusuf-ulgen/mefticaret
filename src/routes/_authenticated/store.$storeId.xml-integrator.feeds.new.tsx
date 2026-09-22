import { createFileRoute } from "@tanstack/react-router";

import { XmlFeedWizard } from "@/components/xml-integrator/wizard";

export const Route = createFileRoute("/_authenticated/store/$storeId/xml-integrator/feeds/new")({
  head: () => ({
    meta: [
      { title: "Yeni Besleme Sihirbazı — XML Entegratör" },
      {
        name: "description",
        content: "Bağlantı, kaynak incelemesi, alan eşleştirmesi ve özet adımlarıyla yeni besleme oluşturun.",
      },
      { property: "og:title", content: "Yeni Besleme Sihirbazı — XML Entegratör" },
      { property: "og:description", content: "Dört adımda tedarikçi beslemesi veya pazaryeri çıktısı kurun." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XmlFeedNew,
});

function XmlFeedNew() {
  const { storeId } = Route.useParams();
  return <XmlFeedWizard storeId={storeId} />;
}
