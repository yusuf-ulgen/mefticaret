import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { loadTestStatusQuery } from "@/lib/loadtest-queries";
import {
  saveLoadTestConfig,
  stepLoadTestCycle,
  stopLoadTestSuite,
} from "@/lib/loadtest.functions";
import { formatDateTime, formatNumber } from "@/lib/mefti";

/** Süper admin yük monitörü: geri sayım, göstergeler, faz akışı ve acil durdurma. */

const PHASE_LABELS: Record<string, string> = {
  purge: "Sıfırlama",
  seed: "Veri tohumlama",
  traffic: "Yük & trafik",
  verify: "Doğrulama",
  report: "Raporlama",
};

const STATUS_LABELS: Record<string, string> = {
  running: "Çalışıyor",
  completed: "Tamamlandı",
  completed_with_findings: "Bulgularla tamamlandı",
  failed: "Hata",
  stopped: "Durduruldu",
};

function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return "00s:00d:00sn";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return `${String(hours).padStart(2, "0")}s:${String(minutes).padStart(2, "0")}d:${String(seconds).padStart(2, "0")}sn`;
}

function Gauge({
  label,
  value,
  display,
  ratio,
  tone,
}: {
  label: string;
  value: number;
  display: string;
  ratio: number;
  tone: "healthy" | "degraded" | "outage";
}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  const radius = 46;
  const circumference = Math.PI * radius;
  const color =
    tone === "outage"
      ? "var(--status-outage)"
      : tone === "degraded"
        ? "var(--status-degraded)"
        : "var(--status-healthy)";
  return (
    <div
      className="rounded-xl border p-4"
      style={{ background: "var(--monitor-panel)", borderColor: "var(--monitor-border)" }}
    >
      <p className="text-xs" style={{ color: "var(--monitor-muted)" }}>
        {label}
      </p>
      <svg viewBox="0 0 120 70" className="mt-2 w-full">
        <path
          d={`M 14 60 A ${radius} ${radius} 0 0 1 106 60`}
          fill="none"
          stroke="var(--monitor-border)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d={`M 14 60 A ${radius} ${radius} 0 0 1 106 60`}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
        />
        <text x="60" y="56" textAnchor="middle" fontSize="16" fill="var(--monitor-foreground)" fontWeight="600">
          {display}
        </text>
      </svg>
      <p className="text-[11px]" style={{ color: "var(--monitor-muted)" }}>
        Anlık: {formatNumber(Math.round(value))}
      </p>
    </div>
  );
}

