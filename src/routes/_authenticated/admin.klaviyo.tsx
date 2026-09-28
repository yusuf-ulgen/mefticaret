import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { getKlaviyoAdminOverview } from "@/lib/klaviyo-admin.functions";

export const Route = createFileRoute("/_authenticated/admin/klaviyo")({
  head: () => ({
    meta: [
      { title: "Klaviyo — Süper Admin" },
      { name: "description", content: "Platform Klaviyo hesabı, satıcı listesi ve mağaza Klaviyo bağlantıları." },
      { property: "og:title", content: "Klaviyo — Süper Admin" },
      { property: "og:description", content: "Klaviyo entegrasyonunu tek ekrandan yönet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KlaviyoAdmin,
});

function KlaviyoAdmin() {
  const overviewFn = useServerFn(getKlaviyoAdminOverview);
  const q = useQuery({ queryKey: ["admin-klaviyo"], queryFn: () => overviewFn() });
  const d = q.data;
  return (
    <AdminShell title="Klaviyo" description="Mağazaların kendi Klaviyo hesap bağlantıları.">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Her mağaza Klaviyo'yu Uygulama Mağazası'ndan kendi hesabının anahtarıyla bağlar. Burada tüm bağlantıları izleyebilirsiniz.
        </p>
        <section className="surface-card p-5">
          <p className="mb-3 font-semibold">Klaviyo kullanan mağazalar ({d?.stores.length ?? 0})</p>
          {q.isLoading ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : !d?.stores.length ? (
            <p className="text-sm text-muted-foreground">Henüz Klaviyo kuran mağaza yok.</p>
          ) : (
            <div className="divide-y divide-border">
              {d.stores.map((s) => (
                <div key={s.storeId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.message}</p>
                  </div>
                  <div className="flex gap-2">
                    {s.sendCampaigns && <Badge variant="outline">Kampanyalar Klaviyo'dan</Badge>}
                    <Badge variant={s.connection === "error" ? "destructive" : "default"}>
                      {s.status === "installed" ? (s.connection === "connected" ? "Bağlı" : s.connection) : s.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
