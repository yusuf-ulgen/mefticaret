/**
 * Global & E-İhracat motoru — saf hesaplama katmanı (DB/UI bilmez, test edilebilir).
 * Ülke algılama eşlemeleri, kur risk marjı, ülke bazlı fiyat çözümü,
 * AB (OSS/IOSS) ve ABD eyalet vergisi ile DDP/DDU teslim maliyeti burada hesaplanır.
 */

export type Incoterm = "DDP" | "DDU";

export const INCOTERM_LABELS: Record<Incoterm, string> = {
  DDP: "DDP — vergiler satıcı tarafından ödenmiş",
  DDU: "DDU — vergiler alıcı tarafından ödenir",
};

export type GlobalCountry = {
  code: string;
  name: string;
  currency: string;
  locale: string;
  region: "TR" | "EU" | "US" | "GCC" | "UK" | "CA" | "OTHER";
};

/** Modülün desteklediği hedef pazarlar (dil + para birimi eşlemesiyle). */
export const GLOBAL_COUNTRIES: GlobalCountry[] = [
  { code: "TR", name: "Türkiye", currency: "TRY", locale: "tr", region: "TR" },
  { code: "DE", name: "Almanya", currency: "EUR", locale: "de", region: "EU" },
  { code: "FR", name: "Fransa", currency: "EUR", locale: "fr", region: "EU" },
  { code: "NL", name: "Hollanda", currency: "EUR", locale: "nl", region: "EU" },
  { code: "AT", name: "Avusturya", currency: "EUR", locale: "de", region: "EU" },
  { code: "BE", name: "Belçika", currency: "EUR", locale: "fr", region: "EU" },
  { code: "IT", name: "İtalya", currency: "EUR", locale: "it", region: "EU" },
  { code: "ES", name: "İspanya", currency: "EUR", locale: "es", region: "EU" },
  { code: "GB", name: "Birleşik Krallık", currency: "GBP", locale: "en", region: "UK" },
  { code: "US", name: "Amerika Birleşik Devletleri", currency: "USD", locale: "en", region: "US" },
  { code: "CA", name: "Kanada", currency: "CAD", locale: "en", region: "CA" },
  { code: "AE", name: "Birleşik Arap Emirlikleri", currency: "AED", locale: "ar", region: "GCC" },
  { code: "SA", name: "Suudi Arabistan", currency: "SAR", locale: "ar", region: "GCC" },
  { code: "QA", name: "Katar", currency: "USD", locale: "ar", region: "GCC" },
  { code: "RU", name: "Rusya", currency: "USD", locale: "ru", region: "OTHER" },
];

export const GLOBAL_CURRENCIES = ["TRY", "USD", "EUR", "GBP", "AED", "SAR", "CAD"] as const;

export const EXPORT_LOCALES = [
  { code: "en", label: "İngilizce" },
  { code: "de", label: "Almanca" },
  { code: "ar", label: "Arapça" },
  { code: "fr", label: "Fransızca" },
  { code: "ru", label: "Rusça" },
] as const;

export const RTL_LOCALES = ["ar", "he", "fa", "ur"];

export function isRtlLocale(locale: string | null | undefined): boolean {
  if (!locale) return false;
  return RTL_LOCALES.includes(locale.toLowerCase().split("-")[0] ?? "");
}

export function findCountry(code: string | null | undefined): GlobalCountry | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  return GLOBAL_COUNTRIES.find((row) => row.code === upper) ?? null;
}

/** Ziyaretçi ülkesinden pazar tercihleri (dil + para birimi). Bilinmeyen ülke varsayılana düşer. */
export function localizeForCountry(
  countryCode: string | null | undefined,
  fallback: { currency: string; locale: string } = { currency: "USD", locale: "en" },
): { country: string | null; currency: string; locale: string; rtl: boolean } {
  const match = findCountry(countryCode);
  const currency = match?.currency ?? fallback.currency;
  const locale = match?.locale ?? fallback.locale;
  return { country: match?.code ?? null, currency, locale, rtl: isRtlLocale(locale) };
}

/* ============================ Kur risk marjı ============================ */

/**
 * Canlı kura koruma marjı ekler (döviz dalgalanma riski).
 * `bufferPercent` %0–25 arasına kırpılır; sonuç her zaman pozitiftir.
 */
export function bufferedRate(rate: number, bufferPercent: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  const buffer = Math.min(Math.max(Number(bufferPercent) || 0, 0), 25);
  return rate * (1 + buffer / 100);
}

export type CountryPriceRow = {
  country_code: string;
  currency: string;
  price: number | string;
  is_active?: boolean;
};

