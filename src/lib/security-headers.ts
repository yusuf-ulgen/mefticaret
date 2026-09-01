/**
 * Tüm HTTP yanıtlarına uygulanan güvenlik başlıkları.
 * HTTPS zorlaması (HSTS), XSS/clickjacking sertleştirmesi ve referrer/izin politikaları.
 */

const CSP = [
  "default-src 'self'",
  // Vitrin temaları mağaza sahibinin bilinçli özel CSS/JS'ini çalıştırabilir.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline' https:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data: https:",
  "connect-src 'self' https: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Editör önizlemesi ve mağaza gömülü kullanımları için çerçeveleme kısıtlı biçimde açık.
  "frame-ancestors 'self' https:",
  "upgrade-insecure-requests",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-xss-protection": "0",
  "permissions-policy": "camera=(), microphone=(), geolocation=(self), payment=(self)",
  "cross-origin-opener-policy": "same-origin-allow-popups",
  "content-security-policy": CSP,
};

/** Yanıt başlıklarını yerinde sertleştirir (mevcut başlıkları ezmez). */
export function applySecurityHeaders(response: Response): Response {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!response.headers.has(key)) response.headers.set(key, value);
  }
  return response;
}
