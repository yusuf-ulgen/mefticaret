/**
 * Vitrin analitik istemcisi: ziyaretçi + oturum kimliği üretir ve davranış
 * olaylarını public track uç noktasına gönderir. Tüm çağrılar sessizdir;
 * analitik hatası hiçbir zaman mağaza deneyimini bozmaz.
 */

const VISITOR_KEY = "mefti-visitor-id";
const SESSION_KEY = "mefti-session-id";
const SESSION_TS_KEY = "mefti-session-ts";
const SESSION_TTL_MS = 30 * 60 * 1000;

export type TrackKind = "page_view" | "product_view" | "add_to_cart" | "checkout" | "purchase";

export type TrackPayload = {
  path?: string;
  productId?: string;
  variantId?: string;
  orderId?: string;
  value?: number;
  quantity?: number;
  currency?: string;
};

function randomId() {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

function visitorId(): string {
  const existing = window.localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const created = randomId();
  window.localStorage.setItem(VISITOR_KEY, created);
  return created;
}

/** 30 dakika hareketsizlikten sonra yeni oturum açılır. */
function sessionId(): string {
  const now = Date.now();
  const last = Number(window.sessionStorage.getItem(SESSION_TS_KEY) ?? 0);
  let id = window.sessionStorage.getItem(SESSION_KEY);
  if (!id || now - last > SESSION_TTL_MS) {
    id = randomId();
    window.sessionStorage.setItem(SESSION_KEY, id);
  }
  window.sessionStorage.setItem(SESSION_TS_KEY, String(now));
  return id;
}

function campaignParams() {
  const params = new URLSearchParams(window.location.search);
  const source = params.get("utm_source");
  const medium = params.get("utm_medium");
  const campaign = params.get("utm_campaign");
  return {
    ...(source ? { source } : {}),
    ...(medium ? { medium } : {}),
    ...(campaign ? { campaign } : {}),
  };
}

/** Aynı olayın çift gönderimini (StrictMode / hızlı re-render) engeller. */
const recent = new Set<string>();

export function trackEvent(storeSlug: string, kind: TrackKind, payload: TrackPayload = {}) {
  if (typeof window === "undefined" || !storeSlug) return;
  try {
    const dedupeKey = `${kind}:${payload.path ?? ""}:${payload.productId ?? ""}:${payload.variantId ?? ""}:${payload.orderId ?? ""}`;
    if (kind !== "add_to_cart" && recent.has(dedupeKey)) return;
    recent.add(dedupeKey);
    setTimeout(() => recent.delete(dedupeKey), 1500);

    const body = JSON.stringify({
      visitorId: visitorId(),
      sessionId: sessionId(),
      kind,
      path: payload.path ?? window.location.pathname,
      referrer: document.referrer || "",
      ...campaignParams(),
      ...payload,
    });

    const url = `/api/public/track/${encodeURIComponent(storeSlug)}`;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(url, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    /* analitik sessizce yut */
  }
}
