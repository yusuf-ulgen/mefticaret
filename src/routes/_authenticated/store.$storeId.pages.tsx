import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/app-shell";
import { PagesManager } from "@/components/pages-manager";
import { useAuth } from "@/lib/auth-context";
import { myStoresQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/store/$storeId/pages")({
  head: () => ({
    meta: [
      { title: "İçerik Sayfaları — Mefticaret" },
      {
        name: "description",
        content: "Hakkımızda, iade koşulları, KVKK ve teslimat gibi vitrin içerik sayfalarını yönet.",
      },
      { property: "og:title", content: "İçerik Sayfaları — Mefticaret" },
      {
        property: "og:description",
        content: "Mefticaret vitrin CMS: içerik sayfaları, SEO açıklamaları ve alt menü yönetimi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PagesPage,
});

function PagesPage() {
  const { storeId } = Route.useParams();
  const { user } = useAuth();
  const { data: stores } = useQuery(myStoresQuery(user?.id));
  const storeSlug = (stores ?? []).find((s) => s.id === storeId)?.slug;

  return (
    <AppShell
      storeId={storeId}
      title="Sayfalar"
      description="Hakkımızda, iade, teslimat ve KVKK gibi vitrin sayfalarını oluştur, yayınla ve alt menüde göster."
    >
      <PagesManager storeId={storeId} storeSlug={storeSlug} />
    </AppShell>
  );
}
