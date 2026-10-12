import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminShell } from "@/components/admin-shell";
import { PagesManager } from "@/components/pages-manager";
import { useAuth } from "@/lib/auth-context";
import { adminStoresQuery } from "@/lib/store-queries";

const DESCRIPTION = "Tüm mağazaların içerik sayfalarını süper yönetici olarak oluştur, düzenle ve yayınla.";

export const Route = createFileRoute("/_authenticated/admin/pages")({
  head: () => ({
    meta: [
      { title: "Sayfa Yönetimi — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Sayfa Yönetimi — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: AdminPagesPage,
});

function AdminPagesPage() {
  const { isPlatformAdmin } = useAuth();
  const stores = useQuery(adminStoresQuery(isPlatformAdmin));

  const rows = (stores.data ?? []) as Record<string, unknown>[];
  /** Mağaza seçici gizlendi; ilk mağaza otomatik kullanılır. */
  const storeId = rows[0] ? String(rows[0]["id"]) : "";
  const selected = rows[0];
  const storeSlug = selected ? String(selected["slug"] ?? "") : undefined;

  return (
    <AdminShell title="Sayfalar" description={DESCRIPTION}>
      <div className="space-y-6">
        {stores.isLoading ? (
          <div className="surface-card px-6 py-10 text-center text-sm text-muted-foreground">
            Mağazalar yükleniyor…
          </div>
        ) : storeId ? (
          <PagesManager storeId={storeId} storeSlug={storeSlug} />
        ) : (
          <div className="surface-card px-6 py-10 text-center text-sm text-muted-foreground">
            Henüz mağaza bulunmuyor.
          </div>
        )}
      </div>
    </AdminShell>
  );
}

