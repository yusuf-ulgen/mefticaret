/** Platform (pazarlama) sayfalarının anonim ziyaret izleyicisi. Hata asla sayfayı bozmaz. */

const EXCLUDED = /^\/(s|store|admin|api|preview|demo|magaza|supplier\/panel|ev-hanimlari\/panel|mesajlar|kolay|login|register|forgot-password)(\/|$)/;

function rid() {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

function id(storage: Storage, key: string) {
  let v = storage.getItem(key);
  if (!v) {
    v = rid();
    storage.setItem(key, v);
  }
  return v;
}

let lastPath = "";

export function trackPlatformView(path: string) {
  if (typeof window === "undefined" || EXCLUDED.test(path) || path === lastPath) return;
  if (window.location.hostname.includes("id-preview") || window.location.hostname === "localhost") return;
  lastPath = path;
  try {
    const now = Date.now();
    const last = Number(sessionStorage.getItem("mefti-p-ts") ?? 0);
    if (now - last > 30 * 60_000) sessionStorage.removeItem("mefti-p-session");
    sessionStorage.setItem("mefti-p-ts", String(now));
    const utm = new URLSearchParams(window.location.search).get("utm_source");
    const body = JSON.stringify({
      visitorId: id(localStorage, "mefti-visitor-id"),
      sessionId: id(sessionStorage, "mefti-p-session"),
      path,
      pageTitle: document.title.slice(0, 200),
      referrer: document.referrer || "",
      ...(utm ? { source: utm } : {}),
    });
    const url = "/api/public/track-platform";
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    else void fetch(url, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    /* sessiz */
  }
}
