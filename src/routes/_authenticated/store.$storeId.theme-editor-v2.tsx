import { createFileRoute } from "@tanstack/react-router";

import { ThemeEditorV2 } from "@/components/theme-v2/theme-editor-v2";

const DESCRIPTION = "Bölüm ve bloklarla vitrinini sürükle-bırak tasarla; mobil, tablet ve masaüstünde canlı önizle, beğenince yayınla.";

export const Route = createFileRoute("/_authenticated/store/$storeId/theme-editor-v2")({
  head: () => ({
    meta: [
      { title: "Tema Editörü v2 — Mefticaret" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Tema Editörü v2 — Mefticaret" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ThemeEditorV2Page,
});

function ThemeEditorV2Page() {
  const { storeId } = Route.useParams();
  return <ThemeEditorV2 storeId={storeId} />;
}
