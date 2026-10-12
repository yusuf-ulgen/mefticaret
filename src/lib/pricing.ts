/** Toplu fiyatlandırma için saf hesaplama yardımcıları (test edilebilir, sunucu+istemci ortak). */

export type PriceMode = "increase_percent" | "decrease_percent" | "increase_amount" | "decrease_amount" | "set";
export type RoundMode = "none" | "integer" | "x90" | "x99";

export const PRICE_MODE_LABELS: Record<PriceMode, string> = {
  increase_percent: "Yüzde artır (%)",
  decrease_percent: "Yüzde azalt (%)",
  increase_amount: "Tutar ekle",
  decrease_amount: "Tutar çıkar",
  set: "Sabit fiyat ata",
};

export const ROUND_MODE_LABELS: Record<RoundMode, string> = {
  none: "Yuvarlama yok",
  integer: "Tam sayıya yuvarla",
  x90: ",90 ile bitir",
  x99: ",99 ile bitir",
};

export function applyRounding(price: number, round: RoundMode): number {
  if (round === "none") return Math.round(price * 100) / 100;
  const whole = Math.floor(price);
  if (round === "integer") return Math.max(0, Math.round(price));
  const cents = round === "x90" ? 0.9 : 0.99;
  const candidate = whole + cents;
  return Math.max(0, Math.round(candidate * 100) / 100);
}

export function computePrice(current: number, mode: PriceMode, value: number, round: RoundMode): number {
  const safe = Number.isFinite(current) ? current : 0;
  let next = safe;
  if (mode === "increase_percent") next = safe * (1 + value / 100);
  else if (mode === "decrease_percent") next = safe * (1 - value / 100);
  else if (mode === "increase_amount") next = safe + value;
  else if (mode === "decrease_amount") next = safe - value;
  else next = value;
  if (next < 0) next = 0;
  return applyRounding(next, round);
}

export function priceDelta(before: number, after: number) {
  if (before <= 0) return 0;
  return ((after - before) / before) * 100;
}
