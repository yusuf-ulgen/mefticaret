import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { ThemeCustomizer } from "@/components/theme-customizer/theme-customizer";

const DESCRIPTION =
  "Renk, yazı tipi ve vitrin metinlerini değiştir; gerçek mağaza sayfasında anında gör, beğenince yayınla.";

export const Route = createFileRoute("/_authenticated/store/$storeId/customizer")({
  head: () => ({
    meta: [
      { title: "Canlı Tema Önizleme — Mefticaret" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Canlı Tema Önizleme — Mefticaret" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CustomizerPage,
});

function CustomizerPage() {
  const { storeId } = Route.useParams();
  return (
    <AppShell storeId={storeId} title="Canlı Tema Önizleme" description={DESCRIPTION}>
      <ThemeCustomizer storeId={storeId} />
    </AppShell>
  );
}
