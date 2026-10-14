import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime, formatNumber } from "@/lib/mefti";
import { systemHealthQuery } from "@/lib/platform-finance-queries";
import { SystemHealthPanel } from "@/components/monitoring/system-health-panel";

export const Route = createFileRoute("/_authenticated/admin/system")({
  head: () => ({
    meta: [
      { title: "Sistem Durumu — Süper Admin" },
      {
        name: "description",
        content:
          "Kuyruk sağlığı, API hata oranı, güvenlik olayları ve denetim akışı canlı görünüm.",
      },
      { property: "og:title", content: "Sistem Durumu — Süper Admin" },
      { property: "og:description", content: "Mefticaret platformunun operasyonel sağlık paneli." },
    ],
  }),
  component: AdminSystemPage,
});

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: "danger" | "warn" | undefined;
}) {
  return (
    <div className="surface-card p-5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          "mt-2 font-display text-2xl font-semibold " +
          (tone === "danger" ? "text-destructive" : tone === "warn" ? "text-amber-600" : "")
        }
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface-card p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function AdminSystemPage() {
  const { isPlatformAdmin } = useAuth();
  const { data, isLoading, error, dataUpdatedAt } = useQuery(systemHealthQuery(isPlatformAdmin));

  const queue = data?.queue;
  const api = data?.api;
  const storeNames = data?.storeNames ?? {};

  return (
    <AdminShell
      title="Sistem Durumu"
      description="Kuyruk, API, güvenlik ve denetim akışının 15 saniyede bir yenilenen görünümü."
      actions={
        dataUpdatedAt ? (
          <Badge variant="secondary">
            Son güncelleme: {formatDateTime(new Date(dataUpdatedAt).toISOString())}
          </Badge>
        ) : null
      }
    >
      <SystemHealthPanel />

      {error ? (
        <div className="surface-card p-6 text-sm text-destructive">{(error as Error).message}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Kuyrukta" value={formatNumber(queue?.queued ?? 0)} />
        <Kpi label="Çalışıyor" value={formatNumber(queue?.running ?? 0)} />
        <Kpi
          label="Başarısız"
          value={formatNumber(queue?.failed ?? 0)}
          tone={queue && queue.failed > 0 ? "danger" : undefined}
        />
        <Kpi label="24s tamamlanan" value={formatNumber(queue?.succeeded24h ?? 0)} />
        <Kpi label="API isteği (24s)" value={formatNumber(api?.totalRequests ?? 0)} />
        <Kpi
          label="Hata oranı (24s)"
          value={api?.errorRate == null ? "Ölçüm yok" : `${(api.errorRate * 100).toFixed(2)}%`}
          tone={
            (api?.errorRate ?? 0) > 0.05
              ? "danger"
              : (api?.errorRate ?? 0) > 0.01
                ? "warn"
                : undefined
          }
        />
        <Kpi
          label="Ortalama süre"
          value={api?.avgDuration == null ? "Ölçüm yok" : `${Math.round(api.avgDuration)} ms`}
          hint={api ? `${api.durationSamples} süre örneği · son 24 saat` : undefined}
        />
        <Kpi label="Toplam mağaza" value={formatNumber(data?.tableCounts.stores ?? 0)} />
        <Kpi label="Toplam kullanıcı" value={formatNumber(data?.tableCounts.users ?? 0)} />
        <Kpi label="Toplam sipariş" value={formatNumber(data?.tableCounts.orders ?? 0)} />
        <Kpi label="Toplam ürün" value={formatNumber(data?.tableCounts.products ?? 0)} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel title="Son iş kuyruğu hataları">
          <ul className="divide-y divide-border text-sm">
            {(data?.failedJobs ?? []).map((job) => (
              <li key={String(job["id"])} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{String(job["kind"])}</span>
                  <span className="text-xs text-muted-foreground">
                    {storeNames[String(job["store_id"] ?? "")] ?? "—"}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {String(job["last_error"] ?? "Hata mesajı yok")}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Deneme: {String(job["attempts"])}/{String(job["max_attempts"])} ·{" "}
                  {formatDateTime(String(job["updated_at"] ?? ""))}
                </p>
              </li>
            ))}
            {!isLoading && (data?.failedJobs ?? []).length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">Başarısız iş yok.</li>
            ) : null}
          </ul>
        </Panel>

        <Panel title="Son güvenlik olayları">
          <ul className="divide-y divide-border text-sm">
            {(data?.securityEvents ?? []).map((event) => (
              <li key={String(event["id"])} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{String(event["kind"])}</span>
                  <Badge
                    variant={
                      event["severity"] === "critical" || event["severity"] === "high"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {String(event["severity"])}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {storeNames[String(event["store_id"] ?? "")] ?? "—"} ·{" "}
                  {formatDateTime(String(event["created_at"] ?? ""))}
                </p>
              </li>
            ))}
            {!isLoading && (data?.securityEvents ?? []).length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">
                Güvenlik olayı yok.
              </li>
            ) : null}
          </ul>
        </Panel>

        <Panel title="Son denetim (audit) akışı">
          <ul className="divide-y divide-border text-sm">
            {(data?.auditLogs ?? []).map((log) => (
              <li key={String(log["id"])} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{String(log["action"])}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(String(log["created_at"] ?? ""))}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {storeNames[String(log["store_id"] ?? "")] ?? "—"} ·{" "}
                  {String(log["entity"] ?? "—")}
                </p>
              </li>
            ))}
            {!isLoading && (data?.auditLogs ?? []).length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">Kayıt yok.</li>
            ) : null}
          </ul>
        </Panel>

        <Panel title="Veritabanı tablo sayıları özeti">
          <ul className="divide-y divide-border text-sm">
            <li className="flex items-center justify-between py-2">
              <span>Mağazalar</span>
              <span className="text-xs text-muted-foreground">
                {formatNumber(data?.tableCounts.stores ?? 0)}
              </span>
            </li>
            <li className="flex items-center justify-between py-2">
              <span>Kullanıcılar</span>
              <span className="text-xs text-muted-foreground">
                {formatNumber(data?.tableCounts.users ?? 0)}
              </span>
            </li>
            <li className="flex items-center justify-between py-2">
              <span>Siparişler</span>
              <span className="text-xs text-muted-foreground">
                {formatNumber(data?.tableCounts.orders ?? 0)}
              </span>
            </li>
            <li className="flex items-center justify-between py-2">
              <span>Ürünler</span>
              <span className="text-xs text-muted-foreground">
                {formatNumber(data?.tableCounts.products ?? 0)}
              </span>
            </li>
          </ul>
        </Panel>
      </div>
    </AdminShell>
  );
}
