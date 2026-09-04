import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { AdminShell } from "@/components/admin-shell";
import { AdminStorePicker } from "@/components/admin-store-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatNumber } from "@/lib/mefti";
import { fetchPlatformSeo, runPlatformStoreAudit } from "@/lib/seo-audit.functions";

const DESCRIPTION =
  "Platform genelinde SEO skorları, kritik sorunlar, meta başlıklar, yönlendirmeler ve 404 kayıtlarını mağaza bazında yönet.";

export const Route = createFileRoute("/_authenticated/admin/seo")({
  head: () => ({
    meta: [
      { title: "SEO Merkezi — Süper Admin" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "SEO Merkezi — Süper Admin" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: AdminSeoPage,
});

const HEALTH_LABELS: Record<string, string> = {
  critical: "Kritik",
  warning: "İyileştirme gerekli",
  healthy: "Sağlıklı",
  none: "Denetlenmedi",
};

function scoreTone(score: number) {
  if (score >= 85) return "text-emerald-600";
  if (score >= 65) return "text-amber-600";
  return "text-destructive";
}

function AdminSeoPage() {
  const client = useQueryClient();
  const loadPlatformSeo = useServerFn(fetchPlatformSeo);
  const runAudit = useServerFn(runPlatformStoreAudit);
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["platform-seo"],
    queryFn: () => loadPlatformSeo(),
    staleTime: 30_000,
  });

  const auditMutation = useMutation({
    mutationFn: (input: { storeId?: string; all?: boolean }) =>
      runAudit({ data: { storeId: input.storeId, all: Boolean(input.all) } }),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["platform-seo"] });
      toast.success(`${result.audited} mağaza denetlendi`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const totals = data?.totals;
  const stores = useMemo(() => {
    const list = data?.stores ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (store) => store.name.toLowerCase().includes(term) || store.slug.toLowerCase().includes(term),
    );
  }, [data?.stores, search]);

  return (
    <AdminShell title="SEO Merkezi" description={DESCRIPTION}>
      <div className="space-y-6">
        <section className="surface-card flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="eyebrow">Platform SEO sağlığı</p>
            <h2 className="mt-1 font-display text-lg font-semibold">
              Ortalama skor:{" "}
              <span className={scoreTone(totals?.averageScore ?? 0)}>{totals?.averageScore ?? 0}</span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading
                ? "Veriler yükleniyor..."
                : `${formatNumber(totals?.audited ?? 0)}/${formatNumber(totals?.stores ?? 0)} mağaza denetlendi`}
            </p>
          </div>
          <Button
            className="gap-2"
            disabled={auditMutation.isPending}
            onClick={() => auditMutation.mutate({ all: true })}
          >
            <RefreshCw className={`h-4 w-4 ${auditMutation.isPending ? "animate-spin" : ""}`} />
            Tüm aktif mağazaları denetle
          </Button>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Kritik mağaza", value: totals?.criticalStores ?? 0, tone: "text-destructive" },
            { label: "İyileştirme gereken", value: totals?.warningStores ?? 0, tone: "text-amber-600" },
            { label: "Sağlıklı mağaza", value: totals?.healthyStores ?? 0, tone: "text-emerald-600" },
            { label: "Denetlenmemiş", value: totals?.noAudit ?? 0, tone: "" },
            { label: "Kritik sorun", value: totals?.criticalIssues ?? 0, tone: "text-destructive" },
            { label: "404 kaydı", value: totals?.notFound ?? 0, tone: "" },
            { label: "Eksik meta", value: totals?.missingMeta ?? 0, tone: "" },
            { label: "Schema hatası", value: totals?.schemaErrors ?? 0, tone: "" },
          ].map((item) => (
            <div key={item.label} className="surface-card p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className={`mt-1 text-3xl font-semibold ${item.tone}`}>{formatNumber(item.value)}</p>
            </div>
          ))}
        </section>

        <section className="surface-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <h2 className="font-medium">Mağaza SEO tablosu</h2>
              <p className="text-xs text-muted-foreground">
                Skorlar, kritik sorunlar ve 404 kayıtları mağaza bazında listelenir.
              </p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Mağaza ara"
                aria-label="Mağaza ara"
              />
            </div>
          </div>

          {stores.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              {isLoading ? "Yükleniyor..." : "Kayıt bulunamadı."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">Mağaza</th>
                    <th className="px-3 py-3">Skor</th>
                    <th className="px-3 py-3">Teknik</th>
                    <th className="px-3 py-3">İçerik</th>
                    <th className="px-3 py-3">Kritik</th>
                    <th className="px-3 py-3">Uyarı</th>
                    <th className="px-3 py-3">404</th>
                    <th className="px-3 py-3">Durum</th>
                    <th className="px-5 py-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {stores.map((store) => (
                    <tr key={store.storeId}>
                      <td className="px-5 py-3">
                        <p className="font-medium">{store.name}</p>
                        <code className="text-xs text-muted-foreground">/s/{store.slug}</code>
                      </td>
                      <td className="px-3 py-3">
                        <p className={`font-semibold ${scoreTone(store.score)}`}>{store.score}</p>
                        <Progress className="mt-1 w-16" value={store.score} />
                      </td>
                      <td className="px-3 py-3">{store.technical}</td>
                      <td className="px-3 py-3">{store.content}</td>
                      <td className="px-3 py-3 text-destructive">{store.critical}</td>
                      <td className="px-3 py-3 text-amber-600">{store.warning}</td>
                      <td className="px-3 py-3">{formatNumber(store.notFound)}</td>
                      <td className="px-3 py-3">
                        <Badge
                          variant={
                            store.health === "critical"
                              ? "destructive"
                              : store.health === "healthy"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {HEALTH_LABELS[store.health]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={auditMutation.isPending}
                            onClick={() => auditMutation.mutate({ storeId: store.storeId })}
                          >
                            Denetle
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <a href={`/store/${store.storeId}/seo`}>SEO paneli</a>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <AdminStorePicker
          links={[
            { path: "/store/:id/seo", label: "SEO paneli" },
            { path: "/store/:id/seo-editor", label: "Meta editörü" },
            { path: "/store/:id/site-kit", label: "Site Kit" },
            { path: "/store/:id/domains", label: "Alan adları" },
          ]}
        />
      </div>
    </AdminShell>
  );
}
