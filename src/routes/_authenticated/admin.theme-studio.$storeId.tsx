import { createFileRoute } from "@tanstack/react-router";

import { ThemeStudio } from "@/components/theme-studio/theme-studio";

const DESCRIPTION = "Süper yönetici olarak herhangi bir mağazanın vitrin bölümlerini düzenle, önizle ve yayınla.";

export const Route = createFileRoute("/_authenticated/admin/theme-studio/$storeId")({
  head: () => ({
    meta: [
      { title: "Tema Stüdyosu — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Tema Stüdyosu — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminThemeStudioPage,
});

function AdminThemeStudioPage() {
  const { storeId } = Route.useParams();
  return <ThemeStudio storeId={storeId} backTo="admin" />;
}
