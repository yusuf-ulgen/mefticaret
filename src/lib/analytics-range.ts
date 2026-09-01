/** Analitik tarih aralığı yardımcıları: hazır dönemler + özel tarih. */

export type RangePreset = "today" | "yesterday" | "7d" | "30d" | "90d" | "custom";

export const RANGE_PRESETS: { id: RangePreset; label: string }[] = [
  { id: "today", label: "Bugün" },
  { id: "yesterday", label: "Dün" },
  { id: "7d", label: "Son 7 gün" },
  { id: "30d", label: "Son 30 gün" },
  { id: "90d", label: "Son 90 gün" },
  { id: "custom", label: "Özel tarih" },
];

export type DateRange = {
  /** Kapsayıcı başlangıç günü (YYYY-MM-DD) */
  from: string;
  /** Kapsayıcı bitiş günü (YYYY-MM-DD) */
  to: string;
  fromIso: string;
  toIso: string;
  /** Aralıktaki gün sayısı (grafik bucket'ları için) */
  days: number;
  label: string;
};

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function shift(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

export function buildRange(preset: RangePreset, customFrom?: string, customTo?: string): DateRange {
  const today = dayKey(new Date());
  let from = today;
  let to = today;

  if (preset === "yesterday") {
    from = dayKey(shift(1));
    to = from;
  } else if (preset === "7d") {
    from = dayKey(shift(6));
  } else if (preset === "30d") {
    from = dayKey(shift(29));
  } else if (preset === "90d") {
    from = dayKey(shift(89));
  } else if (preset === "custom") {
    from = customFrom || dayKey(shift(6));
    to = customTo || today;
    if (from > to) [from, to] = [to, from];
  }

  const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
  const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();
  const days = Math.max(1, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000));

  return {
    from,
    to,
    fromIso,
    toIso,
    days,
    label: RANGE_PRESETS.find((item) => item.id === preset)?.label ?? "Dönem",
  };
}

/** Aralıktaki tüm günleri sıralı döndürür (boş günler grafikte 0 olur). */
export function rangeDays(range: DateRange): string[] {
  const out: string[] = [];
  let cursor = Date.parse(`${range.from}T00:00:00.000Z`);
  const end = Date.parse(`${range.to}T00:00:00.000Z`);
  while (cursor <= end) {
    out.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 86_400_000;
  }
  return out;
}
