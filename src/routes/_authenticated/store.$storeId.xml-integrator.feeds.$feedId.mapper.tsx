import { createFileRoute } from "@tanstack/react-router";

import { XmlFieldMapper } from "@/components/xml-integrator/mapper";

export const Route = createFileRoute("/_authenticated/store/$storeId/xml-integrator/feeds/$feedId/mapper")({
  head: () => ({
    meta: [
      { title: "Alan Eşleme — XML Entegratör" },
      {
        name: "description",
        content: "Kaynak alanlarını sürükleyip Mefticaret ürün alanlarına bırakarak eşleştirin.",
      },
      { property: "og:title", content: "Alan Eşleme — XML Entegratör" },
      { property: "og:description", content: "Sürükle-bırak alan eşleştirme ve zorunlu alan denetimi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XmlFeedMapperPage,
});

function XmlFeedMapperPage() {
  const { storeId, feedId } = Route.useParams();
  return <XmlFieldMapper storeId={storeId} feedId={feedId} />;
}