export type ResolvedPrice = {
  amount: number;
  currency: string;
  source: "country_price" | "fx" | "base";
  /** Kullanılan kur (marj dahil). Ülke fiyatı veya temel para biriminde 1. */
  rate: number;
  bufferPercent: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Bir ürünün ziyaretçi ülkesinde gösterilecek fiyatını çözer.
 * Öncelik: ülkeye özel sabit fiyat → kur (+ risk marjı) → temel fiyat.
 */
export function resolveDisplayPrice(input: {
  basePrice: number;
  baseCurrency: string;
  country: string | null | undefined;
  targetCurrency?: string | null;
  /** base → quote kurları, `USD` gibi büyük harf anahtarlar. */
  rates: Record<string, number>;
  bufferPercent?: number;
  countryPrices?: CountryPriceRow[];
}): ResolvedPrice {
  const buffer = Math.min(Math.max(Number(input.bufferPercent) || 0, 0), 25);
  const base = Number(input.basePrice) || 0;
  const baseCurrency = (input.baseCurrency || "TRY").toUpperCase();
  const countryCode = input.country?.toUpperCase() ?? null;

  const fixed = (input.countryPrices ?? []).find(
    (row) => row.country_code.toUpperCase() === countryCode && row.is_active !== false,
  );
  if (fixed) {
    return {
      amount: round2(Number(fixed.price) || 0),
      currency: fixed.currency.toUpperCase(),
      source: "country_price",
      rate: 1,
      bufferPercent: 0,
    };
  }

  const target = (
    input.targetCurrency ?? findCountry(countryCode)?.currency ?? baseCurrency
  ).toUpperCase();
  if (target === baseCurrency) {
    return { amount: round2(base), currency: baseCurrency, source: "base", rate: 1, bufferPercent: 0 };
  }

  const raw = Number(input.rates[target] ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) {
    return { amount: round2(base), currency: baseCurrency, source: "base", rate: 1, bufferPercent: 0 };
  }
  const rate = bufferedRate(raw, buffer);
  return {
    amount: round2(base * rate),
    currency: target,
    source: "fx",
    rate,
    bufferPercent: buffer,
  };
}

/* ============================ AB KDV (OSS / IOSS) ============================ */

export const EU_COUNTRY_CODES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
];

export function isEuCountry(code: string | null | undefined): boolean {
  return Boolean(code) && EU_COUNTRY_CODES.includes(code!.trim().toUpperCase());
}

/** IOSS eşiği: sevkiyat başına 150 EUR mal değeri. */
export const IOSS_THRESHOLD_EUR = 150;

export type EuVatScheme = "IOSS" | "OSS" | "import_vat_at_border" | "reverse_charge" | "none";

export type EuVatDecision = {
  scheme: EuVatScheme;
  ratePercent: number;
  /** KDV kasada tahsil edilir mi? */
  collectAtCheckout: boolean;
  note: string;
};

/**
 * AB'ye satışta hangi KDV rejiminin uygulanacağını belirler.
 * - B2B ve geçerli vergi numarası → ters yükleme (0 KDV)
 * - 150 EUR altı ve IOSS açık → IOSS ile kasada KDV
 * - 150 EUR üstü → ithalat KDV'si gümrükte
 * - AB içi depodan satış (OSS açık) → alıcı ülkesinin oranı kasada
 */
export function resolveEuVat(input: {
  country: string | null | undefined;
  vatRatePercent: number;
  consignmentValueEur: number;
  buyerVatId?: string | null;
  iossEnabled?: boolean;
  ossEnabled?: boolean;
}): EuVatDecision {
  if (!isEuCountry(input.country)) {
    return { scheme: "none", ratePercent: 0, collectAtCheckout: false, note: "AB dışı satış" };
  }
  const rate = Math.max(Number(input.vatRatePercent) || 0, 0);
  const vatId = input.buyerVatId?.trim();
  if (vatId && vatId.length >= 8) {
    return {
      scheme: "reverse_charge",
      ratePercent: 0,
      collectAtCheckout: false,
      note: `B2B ters yükleme — alıcı KDV no: ${vatId.toUpperCase()}`,
    };
  }
  if (input.ossEnabled) {
    return {
      scheme: "OSS",
      ratePercent: rate,
      collectAtCheckout: true,
      note: "AB içi OSS beyanı: alıcı ülkesinin KDV oranı kasada tahsil edilir",
    };
  }
  if (Number(input.consignmentValueEur) <= IOSS_THRESHOLD_EUR) {
    if (input.iossEnabled) {
      return {
        scheme: "IOSS",
        ratePercent: rate,
        collectAtCheckout: true,
        note: "150 EUR altı sevkiyat: IOSS ile KDV kasada tahsil edilir, gümrükte ek KDV yoktur",
      };
    }
    return {
      scheme: "import_vat_at_border",
      ratePercent: rate,
      collectAtCheckout: false,
      note: "IOSS kapalı: KDV gümrükte alıcıdan tahsil edilir",
    };
  }
  return {
    scheme: "import_vat_at_border",
    ratePercent: rate,
    collectAtCheckout: false,
    note: "150 EUR üstü sevkiyat: ithalat KDV'si ve gümrük vergisi gümrükte doğar",
  };
}

