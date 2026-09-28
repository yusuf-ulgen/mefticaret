import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getKlaviyoAdminOverview,
  saveKlaviyoMerchantList,
  syncMerchantsToKlaviyo,
} from "@/lib/klaviyo-admin.functions";

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
  const qc = useQueryClient();
  const overviewFn = useServerFn(getKlaviyoAdminOverview);
  const saveFn = useServerFn(saveKlaviyoMerchantList);
  const syncFn = useServerFn(syncMerchantsToKlaviyo);
  const q = useQuery({ queryKey: ["admin-klaviyo"], queryFn: () => overviewFn() });
  const [listId, setListId] = useState("");
  useEffect(() => {
    if (q.data) setListId(q.data.merchantListId);
  }, [q.data]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { listId } }),
    onSuccess: () => {
      toast.success("Satıcı listesi kaydedildi");
      qc.invalidateQueries({ queryKey: ["admin-klaviyo"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const sync = useMutation({
    mutationFn: () => syncFn(),
    onSuccess: (r) => toast.success(`${r.count} satıcı Klaviyo listesine gönderildi`),
    onError: (e: Error) => toast.error(e.message),
  });

  const d = q.data;
  return (
    <AdminShell title="Klaviyo" description="Platform Klaviyo hesabı ve mağazaların Klaviyo bağlantıları.">
      <div className="flex flex-col gap-4">
        <section className="surface-card space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Platform hesabı</p>
            {d && <Badge variant={d.platform.connected ? "default" : "outline"}>{d.platform.message}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            Satıcılarınıza (mağaza sahipleri) duyuru ve kampanya göndermek için satıcıları platform Klaviyo listenize aktarın.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              disabled={!d?.platform.connected}
            >
              <option value="">Liste seçin</option>
              {d?.platform.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <Button variant="outline" disabled={!listId || save.isPending} onClick={() => save.mutate()}>
              Kaydet
            </Button>
            <Button disabled={!d?.merchantListId || sync.isPending} onClick={() => sync.mutate()}>
              Satıcıları Klaviyo'ya aktar
            </Button>
          </div>
        </section>

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
