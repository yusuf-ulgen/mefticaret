/**
 * CDN / tarayıcı önbellek politikaları.
 *
 * Vitrin sayfaları CDN'de kısa süre tutulur ve arka planda tazelenir
 * (stale-while-revalidate). Panel, API ve oturum gerektiren yollar
 * kesinlikle önbelleğe alınmaz.
 */

const NO_STORE = "no-store, must-revalidate";

/** Asla önbelleğe alınmayacak yol önekleri. */
const PRIVATE_PREFIXES = ["/api/", "/_serverFn", "/store", "/admin", "/auth", "/oauth", "/account", "/dashboard"];

export function cacheControlFor(pathname: string, method: string): string | null {
  if (method !== "GET" && method !== "HEAD") return NO_STORE;

  // Vite tarafından hash'lenmiş varlıklar sonsuza kadar önbelleklenebilir.
  if (pathname.startsWith("/assets/") || /\.(?:js|css|woff2?|svg|png|jpg|jpeg|webp|avif|ico)$/.test(pathname)) {
    return "public, max-age=31536000, immutable";
  }

  if (PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) return NO_STORE;

  // Vitrin ve pazarlama sayfaları: tarayıcıda kısa, CDN'de daha uzun.
  if (pathname === "/" || pathname.startsWith("/s/") || pathname.startsWith("/blog") || pathname.startsWith("/p/")) {
    return "public, max-age=0, s-maxage=60, stale-while-revalidate=300";
  }

  return null;
}

/** Yanıta uygun önbellek politikasını ekler (mevcut başlığı ezmez). */
export function applyCacheHeaders(response: Response, url: string, method: string): Response {
  if (response.headers.has("cache-control")) return response;
  let pathname = "/";
  try {
    pathname = new URL(url).pathname;
  } catch {
    pathname = "/";
  }
  const value = cacheControlFor(pathname, method);
  if (value) {
    response.headers.set("cache-control", value);
    if (value.includes("s-maxage")) response.headers.set("vary", "accept-encoding, accept");
  }
  return response;
}
