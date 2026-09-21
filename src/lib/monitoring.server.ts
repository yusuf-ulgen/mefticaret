/**
 * Sistem dayanıklılığı çekirdeği: hata kayıt masası, sağlık metrikleri ve
 * Slack/webhook uyarıları. Tüm değerler gerçek veritabanı ölçümlerinden gelir.
 */

export type ErrorSeverity = "CRITICAL" | "WARNING" | "INFO";

export type RecordErrorInput = {
  severity?: ErrorSeverity;
  source: string;
  message: string;
  stack?: string | null;
  route?: string | null;
  userId?: string | null;
  storeId?: string | null;
  meta?: Record<string, unknown>;
};

/** Sağlık eşikleri — aşıldığında panel sarı/kırmızı olur ve uyarı tetiklenir. */
export const HEALTH_THRESHOLDS = {
  dbLatencyMs: { degraded: 250, outage: 800 },
  cacheHitRatio: { degraded: 0.6, outage: 0.3 },
  apiP95Ms: { degraded: 800, outage: 2000 },
  apiErrorRate: { degraded: 0.01, outage: 0.05 },
  queueBacklog: { degraded: 250, outage: 1000 },
  queueFailed: { degraded: 1, outage: 25 },
  criticalErrors24h: { degraded: 1, outage: 10 },
} as const;

export type HealthStatus = "healthy" | "degraded" | "outage";

