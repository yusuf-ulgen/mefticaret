import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { StoreMigration } from "@/components/store-migration";
import { StoreTransfer } from "@/components/store-transfer";

export const Route = createFileRoute("/_authenticated/store/$storeId/migration")({
  head: () => ({
    meta: [
      { title: "Mağaza Taşıma — Mefticaret" },
      {
        name: "description",
        content:
          "Shopify, ikas, Wix, WooCommerce, Ticimax ve diğer altyapılardan ürün, müşteri, sipariş ve içerik verilerini Mefticaret mağazana taşı.",
      },
      { property: "og:title", content: "Mağaza Taşıma — Mefticaret" },
      {
        property: "og:description",
        content: "Eski altyapından ürün, müşteri, sipariş ve blog verilerini tek ekrandan aktar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MigrationPage,
});

function MigrationPage() {
  const { storeId } = Route.useParams();
  return (
    <AppShell
      storeId={storeId}
      title="Mağaza Taşıma"
      description="Eski mağazandaki ürün, kategori, müşteri, sipariş ve içerik verilerini güvenli şekilde aktar."
    >
      <div className="space-y-6">
        <StoreTransfer storeId={storeId} />
        <StoreMigration storeId={storeId} />
      </div>
    </AppShell>
  );
}
