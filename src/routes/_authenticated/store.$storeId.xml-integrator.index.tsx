import { createFileRoute } from "@tanstack/react-router";

import { XmlIntegratorDashboard } from "@/components/xml-integrator/dashboard";

export const Route = createFileRoute("/_authenticated/store/$storeId/xml-integrator/")({
  head: () => ({
    meta: [
      { title: "XML Entegratör Panosu — Mefticaret" },
      {
        name: "description",
        content: "Tedarikçi beslemeleri ve pazaryeri çıktılarının durumunu tek panoda izleyin.",
      },
      { property: "og:title", content: "XML Entegratör Panosu — Mefticaret" },
      { property: "og:description", content: "Besleme sayıları, son çalışmalar ve hatalar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XmlIntegratorIndex,
});

function XmlIntegratorIndex() {
  const { storeId } = Route.useParams();
  return <XmlIntegratorDashboard storeId={storeId} />;
}