/* ============================ ABD eyalet satış vergisi ============================ */

export type UsSalesTaxDecision = {
  applies: boolean;
  ratePercent: number;
  note: string;
};

/** ABD'de satış vergisi yalnızca mağazanın vergi yükümlülüğü (nexus) olan eyaletlerde hesaplanır. */
export function resolveUsSalesTax(input: {
  state: string | null | undefined;
  ratePercent: number;
  nexusStates: string[];
}): UsSalesTaxDecision {
  const state = input.state?.trim().toUpperCase();
  if (!state) return { applies: false, ratePercent: 0, note: "Eyalet seçilmedi" };
  const nexus = (input.nexusStates ?? []).map((row) => row.trim().toUpperCase());
  if (!nexus.includes(state)) {
    return {
      applies: false,
      ratePercent: 0,
      note: `${state} eyaletinde vergi yükümlülüğü (nexus) tanımlı değil — satış vergisi hesaplanmaz`,
    };
  }
  const rate = Math.max(Number(input.ratePercent) || 0, 0);
  return { applies: true, ratePercent: rate, note: `${state} eyalet satış vergisi %${rate}` };
}

/* ============================ Teslim maliyeti (DDP / DDU) ============================ */

export type LandedCost = {
  goods: number;
  shipping: number;
  duty: number;
  tax: number;
  total: number;
  /** Kasada tahsil edilen tutar. */
  collectedAtCheckout: number;
  /** Alıcının teslimde ödeyeceği tutar. */
  payableOnDelivery: number;
  incoterm: Incoterm;
  notes: string[];
};

/**
 * Gümrük + vergi dahil toplam teslim maliyetini hesaplar.
 * DDP'de gümrük vergisi ve KDV kasada tahsil edilir; DDU'da alıcı teslimde öder.
 */
export function calculateLandedCost(input: {
  goodsValue: number;
  shippingCost: number;
  dutyRatePercent: number;
  taxRatePercent: number;
  incoterm: Incoterm;
  /** Vergi kasada tahsil ediliyorsa (IOSS/OSS gibi) DDU'da bile kasada toplanır. */
  taxCollectedAtCheckout?: boolean;
  notes?: string[];
}): LandedCost {
  const goods = Math.max(Number(input.goodsValue) || 0, 0);
  const shipping = Math.max(Number(input.shippingCost) || 0, 0);
  const dutyRate = Math.max(Number(input.dutyRatePercent) || 0, 0) / 100;
  const taxRate = Math.max(Number(input.taxRatePercent) || 0, 0) / 100;

  const duty = round2((goods + shipping) * dutyRate);
  const tax = round2((goods + shipping + duty) * taxRate);
  const total = round2(goods + shipping + duty + tax);

  const ddp = input.incoterm === "DDP";
  const taxAtCheckout = ddp || Boolean(input.taxCollectedAtCheckout);
  const collectedAtCheckout = round2(goods + shipping + (ddp ? duty : 0) + (taxAtCheckout ? tax : 0));
  const payableOnDelivery = round2(total - collectedAtCheckout);

  return {
    goods: round2(goods),
    shipping: round2(shipping),
    duty,
    tax,
    total,
    collectedAtCheckout,
    payableOnDelivery,
    incoterm: input.incoterm,
    notes: input.notes ?? [],
  };
}

/* ============================ Sağlayıcı katalogları ============================ */

export type GlobalPaymentProvider = "stripe" | "paypal" | "klarna" | "sepa" | "sofort";

export const PAYMENT_PROVIDER_CATALOG: {
  provider: GlobalPaymentProvider;
  label: string;
  description: string;
  currencies: string[];
  countries: string[];
  secretNames: string[];
}[] = [
  {
    provider: "stripe",
    label: "Stripe (Kart, Apple Pay, Google Pay)",
    description: "Kart, Apple Pay ve Google Pay ile 40+ ülkeden tahsilat.",
    currencies: ["USD", "EUR", "GBP", "CAD", "AED"],
    countries: ["US", "GB", "DE", "FR", "NL", "CA", "AE"],
    secretNames: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  },
  {
    provider: "paypal",
    label: "PayPal",
    description: "PayPal bakiyesi ve kart ile global tahsilat.",
    currencies: ["USD", "EUR", "GBP", "CAD"],
    countries: ["US", "GB", "DE", "FR", "NL", "CA"],
    secretNames: ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET"],
  },
  {
    provider: "klarna",
    label: "Klarna (Şimdi al, sonra öde)",
    description: "Almanya, Hollanda ve İskandinavya'da taksitli / sonra öde.",
    currencies: ["EUR", "GBP"],
    countries: ["DE", "AT", "NL", "GB", "SE"],
    secretNames: ["KLARNA_API_USERNAME", "KLARNA_API_PASSWORD"],
  },
  {
    provider: "sepa",
    label: "SEPA Havale",
    description: "Avro bölgesinde banka havalesi ile ödeme.",
    currencies: ["EUR"],
    countries: ["DE", "FR", "NL", "AT", "BE", "IT", "ES"],
    secretNames: ["STRIPE_SECRET_KEY"],
  },
  {
    provider: "sofort",
    label: "Sofort",
    description: "Almanya ve Avusturya'da anında banka ödemesi.",
    currencies: ["EUR"],
    countries: ["DE", "AT"],
    secretNames: ["STRIPE_SECRET_KEY"],
  },
];

