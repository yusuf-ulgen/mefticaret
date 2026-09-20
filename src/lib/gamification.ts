/**
 * Oyunlaştırma motoru — saf hesaplama.
 * Çark / kazı-kazan ödül seçimi ve indirim kodu üretimi burada yapılır;
 * gerçek seçim daima sunucuda çalışır, tarayıcıya güvenilmez.
 */

export const GAMIFICATION_KINDS = ["spin_wheel", "scratch_card"] as const;
export type GamificationKind = (typeof GAMIFICATION_KINDS)[number];

export const GAMIFICATION_KIND_LABELS: Record<GamificationKind, string> = {
  spin_wheel: "Şans çarkı",
  scratch_card: "Kazı kazan",
};

export type GamificationPrize = {
  label: string;
  /** İndirim değeri (yüzde veya tutar). 0 = ödül yok. */
  value: number;
  /** Çekiliş ağırlığı; büyük değer daha sık kazanır. */
  weight: number;
};

export const DEFAULT_PRIZES: GamificationPrize[] = [
  { label: "%5 indirim", value: 5, weight: 40 },
  { label: "%10 indirim", value: 10, weight: 25 },
  { label: "%15 indirim", value: 15, weight: 10 },
  { label: "Ücretsiz kargo", value: 0, weight: 15 },
  { label: "Bu sefer olmadı", value: 0, weight: 10 },
];

export function normalizePrizes(value: unknown): GamificationPrize[] {
  if (!Array.isArray(value)) return DEFAULT_PRIZES;
  const prizes = value
    .map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      const label = String(row["label"] ?? "").trim();
      if (!label) return null;
      return {
        label: label.slice(0, 60),
        value: Math.max(0, Number(row["value"] ?? 0)),
        weight: Math.max(1, Number(row["weight"] ?? 1)),
      } satisfies GamificationPrize;
    })
    .filter((item): item is GamificationPrize => item !== null);
  return prizes.length > 0 ? prizes : DEFAULT_PRIZES;
}

/** Ağırlıklı çekiliş. `random` 0–1 arası olmalıdır (test edilebilirlik için dışarıdan verilir). */
export function drawPrize(prizes: GamificationPrize[], random: number): GamificationPrize {
  const list = prizes.length > 0 ? prizes : DEFAULT_PRIZES;
  const total = list.reduce((sum, prize) => sum + Math.max(1, prize.weight), 0);
  let ticket = Math.min(Math.max(random, 0), 0.999999) * total;
  for (const prize of list) {
    ticket -= Math.max(1, prize.weight);
    if (ticket < 0) return prize;
  }
  return list[list.length - 1]!;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Okunabilir indirim kodu üretir: SANS-7KQ4M9 */
export function buildDiscountCode(prefix: string, random: () => number = Math.random) {
  const base = (prefix || "SANS").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "SANS";
  let suffix = "";
  for (let index = 0; index < 6; index += 1) {
    suffix += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  }
  return `${base}-${suffix}`;
}

export function prizeSummary(prizes: GamificationPrize[]) {
  const total = prizes.reduce((sum, prize) => sum + Math.max(1, prize.weight), 0);
  return prizes.map((prize) => ({
    ...prize,
    chance: total > 0 ? Math.round((Math.max(1, prize.weight) / total) * 1000) / 10 : 0,
  }));
}
