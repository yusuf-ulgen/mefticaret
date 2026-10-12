import type { Plugin } from "vite";

/**
 * Geliştirme sunucusunda tarayıcı sayfadan ayrıldığında/yenilediğinde
 * node:_http_server ve srvx "aborted" / "AbortError: This operation was aborted"
 * hatalarını süreç seviyesinde yayar. Bunlar uygulama hatası değildir; hata
 * bildirimi kanallarını kirletmemeleri için burada, tüm uygulama kodundan önce
 * yutulur.
 */

const ABORT_PATTERNS = [
  /This operation was aborted/i,
  /(^|\n|:\s*)aborted(\s|$|\n)/,
  /The user aborted a request/i,
  /ECONNRESET/,
  /ERR_STREAM_PREMATURE_CLOSE/,
];

function isClientAbort(value: unknown, depth = 0): boolean {
  if (value == null || depth > 5) return false;
  const err = value as { name?: unknown; code?: unknown; message?: unknown; cause?: unknown };
  if (err.name === "AbortError" || err.code === "ABORT_ERR" || err.code === "ECONNRESET") return true;
  if (typeof err.message === "string" && ABORT_PATTERNS.some((p) => p.test(err.message as string))) {
    return true;
  }
  return isClientAbort(err.cause, depth + 1);
}

let installed = false;

function install() {
  if (installed) return;
  installed = true;

  // Gerçek hatalar diğer dinleyiciler/log kanalları tarafından raporlanmaya
  // devam eder; burada sadece iptaller sessizce yutulur.
  process.on("uncaughtException", (error) => {
    if (isClientAbort(error)) return;
    console.error(error);
  });
  process.on("unhandledRejection", (reason) => {
    if (isClientAbort(reason)) return;
    console.error(reason);
  });

  // Bağlantı kopması izleri log akışına da yazılmasın.
  const originalWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: unknown, ...rest: unknown[]) => {
    const text = typeof chunk === "string" ? chunk : String(chunk);
    if (
      ABORT_PATTERNS.some((p) => p.test(text)) &&
      /_http_server|srvx|AbortController|abortIncoming|AbortError/.test(text)
    ) {
      return true;
    }
    return (originalWrite as (...args: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stderr.write;
}

export function suppressClientAbort(): Plugin {
  return {
    name: "mefticaret:suppress-client-abort",
    apply: "serve",
    configResolved() {
      install();
    },
  };
}
