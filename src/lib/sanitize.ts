/**
 * Dışarıdan gelen metinlerin temizlenmesi (XML/CSV/Excel içe aktarma, formlar).
 * Amaç: XSS taşıyan HTML/JS parçalarını ve kontrol karakterlerini kaldırmak.
 * SQL enjeksiyonu parametreli sorgularla engellenir; burada ek olarak kontrol
 * karakterleri ve boş bayt temizlenir.
 */

const SCRIPT_BLOCK = /<\s*(script|style|iframe|object|embed)[\s\S]*?<\s*\/\s*\1\s*>/gi;
const HTML_TAG = /<\/?[a-z][^>]*>/gi;
const EVENT_ATTR = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const DANGEROUS_PROTOCOL = /(javascript|vbscript|data)\s*:/gi;
// Boş bayt ve görünmez kontrol karakterleri.
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

/** HTML/JS taşımayan düz metin üretir. */
export function sanitizeText(value: string, maxLength = 4000): string {
  return value
    .replace(SCRIPT_BLOCK, " ")
    .replace(EVENT_ATTR, " ")
    .replace(HTML_TAG, " ")
    .replace(DANGEROUS_PROTOCOL, "")
    .replace(CONTROL_CHARS, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, maxLength);
}

/** Yalnızca http/https bağlantılarına izin verir; diğerlerinde `null` döner. */
export function sanitizeUrl(value: string): string | null {
  const cleaned = value.replace(CONTROL_CHARS, "").trim();
  try {
    const url = new URL(cleaned);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().slice(0, 2000);
  } catch {
    return null;
  }
}

/** Metin alanı ya da `null` döndürür (boş metinler null olur). */
export function sanitizeNullableText(value: string | null | undefined, maxLength = 4000): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = sanitizeText(value, maxLength);
  return cleaned.length > 0 ? cleaned : null;
}
