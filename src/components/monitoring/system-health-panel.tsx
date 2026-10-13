import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/mefti";
import { infrastructureHealthQuery } from "@/lib/monitoring-queries";
import { sendMonitoringTestAlert } from "@/lib/monitoring.functions";

/** Koyu temalı altyapı izleme paneli: 15 saniyede bir canlı metrikler. */

const STATUS_LABEL: Record<string, string> = {
  healthy: "Sağlıklı",
  degraded: "Bozulma",
  outage: "Kesinti",
  unknown: "Ölçüm eksik",
};

function statusDot(status: string) {
  if (status === "unknown") return "bg-monitor-muted";
  return status === "outage"
    ? "bg-status-outage"
    : status === "degraded"
      ? "bg-status-degraded"
      : "bg-status-healthy";
}

function statusText(status: string) {
  if (status === "unknown") return "text-monitor-muted";
  return status === "outage"
    ? "text-status-outage"
    : status === "degraded"
      ? "text-status-degraded"
      : "text-status-healthy";
}

export function SystemHealthPanel() {
  const { isPlatformAdmin } = useAuth();
  const { data, isLoading, error, dataUpdatedAt, refetch } = useQuery(
    infrastructureHealthQuery(isPlatformAdmin),
  );
  const sendTest = useServerFn(sendMonitoringTestAlert);
  const testMutation = useMutation({
    mutationFn: () => sendTest(),
    onSuccess: (result) =>
      result.delivered
        ? toast.success("Test uyarısı webhook adresine gönderildi")
        : toast.error("Uyarı adresi tanımlı değil; platform ayarlarından ekleyin"),
    onError: (mutationError: Error) => toast.error(mutationError.message),
  });

  return (
    <section className="rounded-3xl border border-monitor-border bg-monitor-surface p-6 text-monitor-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-monitor-muted">
            Altyapı izleme
          </p>
          <h2 className="mt-1 flex items-center gap-2 font-display text-xl font-semibold">
            Sistem Sağlığı
            <span
              className={`inline-flex size-2.5 rounded-full ${statusDot(error ? "unknown" : data?.overall ?? "unknown")}`}
              aria-hidden
            />
            <span className={`text-sm font-medium ${statusText(error ? "unknown" : data?.overall ?? "unknown")}`}>
              {STATUS_LABEL[error ? "unknown" : data?.overall ?? "unknown"]}
            </span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-monitor-muted">
            {data?.measuredAt ? `${error ? "Son başarılı ölçüm: " : ""}${formatDateTime(data.measuredAt)}` : error ? "Ölçüm alınamadı" : "Ölçülüyor…"}
          </span>
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            Yenile
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={testMutation.isPending}
            onClick={() => testMutation.mutate()}
          >
            Uyarıyı test et
          </Button>
        </div>
      </header>

      {error ? (
        <p className={`mt-4 text-sm ${statusText("outage")}`}>{(error as Error).message}</p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(data?.metrics ?? []).map((metric) => (
          <div
            key={metric.key}
            className="rounded-2xl border border-monitor-border bg-monitor-panel p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-monitor-muted">{metric.label}</p>
              <span
                className={`mt-1 inline-flex size-2 rounded-full ${statusDot(metric.status)}`}
                aria-hidden
              />
            </div>
            <p className={`mt-2 font-display text-2xl font-semibold ${statusText(metric.status)}`}>
              {metric.display}
            </p>
            <p className="mt-1 text-[11px] text-monitor-muted">{metric.hint}</p>
          </div>
        ))}
        {isLoading && !data
          ? Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl border border-monitor-border bg-monitor-panel"
              />
            ))
          : null}
      </div>

      <p className="mt-4 text-[11px] text-monitor-muted">
        Yeşil: sağlıklı · Sarı: bozulma · Kırmızı: kesinti. Eşik aşıldığında Slack/webhook uyarısı
        otomatik gönderilir (15 dakika susturma penceresi ile).
      </p>
    </section>
  );
}
