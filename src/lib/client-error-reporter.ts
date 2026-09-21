/**
 * Tarayıcı tarafı genel hata yakalayıcı.
 * Yakalanan hatalar `/api/public/telemetry/error` üzerinden hata masasına yazılır.
 */

const seen = new Set<string>();
let installed = false;

export function reportClientError(input: {
  message: string;
  stack?: string | undefined;
  severity?: "CRITICAL" | "WARNING" | "INFO";
  source?: string;
}) {
  if (typeof window === "undefined") return;
  const key = `${input.source ?? "window"}|${input.message}`.slice(0, 300);
  if (seen.has(key)) return;
  seen.add(key);
  if (seen.size > 50) seen.clear();

  void fetch("/api/public/telemetry/error", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      message: input.message.slice(0, 2000),
      ...(input.stack ? { stack: input.stack.slice(0, 8000) } : {}),
      route: window.location.pathname,
      severity: input.severity ?? "WARNING",
      source: input.source ?? "window",
    }),
    keepalive: true,
  }).catch(() => {
    /* raporlama başarısızsa kullanıcı akışı etkilenmez */
  });
}

/** Global `error` ve `unhandledrejection` olaylarını bir kez bağlar. */
export function installClientErrorReporting() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    const error = event.error as Error | undefined;
    reportClientError({
      message: error?.message ?? event.message ?? "Bilinmeyen tarayıcı hatası",
      stack: error?.stack,
      source: "window.onerror",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as unknown;
    reportClientError({
      message:
        reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Yakalanmayan promise hatası",
      stack: reason instanceof Error ? reason.stack : undefined,
      source: "unhandledrejection",
    });
  });
}
