import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { PagesManager } from "@/components/pages-manager";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [picked, setPicked] = useState<string>("");

  const rows = (stores.data ?? []) as Record<string, unknown>[];
  /** Mağaza seçilmediyse ilk mağaza otomatik açılır. */
  const storeId = picked || (rows[0] ? String(rows[0]["id"]) : "");
  const setStoreId = setPicked;
  const selected = rows.find((row) => String(row["id"]) === storeId);
  const storeSlug = selected ? String(selected["slug"] ?? "") : undefined;

  return (
    <AdminShell title="Sayfalar" description={DESCRIPTION}>
      <div className="space-y-6">
        <div className="surface-card max-w-sm space-y-2 p-4">
          <Label htmlFor="admin-page-store">Mağaza seç</Label>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger id="admin-page-store">
              <SelectValue placeholder={stores.isLoading ? "Yükleniyor…" : "Mağaza seç"} />
            </SelectTrigger>
            <SelectContent>
              {rows.map((row) => (
                <SelectItem key={String(row["id"])} value={String(row["id"])}>
                  {String(row["name"] ?? row["slug"] ?? "Mağaza")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {storeId ? (
          <PagesManager storeId={storeId} storeSlug={storeSlug} />
        ) : (
          <div className="surface-card px-6 py-10 text-center text-sm text-muted-foreground">
            Sayfaları yönetmek için bir mağaza seç.
          </div>
        )}
      </div>
    </AdminShell>
  );
}
