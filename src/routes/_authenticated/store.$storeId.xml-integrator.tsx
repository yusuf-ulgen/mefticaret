import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { XmlIntegratorDashboard } from "@/components/xml-integrator/dashboard";

export const Route = createFileRoute("/_authenticated/store/$storeId/xml-integrator")({
  head: () => ({
    meta: [
      { title: "XML Entegratör — Mefticaret" },
      {
        name: "description",
        content:
          "Tedarikçi XML, CSV ve JSON beslemelerinden ürün çekin; Trendyol, Hepsiburada, N11 ve Amazon için XML çıktısı üretin.",
      },
      { property: "og:title", content: "XML Entegratör — Mefticaret" },
      {
        property: "og:description",
        content: "İki yönlü XML entegrasyonu: tedarikçi beslemeleri ve pazaryeri çıktıları tek ekranda.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: XmlIntegratorPage,
});

function XmlIntegratorPage() {
  const { storeId } = Route.useParams();
  return (
    <AppShell
      storeId={storeId}
      title="XML Entegratör"
      description="Tedarikçi beslemelerini bağlayın, alanları eşleştirin ve pazaryeri çıktıları oluşturun."
    >
      <XmlIntegratorDashboard storeId={storeId} />
    </AppShell>
  );
}
