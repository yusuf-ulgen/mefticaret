import { createFileRoute } from "@tanstack/react-router";

import { XmlFeedList } from "@/components/xml-integrator/feed-list";

export const Route = createFileRoute("/_authenticated/store/$storeId/xml-integrator/feeds/")({
  head: () => ({
    meta: [
      { title: "Besleme Listesi — XML Entegratör" },
      {
        name: "description",
        content: "Tedarikçi beslemelerini ve pazaryeri çıktılarını listeleyin, açıp kapatın, ayarlarını düzenleyin.",
      },
      { property: "og:title", content: "Besleme Listesi — XML Entegratör" },
      { property: "og:description", content: "İçe ve dışa aktarım beslemelerinin tümü tek listede." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XmlFeedsIndex,
});

function XmlFeedsIndex() {
  const { storeId } = Route.useParams();
  return <XmlFeedList storeId={storeId} />;
}