export function LoadTestMonitor({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery(loadTestStatusQuery(enabled));
  const [form, setForm] = useState<Record<string, number>>({});

  const config = data?.config;
  const run = data?.activeRun ?? null;
  const countdown = useCountdown(run ? null : (data?.nextCycleAt ?? null));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["load-test-status"] });

  const configMutation = useMutation({
    mutationFn: (patch: Record<string, number | boolean>) => saveLoadTestConfig({ data: patch as never }),
    onSuccess: () => {
      toast.success("Test ayarları kaydedildi");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const stepMutation = useMutation({
    mutationFn: () => stepLoadTestCycle(),
    onSuccess: (result) => {
      const phase = (result as { phase?: string }).phase;
      toast.success(phase ? `${PHASE_LABELS[phase] ?? phase} adımı çalıştı` : "Adım çalıştı");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const stopMutation = useMutation({
    mutationFn: () => stopLoadTestSuite({ data: { cleanup: true } }),
    onSuccess: () => {
      toast.success("Test süiti durduruldu ve test verisi temizlendi");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const summary = (run?.summary ?? {}) as Record<string, number | Record<string, number>>;
  const metrics = (run?.metrics ?? {}) as Record<string, number | Record<string, unknown>>;
  const health = (metrics["health"] ?? {}) as {
    api?: { p95?: number; requests?: number; errors?: number };
    cache?: { ratio?: number };
    queue?: { queued?: number; running?: number; failed?: number };
    overall?: string;
  };

  const ordersPerSecond = useMemo(() => {
    if (!run) return 0;
    const orders = Number(summary["orders"] ?? 0);
    const seconds = Math.max(1, (Date.now() - new Date(run.startedAt).getTime()) / 1000);
    return orders / seconds;
  }, [run, summary]);

  const errorRate = health.api?.requests
    ? ((health.api.errors ?? 0) / health.api.requests) * 100
    : 0;
  const latency = Number(health.api?.p95 ?? metrics["storefrontP95"] ?? 0);
  const backlog = Number(health.queue?.queued ?? 0) + Number(health.queue?.running ?? 0);

  const field = (key: string, fallback: number) => form[key] ?? fallback;

  return (
    <section
      className="rounded-2xl border p-6"
      style={{
        background: "var(--monitor-surface)",
        borderColor: "var(--monitor-border)",
        color: "var(--monitor-foreground)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Otomatik yük testi orkestratörü</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--monitor-muted)" }}>
            {run
              ? `Tur ${run.cycleNo} · ${PHASE_LABELS[run.phase] ?? run.phase} fazı · ${formatDateTime(run.startedAt)}`
              : countdown
                ? `Sonraki otomatik sıfırlama ve test turu: ${countdown}`
                : "Aktif tur yok. Testi başlatmak için süiti etkinleştirin."}
          </p>
          <p className="mt-1 text-[11px]" style={{ color: "var(--monitor-muted)" }}>
            Test verisi yalnızca TEST işaretli mağazalarda tutulur ({formatNumber(data?.testStores ?? 0)} mağaza) ve
            her turun sonunda silinir. 20.000 gerçek eşzamanlı kullanıcı için `loadtest/k6` senaryoları harici bir
            yük sağlayıcısında çalıştırılmalıdır.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={run ? "default" : "secondary"}>
            {run ? STATUS_LABELS[run.status] ?? run.status : "Beklemede"}
          </Badge>
          <div className="flex items-center gap-2 text-xs">
            <Switch
              checked={Boolean(config?.enabled)}
              onCheckedChange={(checked) => configMutation.mutate({ enabled: checked })}
            />
            <span>Süit etkin</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Switch
              checked={Boolean(config?.paused)}
              onCheckedChange={(checked) => configMutation.mutate({ paused: checked })}
            />
            <span>Duraklat</span>
          </div>
          <Button size="sm" variant="secondary" onClick={() => stepMutation.mutate()} disabled={stepMutation.isPending}>
            Adımı şimdi çalıştır
          </Button>
          <Button size="sm" variant="destructive" onClick={() => stopMutation.mutate()} disabled={stopMutation.isPending}>
            TEST SÜİTİNİ DURDUR
          </Button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-destructive">{(error as Error).message}</p> : null}

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Gauge
          label="Sanal kullanıcı (hedef)"
          value={Number(config?.vusersTarget ?? 0)}
          display={formatNumber(Number(config?.vusersTarget ?? 0))}
          ratio={Number(config?.vusersTarget ?? 0) / 20000}
          tone="healthy"
        />
        <Gauge
          label="Sipariş / saniye"
          value={ordersPerSecond}
          display={ordersPerSecond.toFixed(2)}
          ratio={ordersPerSecond / 10}
          tone={ordersPerSecond > 0 ? "healthy" : "degraded"}
        />
        <Gauge
          label="API p95 gecikme (ms)"
          value={latency}
          display={`${Math.round(latency)} ms`}
          ratio={latency / 600}
          tone={latency > 200 ? "outage" : latency > 150 ? "degraded" : "healthy"}
        />
        <Gauge
          label="Hata oranı"
          value={errorRate}
          display={`${errorRate.toFixed(2)}%`}
          ratio={errorRate / 5}
          tone={errorRate > 1 ? "outage" : errorRate > 0.2 ? "degraded" : "healthy"}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
        <Stat label="Tohumlanan mağaza" value={formatNumber(Number(summary["stores"] ?? 0))} />
        <Stat label="Tohumlanan ürün" value={formatNumber(Number(summary["products"] ?? 0))} />
        <Stat label="Oluşan sipariş" value={formatNumber(Number(summary["orders"] ?? 0))} />
        <Stat label="İade talebi" value={formatNumber(Number(summary["returns"] ?? 0))} />
        <Stat label="Stok engeli (aşırı satış önlendi)" value={formatNumber(Number(summary["stockBlocked"] ?? 0))} />
        <Stat label="Önbellek isabet" value={`${(((health.cache?.ratio ?? 0) as number) * 100).toFixed(1)}%`} />
        <Stat label="Kuyruk birikimi" value={formatNumber(backlog)} />
        <Stat label="Bulgu" value={formatNumber(run?.findingsCount ?? 0)} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--monitor-border)" }}>
          <h3 className="text-sm font-semibold">Ölçek ayarları</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {[
              { key: "storesTarget", label: "Mağaza", value: config?.storesTarget ?? 1000 },
              { key: "productsTarget", label: "Ürün", value: config?.productsTarget ?? 50000 },
              { key: "vusersTarget", label: "Sanal kullanıcı", value: config?.vusersTarget ?? 500 },
              { key: "ordersTarget", label: "Sipariş", value: config?.ordersTarget ?? 10000 },
              { key: "cycleMinutes", label: "Tur süresi (dk)", value: config?.cycleMinutes ?? 180 },
            ].map((item) => (
              <div key={item.key}>
                <Label className="text-[11px]" style={{ color: "var(--monitor-muted)" }}>
                  {item.label}
                </Label>
                <Input
                  type="number"
                  className="mt-1 h-9"
                  value={field(item.key, item.value)}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, [item.key]: Number(event.target.value) }))
                  }
                />
              </div>
            ))}
          </div>
          <Button
            size="sm"
            className="mt-3"
            disabled={configMutation.isPending || Object.keys(form).length === 0}
            onClick={() => configMutation.mutate(form)}
          >
            Ölçeği kaydet
          </Button>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: "var(--monitor-border)" }}>
          <h3 className="text-sm font-semibold">Faz akışı</h3>
          <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-xs">
            {(data?.events ?? []).map((event) => {
              const row = event as Record<string, string>;
              return (
                <li key={row["id"]} className="border-b pb-2" style={{ borderColor: "var(--monitor-border)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {PHASE_LABELS[row["phase"] ?? ""] ?? row["phase"]} — {row["message"]}
                    </span>
                    <Badge variant={row["level"] === "CRITICAL" ? "destructive" : "secondary"}>{row["level"]}</Badge>
                  </div>
                  <p style={{ color: "var(--monitor-muted)" }}>{formatDateTime(row["created_at"] ?? "")}</p>
                </li>
              );
            })}
            {!isLoading && (data?.events ?? []).length === 0 ? (
              <li style={{ color: "var(--monitor-muted)" }}>Kayıt yok.</li>
            ) : null}
          </ul>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: "var(--monitor-border)" }}>
          <h3 className="text-sm font-semibold">Bulgular (aşırı satış / komisyon mutabakatı)</h3>
          <ul className="mt-3 max-h-56 space-y-2 overflow-auto text-xs">
            {(data?.findings ?? []).map((finding) => {
              const row = finding as Record<string, string>;
              return (
                <li key={row["id"]} className="border-b pb-2" style={{ borderColor: "var(--monitor-border)" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{row["kind"]}</span>
                    <Badge variant="destructive">{row["severity"]}</Badge>
                  </div>
                  <p style={{ color: "var(--monitor-muted)" }}>{row["detail"]}</p>
                </li>
              );
            })}
            {!isLoading && (data?.findings ?? []).length === 0 ? (
              <li style={{ color: "var(--monitor-muted)" }}>
                Bulgu yok — aşırı satış ve komisyon hesapları kuruşuna kadar tutuyor.
              </li>
            ) : null}
          </ul>
        </div>

        <div className="rounded-xl border p-4" style={{ borderColor: "var(--monitor-border)" }}>
          <h3 className="text-sm font-semibold">Son turlar</h3>
          <ul className="mt-3 max-h-56 space-y-2 overflow-auto text-xs">
            {(data?.runs ?? []).map((item) => (
              <li key={item.id} className="border-b pb-2" style={{ borderColor: "var(--monitor-border)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">Tur {item.cycleNo}</span>
                  <Badge variant={item.status.startsWith("completed") ? "secondary" : "destructive"}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </Badge>
                </div>
                <p style={{ color: "var(--monitor-muted)" }}>
                  {formatDateTime(item.startedAt)} · {formatNumber(item.findingsCount)} bulgu ·{" "}
                  {String((item.summary as Record<string, unknown>)["thresholdFailures"] ?? "") || "eşikler tamam"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--monitor-border)" }}>
      <p className="text-[11px]" style={{ color: "var(--monitor-muted)" }}>
        {label}
      </p>
      <p className="mt-1 font-display text-lg font-semibold">{value}</p>
    </div>
  );
}