export function statusFor(
  value: number,
  thresholds: { degraded: number; outage: number },
  direction: "higher-is-worse" | "lower-is-worse" = "higher-is-worse",
): HealthStatus {
  if (direction === "higher-is-worse") {
    if (value >= thresholds.outage) return "outage";
    if (value >= thresholds.degraded) return "degraded";
    return "healthy";
  }
  if (value <= thresholds.outage) return "outage";
  if (value <= thresholds.degraded) return "degraded";
  return "healthy";
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Değişken kısımları (kimlik, sayı, tarih) temizleyerek kararlı parmak izi üretir. */
function fingerprintOf(input: RecordErrorInput): string {
  const normalizedMessage = input.message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\d{2,}/g, "<n>")
    .slice(0, 300);
  const frame = (input.stack ?? "")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("at "))
    ?.replace(/:\d+:\d+/g, "")
    .slice(0, 160);
  const raw = `${input.source}|${normalizedMessage}|${frame ?? ""}`;
  // FNV-1a: Worker ortamında bağımlılık gerektirmeyen hızlı özet.
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${input.source}:${hash.toString(16)}`;
}

/**
 * Hatayı kayıt masasına yazar (aynı hata tekrar ederse sayaç artar) ve
 * kritik/yeni hatalarda uyarı tetikler. Akışı asla bozmaz.
 */
export async function recordAppError(input: RecordErrorInput): Promise<void> {
  try {
    const severity: ErrorSeverity = input.severity ?? "WARNING";
    const db = await admin();
    const { data, error } = await db.rpc("record_app_error", {
      _fingerprint: fingerprintOf(input),
      _severity: severity,
      _source: input.source,
      _message: input.message.slice(0, 2000),
      ...(input.stack ? { _stack: input.stack.slice(0, 8000) } : {}),
      ...(input.route ? { _route: input.route } : {}),
      ...(input.userId ? { _user_id: input.userId } : {}),
      ...(input.storeId ? { _store_id: input.storeId } : {}),
      _meta: (input.meta ?? {}) as never,
    });
    if (error) return;
    const row = (Array.isArray(data) ? data[0] : data) as
      | { id: string; occurrences: number; is_new: boolean }
      | undefined;
    if (!row) return;

    if (severity === "CRITICAL" || row.is_new) {
      await sendMonitoringAlert({
        key: `error:${row.id}`,
        severity: severity === "CRITICAL" ? "CRITICAL" : "WARNING",
        title: `${severity === "CRITICAL" ? "Kritik hata" : "Yeni hata"}: ${input.message.slice(0, 160)}`,
        detail: [input.source, input.route, `tekrar: ${row.occurrences}`].filter(Boolean).join(" · "),
      });
    }
  } catch {
    /* hata kaydı başarısızsa istek normal devam eder */
  }
}

/** Uyarı adresi: platform ayarı ya da ortam değişkeni (kod içinde anahtar tutulmaz). */
async function alertWebhookUrl(): Promise<string | null> {
  const fromEnv = process.env["MONITORING_WEBHOOK_URL"] ?? process.env["SLACK_WEBHOOK_URL"];
  if (fromEnv) return fromEnv;
  try {
    const db = await admin();
    const { data } = await db
      .from("platform_settings")
      .select("value")
      .eq("key", "monitoring_webhook_url")
      .maybeSingle();
    const value = (data as { value?: unknown } | null)?.value;
    if (typeof value === "string" && value.startsWith("https://")) return value;
    if (value && typeof value === "object" && "url" in value) {
      const url = (value as { url?: unknown }).url;
      if (typeof url === "string" && url.startsWith("https://")) return url;
    }
    return null;
  } catch {
    return null;
  }
}

const SEVERITY_ICON: Record<string, string> = { CRITICAL: "🔴", WARNING: "🟡", INFO: "🟢" };

/** Susturma penceresi dolduysa Slack/genel webhook'a uyarı gönderir. */
export async function sendMonitoringAlert(input: {
  key: string;
  severity: ErrorSeverity;
  title: string;
  detail?: string | undefined;
  muteSeconds?: number;
}): Promise<boolean> {
  try {
    const db = await admin();
    const { data: allowed, error } = await db.rpc("claim_monitoring_alert", {
      _alert_key: input.key,
      _severity: input.severity,
      _title: input.title,
      ...(input.detail ? { _detail: input.detail } : {}),
      _mute_seconds: input.muteSeconds ?? 900,
    });
    if (error || allowed !== true) return false;

    const url = await alertWebhookUrl();
    if (!url) return false;
    const text = `${SEVERITY_ICON[input.severity] ?? "⚪"} *Mefticaret* ${input.title}${
      input.detail ? `\n${input.detail}` : ""
    }`;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, severity: input.severity, title: input.title, detail: input.detail ?? null }),
    });
    return true;
  } catch {
    return false;
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[index] ?? 0);
}

export type HealthMetric = {
  key: string;
  label: string;
  value: number;
  display: string;
  status: HealthStatus;
  hint: string;
};

/** Canlı altyapı metrikleri: veritabanı gecikmesi, önbellek, API, kuyruk, hata. */
export async function infrastructureHealth() {
  const db = await admin();
  const since24h = new Date(Date.now() - 86_400_000).toISOString();
  const since1h = new Date(Date.now() - 3_600_000).toISOString();
  const nowIso = new Date().toISOString();

  const pingStart = Date.now();
  await db.rpc("db_ping");
  const dbLatency = Date.now() - pingStart;

  const countOf = async (table: string, apply?: (query: any) => any) => {
    let query = (db as any).from(table).select("id", { count: "exact", head: true });
    if (apply) query = apply(query);
    const { count } = await query;
    return Number(count ?? 0);
  };

  const [cacheRes, apiRes, queued, running, failed, delayed, errorRes] = await Promise.all([
    db.from("cache_metrics").select("hits, misses").gte("bucket", since1h),
    db.from("api_request_logs").select("status_code, duration_ms").gte("created_at", since24h).limit(20000),
    countOf("job_queue", (q: any) => q.eq("status", "queued")),
    countOf("job_queue", (q: any) => q.eq("status", "running")),
    countOf("job_queue", (q: any) => q.eq("status", "failed")),
    countOf("job_queue", (q: any) => q.eq("status", "queued").lt("run_at", nowIso)),
    db
      .from("app_error_logs")
      .select("severity, occurrences, last_seen_at")
      .gte("last_seen_at", since24h)
      .limit(2000),
  ]);

  const cacheRows = (cacheRes.data ?? []) as { hits: number; misses: number }[];
  const cacheHits = cacheRows.reduce((sum, row) => sum + Number(row.hits ?? 0), 0);
  const cacheMisses = cacheRows.reduce((sum, row) => sum + Number(row.misses ?? 0), 0);
  const cacheTotal = cacheHits + cacheMisses;
  const cacheHitRatio = cacheTotal > 0 ? cacheHits / cacheTotal : 1;

  const apiRows = (apiRes.data ?? []) as { status_code: number; duration_ms: number | null }[];
  const durations = apiRows.map((row) => Number(row.duration_ms ?? 0));
  const apiErrors = apiRows.filter((row) => row.status_code >= 500).length;
  const apiErrorRate = apiRows.length > 0 ? apiErrors / apiRows.length : 0;

  const errorRows = (errorRes.data ?? []) as { severity: string; occurrences: number }[];
  const criticalErrors = errorRows
    .filter((row) => row.severity === "CRITICAL")
    .reduce((sum, row) => sum + Number(row.occurrences ?? 1), 0);
  const warningErrors = errorRows
    .filter((row) => row.severity === "WARNING")
    .reduce((sum, row) => sum + Number(row.occurrences ?? 1), 0);

  const backlog = queued + running;
  const metrics: HealthMetric[] = [
    {
      key: "db_latency",
      label: "Veritabanı gecikmesi",
      value: dbLatency,
      display: `${dbLatency} ms`,
      status: statusFor(dbLatency, HEALTH_THRESHOLDS.dbLatencyMs),
      hint: `Eşik ${HEALTH_THRESHOLDS.dbLatencyMs.degraded}/${HEALTH_THRESHOLDS.dbLatencyMs.outage} ms`,
    },
    {
      key: "cache_hit_ratio",
      label: "Önbellek isabet oranı",
      value: cacheHitRatio,
      display: `${(cacheHitRatio * 100).toFixed(1)}%`,
      status: statusFor(cacheHitRatio, HEALTH_THRESHOLDS.cacheHitRatio, "lower-is-worse"),
      hint: cacheTotal > 0 ? `${cacheHits} isabet / ${cacheMisses} ıskalama (1 saat)` : "Son 1 saatte ölçüm yok",
    },
    {
      key: "api_p95",
      label: "API p95 yanıt süresi",
      value: percentile(durations, 95),
      display: `${percentile(durations, 95)} ms`,
      status: statusFor(percentile(durations, 95), HEALTH_THRESHOLDS.apiP95Ms),
      hint: `p50 ${percentile(durations, 50)} ms · ${apiRows.length} istek (24s)`,
    },
    {
      key: "api_error_rate",
      label: "API hata oranı",
      value: apiErrorRate,
      display: `${(apiErrorRate * 100).toFixed(2)}%`,
      status: statusFor(apiErrorRate, HEALTH_THRESHOLDS.apiErrorRate),
      hint: `${apiErrors} sunucu hatası (24s)`,
    },
    {
      key: "queue_backlog",
      label: "Kuyruk birikimi",
      value: backlog,
      display: `${backlog} iş`,
      status: statusFor(backlog, HEALTH_THRESHOLDS.queueBacklog),
      hint: `${queued} bekliyor · ${running} çalışıyor · ${delayed} gecikmiş`,
    },
    {
      key: "queue_failed",
      label: "Başarısız işler",
      value: failed,
      display: `${failed} iş`,
      status: statusFor(failed, HEALTH_THRESHOLDS.queueFailed),
      hint: "3 denemeden sonra başarısız olan işler",
    },
    {
      key: "critical_errors",
      label: "Kritik hatalar (24s)",
      value: criticalErrors,
      display: `${criticalErrors}`,
      status: statusFor(criticalErrors, HEALTH_THRESHOLDS.criticalErrors24h),
      hint: `${warningErrors} uyarı seviyesinde kayıt`,
    },
  ];

  const overall: HealthStatus = metrics.some((metric) => metric.status === "outage")
    ? "outage"
    : metrics.some((metric) => metric.status === "degraded")
      ? "degraded"
      : "healthy";

  return {
    overall,
    metrics,
    measuredAt: nowIso,
    queue: { queued, running, failed, delayed },
    cache: { hits: cacheHits, misses: cacheMisses, ratio: cacheHitRatio },
    api: { requests: apiRows.length, errors: apiErrors, p50: percentile(durations, 50), p95: percentile(durations, 95) },
    errors: { critical: criticalErrors, warning: warningErrors },
  };
}

/** Eşik aşan metrikler için uyarı gönderir (cron tarafından çağrılır). */
export async function evaluateHealthAlerts() {
  const health = await infrastructureHealth();
  const sent: string[] = [];
  for (const metric of health.metrics) {
    if (metric.status === "healthy") continue;
    const ok = await sendMonitoringAlert({
      key: `health:${metric.key}:${metric.status}`,
      severity: metric.status === "outage" ? "CRITICAL" : "WARNING",
      title: `${metric.label}: ${metric.display} (${metric.status === "outage" ? "kesinti" : "bozulma"})`,
      detail: metric.hint,
    });
    if (ok) sent.push(metric.key);
  }
  return { overall: health.overall, alerted: sent };
}

/** Hata kayıt masası listesi (arama + seviye filtresi). */
export type ErrorLogRow = {
  id: string;
  severity: string;
  source: string;
  message: string;
  stack: string | null;
  route: string | null;
  user_id: string | null;
  store_id: string | null;
  occurrences: number;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
};

export async function listErrorLogs(input: {
  search?: string | undefined;
  severity?: ErrorSeverity | "ALL" | undefined;
  onlyOpen?: boolean | undefined;
  limit?: number | undefined;
}) {
  const db = await admin();
  let query = db
    .from("app_error_logs")
    .select(
      "id, severity, source, message, stack, route, user_id, store_id, occurrences, first_seen_at, last_seen_at, resolved_at",
    )
    .order("last_seen_at", { ascending: false })
    .limit(Math.min(input.limit ?? 100, 300));

  if (input.severity && input.severity !== "ALL") query = query.eq("severity", input.severity);
  if (input.onlyOpen) query = query.is("resolved_at", null);
  if (input.search) {
    const term = input.search.replace(/[%,]/g, " ").slice(0, 120);
    query = query.or(`message.ilike.%${term}%,source.ilike.%${term}%,route.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ErrorLogRow[];
}

/** Hatayı çözüldü / yeniden açık olarak işaretler. */
export async function setErrorLogResolved(id: string, resolved: boolean, userId: string) {
  const db = await admin();
  const { error } = await db
    .from("app_error_logs")
    .update({
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? userId : null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { id, resolved };
}
