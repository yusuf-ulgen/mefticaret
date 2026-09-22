/**
 * Besleme para birimi ayarları (tarayıcı ve sunucuda kullanılabilir).
 * Otomatik çevirim açıkken fiyat alanlarına `currency` dönüşüm kuralı eklenir.
 */

import { type TransformRules, type TransformStep } from "@/lib/xml-transforms";

export const SUPPORTED_FEED_CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;
export type FeedCurrency = (typeof SUPPORTED_FEED_CURRENCIES)[number];

/** Çevirim uygulanacak fiyat alanları. */
export const PRICE_FIELD_KEYS = ["price", "compare_at_price", "cost_price"] as const;

export type CurrencyConfig = {
  sourceCurrency: FeedCurrency;
  targetCurrency: FeedCurrency;
  autoConvert: boolean;
  /** "auto" = TCMB kuru, "manual" = elle girilen kur. */
  exchangeRateType: "auto" | "manual";
  manualRate: number;
  profitMarginPercent: number;
};

export const DEFAULT_CURRENCY_CONFIG: CurrencyConfig = {
  sourceCurrency: "TRY",
  targetCurrency: "TRY",
  autoConvert: false,
  exchangeRateType: "auto",
  manualRate: 1,
  profitMarginPercent: 0,
};

const asCurrency = (value: unknown, fallback: FeedCurrency): FeedCurrency => {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return (SUPPORTED_FEED_CURRENCIES as readonly string[]).includes(code) ? (code as FeedCurrency) : fallback;
};

const asNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** Veritabanındaki `currency_config` JSON'unu güvenli biçimde okur. */
export function parseCurrencyConfig(raw: unknown): CurrencyConfig {
  const source = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const rateType = source["exchange_rate_type"] === "manual" ? "manual" : "auto";
  return {
    sourceCurrency: asCurrency(source["source_currency"], "TRY"),
    targetCurrency: asCurrency(source["target_currency"], "TRY"),
    autoConvert: source["auto_convert"] === true,
    exchangeRateType: rateType,
    manualRate: Math.max(0, asNumber(source["manual_rate"], 1)),
    profitMarginPercent: Math.min(900, Math.max(-90, asNumber(source["profit_margin_percent"], 0))),
  };
}

/** `CurrencyConfig` nesnesini veritabanı JSON biçimine çevirir. */
export function serializeCurrencyConfig(config: CurrencyConfig): Record<string, unknown> {
  return {
    source_currency: config.sourceCurrency,
    target_currency: config.targetCurrency,
    auto_convert: config.autoConvert,
    exchange_rate_type: config.exchangeRateType,
    manual_rate: config.manualRate,
    profit_margin_percent: config.profitMarginPercent,
  };
}

export type RateRow = { code: string; rate: number; updatedAt: string | null };

/** Bir para biriminin TL karşılığı; TRY için 1. */
export function rateToTry(code: string, rates: RateRow[]): number {
  if (code === "TRY") return 1;
  const found = rates.find((item) => item.code === code);
  return found && found.rate > 0 ? found.rate : 0;
}

/**
 * Kaynak → hedef para birimi için etkin çarpan. Elle kur seçiliyse o kullanılır,
 * kur bulunamazsa 0 döner (çevirim uygulanmaz).
 */
export function effectiveRate(config: CurrencyConfig, rates: RateRow[]): number {
  if (!config.autoConvert) return 1;
  if (config.sourceCurrency === config.targetCurrency) return 1;
  if (config.exchangeRateType === "manual") return config.manualRate > 0 ? config.manualRate : 0;
  const from = rateToTry(config.sourceCurrency, rates);
  const to = rateToTry(config.targetCurrency, rates);
  if (from <= 0 || to <= 0) return 0;
  return from / to;
}

/** Kâr marjı dahil, fiyat alanına uygulanacak nihai çarpan. */
export function totalMultiplier(config: CurrencyConfig, rates: RateRow[]): number {
  const rate = effectiveRate(config, rates);
  if (rate <= 0) return 0;
  return rate * (1 + config.profitMarginPercent / 100);
}

/**
 * Eşlenen fiyat alanlarına `currency(rate)` kuralını ekler/güncellenir;
 * çevirim kapalıysa daha önce eklenen kural kaldırılır.
 */
export function syncCurrencyTransforms(
  transforms: TransformRules,
  mapping: Record<string, string>,
  config: CurrencyConfig,
  rates: RateRow[],
): TransformRules {
  const next: TransformRules = { ...transforms };
  const multiplier = totalMultiplier(config, rates);
  const enabled = config.autoConvert && multiplier > 0 && multiplier !== 1;

  for (const key of PRICE_FIELD_KEYS) {
    const steps = (next[key] ?? []).filter((step) => step.kind !== "currency");
    if (enabled && mapping[key]) {
      const step: TransformStep = {
        kind: "currency",
        options: { rate: Number(multiplier.toFixed(6)), decimals: 2 },
      };
      next[key] = [...steps, step];
    } else if (steps.length) {
      next[key] = steps;
    } else {
      delete next[key];
    }
  }
  return next;
}
