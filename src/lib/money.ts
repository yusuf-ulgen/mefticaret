/**
 * Çoklu para birimi servisi.
 * Finansal ana fiyat (base) ile görüntüleme fiyatı (display) kesin olarak ayrılır:
 * kayıtlar her zaman ana para biriminde tutulur, dönüşüm yalnızca sunum katmanındadır.
 */

export const SUPPORTED_CURRENCIES = ["TRY", "USD", "EUR", "GBP", "AED", "SAR"] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export type CurrencyMeta = {
  code: CurrencyCode;
  label: string;
  symbol: string;
  decimals: number;
};

export const CURRENCY_META: Record<CurrencyCode, CurrencyMeta> = {
  TRY: { code: "TRY", label: "Türk Lirası", symbol: "₺", decimals: 2 },
  USD: { code: "USD", label: "ABD Doları", symbol: "$", decimals: 2 },
  EUR: { code: "EUR", label: "Euro", symbol: "€", decimals: 2 },
  GBP: { code: "GBP", label: "İngiliz Sterlini", symbol: "£", decimals: 2 },
  AED: { code: "AED", label: "BAE Dirhemi", symbol: "د.إ", decimals: 2 },
  SAR: { code: "SAR", label: "Suudi Riyali", symbol: "﷼", decimals: 2 },
};

export const CURRENCY_LIST: CurrencyMeta[] = SUPPORTED_CURRENCIES.map(
  (code) => CURRENCY_META[code],
);

export function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function normalizeCurrency(value: unknown, fallback: CurrencyCode = "TRY"): CurrencyCode {
  const upper = typeof value === "string" ? value.trim().toUpperCase() : "";
  return isCurrency(upper) ? upper : fallback;
}

/** Ana para biriminde tutulan finansal tutar. */
export type BaseMoney = {
  amount: number;
  currency: CurrencyCode;
};

/** Kur ile dönüştürülmüş, yalnızca gösterim amaçlı tutar. */
export type DisplayMoney = {
  amount: number;
  currency: CurrencyCode;
  rate: number;
  base: BaseMoney;
};

export type RateRow = {
  base_currency: string;
  quote_currency: string;
  rate: number | string;
  source?: string | null;
  fetched_at?: string | null;
};

/** store -> kur haritası. `TRY:USD` biçiminde anahtar tutar. */
export type RateTable = Map<string, number>;

export function rateKey(base: string, quote: string): string {
  return `${base.toUpperCase()}:${quote.toUpperCase()}`;
}

export function buildRateTable(rows: RateRow[] | null | undefined): RateTable {
  const table: RateTable = new Map();
  for (const row of rows ?? []) {
    const rate = Number(row.rate);
    if (!Number.isFinite(rate) || rate <= 0) continue;
    table.set(rateKey(row.base_currency, row.quote_currency), rate);
  }
  return table;
}

/** base -> quote kuru; ters kayıt varsa tersini, yoksa çapraz kur dener. */
export function resolveRate(table: RateTable, base: string, quote: string): number | null {
  const from = base.toUpperCase();
  const to = quote.toUpperCase();
  if (from === to) return 1;
  const direct = table.get(rateKey(from, to));
  if (direct) return direct;
  const inverse = table.get(rateKey(to, from));
  if (inverse) return 1 / inverse;
  for (const [key, rate] of table) {
    const [pivotBase, pivotQuote] = key.split(":");
    if (pivotBase !== from) continue;
    const second = table.get(rateKey(pivotQuote!, to));
    if (second) return rate * second;
  }
  return null;
}

export function roundMoney(amount: number, currency: CurrencyCode = "TRY"): number {
  const factor = 10 ** CURRENCY_META[currency].decimals;
  return Math.round(amount * factor) / factor;
}

/**
 * Ana tutarı görüntüleme para birimine çevirir. Kur bulunamazsa ana para biriminde kalır
 * (sessiz yanlış fiyat göstermek yerine dönüşüm yapılmaz).
 */
export function toDisplayMoney(
  base: BaseMoney,
  displayCurrency: CurrencyCode,
  table: RateTable,
): DisplayMoney {
  const rate = resolveRate(table, base.currency, displayCurrency);
  if (rate === null) {
    return { amount: roundMoney(base.amount, base.currency), currency: base.currency, rate: 1, base };
  }
  return {
    amount: roundMoney(base.amount * rate, displayCurrency),
    currency: displayCurrency,
    rate,
    base,
  };
}

export function formatCurrency(
  amount: number,
  currency: CurrencyCode | string = "TRY",
  intlLocale = "tr-TR",
  options?: { maximumFractionDigits?: number },
): string {
  const code = normalizeCurrency(currency);
  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: code,
    maximumFractionDigits: options?.maximumFractionDigits ?? CURRENCY_META[code].decimals,
  }).format(amount);
}

export function formatDisplayMoney(money: DisplayMoney, intlLocale = "tr-TR"): string {
  return formatCurrency(money.amount, money.currency, intlLocale);
}

export function formatRate(rate: number, intlLocale = "tr-TR"): string {
  return new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 6 }).format(rate);
}
