import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { XmlIntegratorTabs } from "@/components/xml-integrator/shared";

export const Route = createFileRoute("/_authenticated/store/$storeId/xml-integrator")({
  component: XmlIntegratorLayout,
});

function XmlIntegratorLayout() {
  const { storeId } = Route.useParams();
  return (
    <AppShell
      storeId={storeId}
      title="XML Entegratör"
      description="Tedarikçi beslemelerini bağlayın, alanları eşleştirin ve pazaryeri çıktıları oluşturun."
    >
      <XmlIntegratorTabs storeId={storeId} />
      <Outlet />
    </AppShell>
  );
}