export type GlobalCarrierCode =
  | "dhl"
  | "fedex"
  | "ups"
  | "ptt"
  | "navlungo"
  | "shipentegra"
  | "aramex";

export const CARRIER_CATALOG: {
  code: GlobalCarrierCode;
  label: string;
  description: string;
  microExport: boolean;
  trackingUrl: (tracking: string) => string;
  secretNames: string[];
}[] = [
  {
    code: "dhl",
    label: "DHL Express",
    description: "Hızlı kapıdan kapıya ihracat; ETGB'li mikro ihracat desteği.",
    microExport: true,
    trackingUrl: (t) => `https://www.dhl.com/tr-en/home/tracking.html?tracking-id=${t}`,
    secretNames: ["DHL_API_KEY", "DHL_API_SECRET", "DHL_ACCOUNT_NUMBER"],
  },
  {
    code: "fedex",
    label: "FedEx",
    description: "Uluslararası ekspres gönderi ve ticari fatura entegrasyonu.",
    microExport: true,
    trackingUrl: (t) => `https://www.fedex.com/fedextrack/?trknbr=${t}`,
    secretNames: ["FEDEX_CLIENT_ID", "FEDEX_CLIENT_SECRET", "FEDEX_ACCOUNT_NUMBER"],
  },
  {
    code: "ups",
    label: "UPS",
    description: "Global ekspres ve ekonomik ihracat servisleri.",
    microExport: true,
    trackingUrl: (t) => `https://www.ups.com/track?tracknum=${t}`,
    secretNames: ["UPS_CLIENT_ID", "UPS_CLIENT_SECRET", "UPS_ACCOUNT_NUMBER"],
  },
  {
    code: "ptt",
    label: "PTT Kargo (Yurt dışı)",
    description: "PTT ile ekonomik mikro ihracat gönderileri.",
    microExport: true,
    trackingUrl: (t) => `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${t}`,
    secretNames: ["PTT_API_KEY", "PTT_API_SECRET"],
  },
  {
    code: "navlungo",
    label: "Navlungo",
    description: "Çoklu taşıyıcı fiyat karşılaştırma ve mikro ihracat operasyonu.",
    microExport: true,
    trackingUrl: (t) => `https://app.navlungo.com/tracking/${t}`,
    secretNames: ["NAVLUNGO_API_KEY"],
  },
  {
    code: "shipentegra",
    label: "ShipEntegra",
    description: "ABD ve Avrupa'ya e-ihracat, iade adresi ve ETGB desteği.",
    microExport: true,
    trackingUrl: (t) => `https://www.shipentegra.com/tr/kargo-takip?code=${t}`,
    secretNames: ["SHIPENTEGRA_API_KEY", "SHIPENTEGRA_API_SECRET"],
  },
  {
    code: "aramex",
    label: "Aramex",
    description: "Orta Doğu ve Körfez ülkelerine güçlü dağıtım ağı.",
    microExport: true,
    trackingUrl: (t) => `https://www.aramex.com/tr/tr/track/results?ShipmentNumber=${t}`,
    secretNames: ["ARAMEX_USERNAME", "ARAMEX_PASSWORD", "ARAMEX_ACCOUNT_NUMBER"],
  },
];

export function carrierMeta(code: string) {
  return CARRIER_CATALOG.find((row) => row.code === code) ?? null;
}

export function paymentProviderMeta(provider: string) {
  return PAYMENT_PROVIDER_CATALOG.find((row) => row.provider === provider) ?? null;
}

export const EXPORT_DOC_LABELS: Record<string, string> = {
  commercial_invoice: "Ticari Fatura (Commercial Invoice)",
  packing_list: "Paket Listesi (Packing List)",
  etgb: "ETGB Beyan Bilgileri",
};

/** Belge numarası: MEF-YYYYMMDD-XXXX */
export function exportDocumentNumber(prefix: string, sequence: number, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${stamp}-${String(sequence).padStart(4, "0")}`;
}
