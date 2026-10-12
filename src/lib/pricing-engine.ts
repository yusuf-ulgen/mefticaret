/**
 * Global Pricing Engine — saf hesaplama katmanı (sunucu + istemci ortak, test edilebilir).
 * Fiyatın tek yetkili kaynağı sunucudur; buradaki fonksiyonlar yalnızca deterministik
 * matematik ve biçimlendirme sağlar, veri okumaz.
 */

export type MarkupType = "none" | "fixed" | "percent";

export type RoundingMode =
  | "none"
  | "nearest_0_01"
  | "nearest_0_05"
  | "nearest_0_10"
  | "nearest_1"
  | "nearest_5"
  | "nearest_10"
  | "psych_99"
  | "psych_90"
  | "psych_95";

export type PriceSource = "base" | "auto" | "manual" | "price_list" | "campaign" | "rule";

export const MARKUP_TYPE_LABELS: Record<MarkupType, string> = {
  none: "Marj yok",
  fixed: "Sabit tutar",
  percent: "Yüzde",
};

export const ROUNDING_LABELS: Record<RoundingMode, string> = {
  none: "Yuvarlama yok",
  nearest_0_01: "0,01'e yuvarla",
  nearest_0_05: "0,05'e yuvarla",
  nearest_0_10: "0,10'a yuvarla",
  nearest_1: "1'e yuvarla",
  nearest_5: "5'e yuvarla",
  nearest_10: "10'a yuvarla",
  psych_99: ",99 ile bitir",
  psych_95: ",95 ile bitir",
  psych_90: ",90 ile bitir",
};

export const PRICE_SOURCE_LABELS: Record<PriceSource, string> = {
  base: "Temel fiyat",
  auto: "Otomatik (kur)",
  manual: "Manuel",
  price_list: "Fiyat listesi",
  campaign: "Kampanya",
  rule: "Kural",
};

export const RATE_FREQUENCY_LABELS: Record<string, string> = {
  manual: "Manuel",
  hourly: "Saatlik",
  six_hourly: "6 saatte bir",
  daily: "Günlük",
};

/** ISO 4217 ondalık bilgisi (JPY gibi sıfır ondalıklı para birimleri dahil). */
export const CURRENCY_DECIMALS: Record<string, number> = {
  JPY: 0,
  KRW: 0,
  CLP: 0,
  ISK: 0,
  VND: 0,
  BHD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  JOD: 3,
};

export function currencyDecimals(code: string): number {
  return CURRENCY_DECIMALS[code.toUpperCase()] ?? 2;
}

/** Kur üzerine marj uygular (kur marj'ı ya da fiyat marj'ı için ortak). */
export function applyMarkup(value: number, type: MarkupType, amount: number): number {
  if (!Number.isFinite(value)) return 0;
  if (type === "percent") return value * (1 + amount / 100);
  if (type === "fixed") return value + amount;
  return value;
}

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Yuvarlama; psikolojik modlarda tam sayı tabanına ondalık ekler. */
export function applyRounding(value: number, mode: RoundingMode, decimals = 2): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  const factor = 10 ** decimals;
  switch (mode) {
    case "none":
      return Math.round(value * factor) / factor;
    case "nearest_0_01":
      return Math.round(value * 100) / 100;
    case "nearest_0_05":
      return Number(roundToStep(value, 0.05).toFixed(2));
    case "nearest_0_10":
      return Number(roundToStep(value, 0.1).toFixed(2));
    case "nearest_1":
      return Math.round(value);
    case "nearest_5":
      return roundToStep(value, 5);
    case "nearest_10":
      return roundToStep(value, 10);
    case "psych_99":
    case "psych_95":
    case "psych_90": {
      if (decimals === 0) {
        const whole = Math.max(0, Math.round(value));
        return whole <= 1 ? whole : whole - 1;
      }
      const cents = mode === "psych_99" ? 0.99 : mode === "psych_95" ? 0.95 : 0.9;
      const floor = Math.floor(value);
      const candidate = floor + cents;
      // Değer tabana çok yakınsa bir alt basamağa in (46,37 → 45,99 gibi)
      const chosen = candidate <= value ? candidate : Math.max(0, floor - 1) + cents;
      return Number(chosen.toFixed(2));
    }
    default:
      return Math.round(value * factor) / factor;
  }
}

export type ConversionInput = {
  baseAmount: number;
  rate: number;
  markupType: MarkupType;
  markupValue: number;
  rounding: RoundingMode;
  decimals: number;
};

export type ConversionResult = {
  amount: number;
  rawAmount: number;
  effectiveRate: number;
};

/** Temel fiyatı hedef para birimine çevirir: kur → marj → yuvarlama. */
export function convertPrice(input: ConversionInput): ConversionResult {
  const raw = input.baseAmount * (input.rate > 0 ? input.rate : 0);
  const withMarkup = applyMarkup(raw, input.markupType, input.markupValue);
  const amount = applyRounding(withMarkup, input.rounding, input.decimals);
  const effectiveRate = input.baseAmount > 0 ? amount / input.baseAmount : input.rate;
  return { amount, rawAmount: Number(raw.toFixed(6)), effectiveRate };
}

/** Marj yüzdesi: (fiyat - maliyet) / fiyat. */
export function marginPercent(price: number, cost: number): number | null {
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(cost) || cost <= 0) return null;
  return ((price - cost) / price) * 100;
}

export function changePercent(before: number, after: number): number {
  if (!Number.isFinite(before) || before <= 0) return 0;
  return ((after - before) / before) * 100;
}

export function isRateStale(fetchedAt: string | null | undefined, staleAfterHours: number): boolean {
  if (!fetchedAt) return true;
  const age = Date.now() - new Date(fetchedAt).getTime();
  return age > staleAfterHours * 3_600_000;
}

export type CurrencyFormatOptions = {
  symbol?: string | null;
  symbolPosition?: "before" | "after" | string | null;
  locale?: string;
  decimals?: number;
};

/** Market/para birimi ayarlarına göre biçimlendirme (₺1.000,00 / €1,000.00). */
export function formatMarketPrice(
  amount: number,
  currency: string,
  options: CurrencyFormatOptions = {},
): string {
  const code = currency.toUpperCase();
  const decimals = options.decimals ?? currencyDecimals(code);
  const locale = options.locale ?? (code === "TRY" ? "tr-TR" : "en-US");
  if (!options.symbol) {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  }
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
  return options.symbolPosition === "after" ? `${number} ${options.symbol}` : `${options.symbol}${number}`;
}
