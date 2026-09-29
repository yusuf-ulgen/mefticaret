import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { PolicyManager } from "@/components/policy-manager";

export const Route = createFileRoute("/_authenticated/store/$storeId/policies")({
  head: () => ({
    meta: [
      { title: "Politikalar — Mefticaret" },
      { name: "description", content: "İade, gizlilik, çerez politikaları ve mesafeli satış sözleşmesini düzenleyin, sürümleyin." },
      { property: "og:title", content: "Politikalar — Mefticaret" },
      { property: "og:description", content: "Mağaza politikaları, sürüm geçmişi ve müşteri onay kayıtları." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StorePoliciesPage,
});

function StorePoliciesPage() {
  const { storeId } = Route.useParams();
  return (
    <AppShell storeId={storeId} title="Politikalar" description="Yasal metinleriniz, sürümleri ve müşteri onayları">
      <PolicyManager storeId={storeId} />
    </AppShell>
  );
}
