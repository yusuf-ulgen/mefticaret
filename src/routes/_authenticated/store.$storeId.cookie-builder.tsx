import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { CookieBannerForm } from "@/components/policy-manager";

export const Route = createFileRoute("/_authenticated/store/$storeId/cookie-builder")({
  head: () => ({
    meta: [
      { title: "Cookie Builder — Mefticaret" },
      { name: "description", content: "Mağazanızın çerez onay bandını tasarlayın ve önizleyin." },
      { property: "og:title", content: "Cookie Builder — Mefticaret" },
      { property: "og:description", content: "KVKK uyumlu çerez bandı oluşturucu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CookieBuilderPage,
});

function CookieBuilderPage() {
  const { storeId } = Route.useParams();
  return (
    <AppShell storeId={storeId} title="Cookie Builder" description="Ziyaretçilerinize gösterilen çerez onay bandının konumunu, rengini, metnini ve kategorilerini ayarlayın.">
      <div className="max-w-2xl p-4 sm:p-6">
        <CookieBannerForm storeId={storeId} />
      </div>
    </AppShell>
  );
}
