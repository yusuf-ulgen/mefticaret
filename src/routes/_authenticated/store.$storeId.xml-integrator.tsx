import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { XmlIntegratorDashboard } from "@/components/supplier/xml-integrator-dashboard";

export const Route = createFileRoute("/_authenticated/store/$storeId/xml-integrator")({
  head: () => ({
    meta: [
      { title: "XML Entegratör Panosu — Mefticaret" },
      {
        name: "description",
        content:
          "Tedarikçi XML/CSV beslemelerini ve Trendyol, Hepsiburada, N11, Amazon pazaryeri XML çıktılarını tek panodan izle ve çalıştır.",
      },
      { property: "og:title", content: "XML Entegratör Panosu — Mefticaret" },
      {
        property: "og:description",
        content: "İki yönlü XML entegrasyonu: içe aktarım beslemeleri ve pazaryeri XML çıktıları tek ekranda.",
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
      title="XML Entegratör Panosu"
      description="İçe aktarım beslemelerini izle, pazaryeri XML çıktıları oluştur ve çalıştır."
    >
      <XmlIntegratorDashboard storeId={storeId} />
    </AppShell>
  );
}
