import { createFileRoute } from "@tanstack/react-router";

import { ThemeStudio } from "@/components/theme-studio/theme-studio";

const DESCRIPTION =
  "Sürükle-bırak bölümler, canlı önizleme, cihaz görünümleri ve anında ayar formuyla mağaza vitrinini kod yazmadan tasarla.";

export const Route = createFileRoute("/_authenticated/store/$storeId/theme-editor")({
  head: () => ({
    meta: [
      { title: "Tema Stüdyosu — Mefticaret" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Tema Stüdyosu — Mefticaret" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThemeEditorPage,
});

function ThemeEditorPage() {
  const { storeId } = Route.useParams();
  return <ThemeStudio storeId={storeId} backTo="store" />;
}
