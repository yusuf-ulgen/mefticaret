/**
 * Mağazanın yerel gününe göre gün başlangıcı.
 * Günlük sipariş kotası hem satıcı panelinde hem de ödeme adımında aynı
 * pencereyi kullanmalıdır; aksi halde gece yarısı ile UTC arasında kota
 * yanlış hesaplanır.
 */

export const DEFAULT_STORE_TIMEZONE = "Europe/Istanbul";

/** Kotaya sayılmayan sipariş durumları (iptal/iade/geri ödeme). */
export const QUOTA_EXCLUDED_STATUSES = ["cancelled", "returned", "refunded"] as const;

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsIn(timeZone: string, date: Date): Parts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = Number(part.value);
  }
  return {
    year: map["year"] ?? 0,
    month: map["month"] ?? 1,
    day: map["day"] ?? 1,
    hour: (map["hour"] ?? 0) % 24,
    minute: map["minute"] ?? 0,
    second: map["second"] ?? 0,
  };
}

function offsetMs(timeZone: string, date: Date) {
  const p = partsIn(timeZone, date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Verilen saat diliminde bugünün 00:00'ına karşılık gelen UTC anı. */
export function storeDayStart(timeZone = DEFAULT_STORE_TIMEZONE, now = new Date()): Date {
  const zone = safeZone(timeZone);
  const p = partsIn(zone, now);
  const midnightAsUtc = Date.UTC(p.year, p.month - 1, p.day, 0, 0, 0);
  return new Date(midnightAsUtc - offsetMs(zone, now));
}

/** Tarih, mağazanın yerel gününde bugüne mi ait? */
export function isStoreToday(value: string | null, timeZone = DEFAULT_STORE_TIMEZONE, now = new Date()) {
  if (!value) return false;
  const zone = safeZone(timeZone);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const a = partsIn(zone, date);
  const b = partsIn(zone, now);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

function safeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_STORE_TIMEZONE;
  }
}
