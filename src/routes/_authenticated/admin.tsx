import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { formatNumber, STORE_STATUS_LABELS } from "@/lib/mefti";
import { adminAuditQuery, adminStoresQuery } from "@/lib/store-queries";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Süper Admin — Mefticaret" },
      { name: "description", content: "Platform genelinde mağazaları, paketleri ve denetim kayıtlarını izle." },
      { property: "og:title", content: "Süper Admin — Mefticaret" },
      { property: "og:description", content: "Çok kiracılı platformun merkezi yönetim paneli." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isPlatformAdmin, loading } = useAuth();
  const { data: stores } = useQuery(adminStoresQuery(isPlatformAdmin));
  const { data: audit } = useQuery(adminAuditQuery(isPlatformAdmin));

  if (!loading && !isPlatformAdmin) {
    return (
      <AppShell title="Süper Admin" description="Bu alan platform yöneticilerine ayrılmıştır.">
        <div className="surface-card flex flex-col items-center gap-4 px-6 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <ShieldAlert className="size-6" />
          </span>
          <div>
            <h2 className="font-display text-xl font-semibold">Erişim yetkiniz yok</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Yetkiler veritabanı seviyesinde denetlenir; bu sayfadaki veriler size gösterilmez.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/stores">Mağazalarıma dön</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const rows = stores ?? [];
  const active = rows.filter((store) => store.status === "active").length;

  return (
    <AppShell
      title="Süper Admin"
      description="Platform genelinde kiracı, paket ve denetim görünürlüğü."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Toplam mağaza", value: formatNumber(rows.length) },
          { label: "Aktif mağaza", value: formatNumber(active) },
          { label: "Denetim kaydı", value: formatNumber((audit ?? []).length) },
        ].map((card) => (
          <div key={card.label} className="surface-card p-5">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-2 font-display text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="surface-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Mağaza</th>
              <th className="px-5 py-3">Paket</th>
              <th className="px-5 py-3">Durum</th>
              <th className="px-5 py-3">Oluşturma</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((store) => (
              <tr key={store.id}>
                <td className="px-5 py-3">
                  <p className="font-medium">{store.name}</p>
                  <p className="text-xs text-muted-foreground">{store.slug}</p>
                </td>
                <td className="px-5 py-3">{store.plans?.name ?? "—"}</td>
                <td className="px-5 py-3">
                  <Badge variant={store.status === "active" ? "default" : "secondary"}>
                    {STORE_STATUS_LABELS[store.status] ?? store.status}
                  </Badge>
                </td>
                <td className="px-5 py-3 text-xs text-muted-foreground">
                  {new Date(store.created_at).toLocaleDateString("tr-TR")}
                </td>
                <td className="px-5 py-3 text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/store/$storeId/dashboard" params={{ storeId: store.id }}>
                      Panel
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="surface-card p-6">
        <h2 className="font-display text-lg font-semibold">Platform denetim kayıtları</h2>
        <ul className="mt-4 divide-y divide-border">
          {(audit ?? []).map((log) => (
            <li key={log.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="font-medium">{log.action}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(log.created_at).toLocaleString("tr-TR")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
