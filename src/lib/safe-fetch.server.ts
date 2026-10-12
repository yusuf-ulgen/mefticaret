/**
 * SSRF koruması: mağaza yöneticisinin girdiği adreslere sunucudan istek
 * atılırken iç ağ, loopback, link-local ve bulut metadata uçlarına erişim
 * engellenir. Yönlendirmeler otomatik takip edilmez; her adım yeniden
 * doğrulanır.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
]);

function isBlockedIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums as [number, number, number, number];
  if (a === 0 || a === 10 || a === 127) return true; // this-host, private, loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 192 && b === 0) return true; // special-use
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIpv6(raw: string): boolean {
  const host = raw.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host.includes(":")) return false;
  if (host === "::" || host === "::1") return true;
  if (host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb")) {
    return true; // link-local
  }
  if (/^f[cd]/.test(host)) return true; // unique-local
  // IPv4-mapped (::ffff:10.0.0.1)
  const mapped = host.split(":").pop();
  if (mapped && mapped.includes(".") && isBlockedIpv4(mapped)) return true;
  return true; // diğer ham IPv6 adreslerine sunucudan istek atılmaz
}

/** Adresi doğrular; güvenli değilse hata atar. */
export function assertPublicUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Geçersiz adres");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Yalnızca http/https adresleri desteklenir");
  }
  const host = url.hostname.toLowerCase();
  if (!host) throw new Error("Geçersiz adres");
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error("Bu adrese sunucudan istek atılamaz");
  }
  if (isBlockedIpv4(host) || isBlockedIpv6(url.hostname)) {
    throw new Error("Bu adrese sunucudan istek atılamaz");
  }
  return url;
}

/**
 * Doğrulanmış adrese istek atar. Yönlendirmeler elle takip edilir ve her hedef
 * yeniden doğrulanır (en fazla 3 adım).
 */
export async function safeFetch(input: string, init: RequestInit = {}): Promise<Response> {
  let current = assertPublicUrl(input).toString();
  for (let hop = 0; hop < 4; hop += 1) {
    const response = await fetch(current, { ...init, redirect: "manual" });
    if (response.status < 300 || response.status > 399) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    current = assertPublicUrl(new URL(location, current).toString()).toString();
  }
  throw new Error("Çok fazla yönlendirme");
}
