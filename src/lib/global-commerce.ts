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
  { code: "fr", label: "Fransızca" },
  { code: "es", label: "İspanyolca" },
  { code: "it", label: "İtalyanca" },
  { code: "nl", label: "Felemenkçe" },
  { code: "ru", label: "Rusça" },
  { code: "ar", label: "Arapça" },
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

/**
 * Sipariş adreslerinde ülke bazen iki harfli kod ("TR"), bazen tam ad
 * ("Türkiye", "Germany") olarak saklanır. Raporlarda tutarlı olsun diye
 * her iki biçim de ISO kodlarına çevrilir.
 */
const COUNTRY_NAME_ALIASES: Record<string, string> = {
  TURKIYE: "TR",
  TURKEY: "TR",
  GERMANY: "DE",
  DEUTSCHLAND: "DE",
  NETHERLANDS: "NL",
  "UNITED KINGDOM": "GB",
  ENGLAND: "GB",
  "UNITED STATES": "US",
  USA: "US",
  "UNITED ARAB EMIRATES": "AE",
  "SAUDI ARABIA": "SA",
};

export function normalizeCountryCode(value: string | null | undefined, fallback = "TR"): string {
  const raw = (value ?? "").toString().trim();
  if (!raw) return fallback;
  const upper = raw
    .toUpperCase()
    .replace(/İ/g, "I")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ş/g, "S")
    .replace(/Ç/g, "C")
    .replace(/Ğ/g, "G");
  if (upper.length === 2 && GLOBAL_COUNTRIES.some((row) => row.code === upper)) return upper;
  if (COUNTRY_NAME_ALIASES[upper]) return COUNTRY_NAME_ALIASES[upper];
  const byName = GLOBAL_COUNTRIES.find(
    (row) =>
      row.name
        .toUpperCase()
        .replace(/İ/g, "I")
        .replace(/Ü/g, "U")
        .replace(/Ö/g, "O")
        .replace(/Ş/g, "S")
        .replace(/Ç/g, "C")
        .replace(/Ğ/g, "G") === upper,
  );
  if (byName) return byName.code;
  return upper.length === 2 ? upper : fallback;
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

export type GlobalPaymentProvider =
  | "stripe"
  | "paypal"
  | "checkout_com"
  | "adyen"
  | "klarna"
  | "alma"
  | "clearpay"
  | "sezzle"
  | "sepa"
  | "sofort"
  | "ideal"
  | "bancontact"
  | "giropay";


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
  {
    provider: "checkout_com",
    label: "Checkout.com",
    description: "Kurumsal hacimler için global kart tahsilatı ve yerel yöntemler.",
    currencies: ["USD", "EUR", "GBP", "AED", "SAR"],
    countries: ["US", "GB", "DE", "FR", "NL", "AE", "SA"],
    secretNames: ["CHECKOUT_COM_SECRET_KEY", "CHECKOUT_COM_PUBLIC_KEY"],
  },
  {
    provider: "adyen",
    label: "Adyen",
    description: "Tek entegrasyonla kart + onlarca yerel ödeme yöntemi.",
    currencies: ["USD", "EUR", "GBP", "CAD", "AED"],
    countries: ["US", "GB", "DE", "FR", "NL", "BE", "IT", "ES", "CA", "AE"],
    secretNames: ["ADYEN_API_KEY", "ADYEN_MERCHANT_ACCOUNT", "ADYEN_HMAC_KEY"],
  },
  {
    provider: "alma",
    label: "Alma (BNPL — Fransa)",
    description: "Fransa'da 2–4 taksitle şimdi al sonra öde.",
    currencies: ["EUR"],
    countries: ["FR", "BE", "IT", "ES"],
    secretNames: ["ALMA_API_KEY"],
  },
  {
    provider: "clearpay",
    label: "Clearpay (BNPL — UK)",
    description: "Birleşik Krallık'ta 4 taksitte faizsiz ödeme.",
    currencies: ["GBP"],
    countries: ["GB"],
    secretNames: ["CLEARPAY_MERCHANT_ID", "CLEARPAY_SECRET_KEY"],
  },
  {
    provider: "sezzle",
    label: "Sezzle (BNPL — ABD/Kanada)",
    description: "ABD ve Kanada'da 4 taksitle şimdi al sonra öde.",
    currencies: ["USD", "CAD"],
    countries: ["US", "CA"],
    secretNames: ["SEZZLE_PUBLIC_KEY", "SEZZLE_PRIVATE_KEY"],
  },
  {
    provider: "ideal",
    label: "iDEAL (Hollanda)",
    description: "Hollanda'da banka hesabından anında ödeme.",
    currencies: ["EUR"],
    countries: ["NL"],
    secretNames: ["STRIPE_SECRET_KEY"],
  },
  {
    provider: "bancontact",
    label: "Bancontact (Belçika)",
    description: "Belçika'nın en yaygın yerel kart/banka ödeme yöntemi.",
    currencies: ["EUR"],
    countries: ["BE"],
    secretNames: ["STRIPE_SECRET_KEY"],
  },
  {
    provider: "giropay",
    label: "Giropay (Almanya)",
    description: "Almanya'da online banka havalesi ile ödeme.",
    currencies: ["EUR"],
    countries: ["DE"],
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
  | "aramex"
  | "kargomkolay"
  | "royalmail";


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
  {
    code: "kargomkolay",
    label: "KargomKolay",
    description: "Mikro ihracatta çoklu taşıyıcı fiyatlandırma ve ETGB desteği.",
    microExport: true,
    trackingUrl: (t) => `https://kargomkolay.com/kargo-takip?code=${t}`,
    secretNames: ["KARGOMKOLAY_API_KEY"],
  },
  {
    code: "royalmail",
    label: "Royal Mail",
    description: "Birleşik Krallık içi ve UK'ye yerel teslimat.",
    microExport: false,
    trackingUrl: (t) => `https://www.royalmail.com/track-your-item#/tracking-results/${t}`,
    secretNames: ["ROYALMAIL_CLIENT_ID", "ROYALMAIL_CLIENT_SECRET"],
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

/* ============================ Psikolojik fiyat yuvarlama ============================ */

export type PriceRoundingRule = "none" | "end_99" | "end_90" | "nearest_integer" | "nearest_5";

export const PRICE_ROUNDING_RULES: { rule: PriceRoundingRule; label: string; example: string }[] = [
  { rule: "none", label: "Yuvarlama yok", example: "34,12 → 34,12" },
  { rule: "end_99", label: "Küsuratı .99 yap", example: "34,12 → 34,99" },
  { rule: "end_90", label: "Küsuratı .90 yap", example: "34,12 → 34,90" },
  { rule: "nearest_integer", label: "En yakın tam sayı", example: "34,12 → 34" },
  { rule: "nearest_5", label: "En yakın 5'e yuvarla", example: "34,12 → 35" },
];

/** Döviz çevriminden çıkan fiyatı mağazanın seçtiği psikolojik kurala göre yuvarlar. */
export function applyPriceRounding(amount: number, rule: PriceRoundingRule | null | undefined): number {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return 0;
  switch (rule) {
    case "end_99":
      return Math.max(Math.floor(value), 0) + 0.99;
    case "end_90":
      return Math.max(Math.floor(value), 0) + 0.9;
    case "nearest_integer":
      return Math.round(value);
    case "nearest_5":
      return Math.max(Math.round(value / 5) * 5, 5);
    default:
      return round2(value);
  }
}

/* ============================ Bölgesel katalog görünürlüğü ============================ */

export type CountryVisibilityMode = "all" | "allow" | "block";

/**
 * Ürünün ziyaretçi ülkesinde gösterilip gösterilmeyeceğini belirler.
 * `allow` → yalnız listelenen ülkeler; `block` → listelenen ülkeler hariç.
 */
export function isProductVisibleInCountry(input: {
  mode: CountryVisibilityMode | null | undefined;
  countries: string[] | null | undefined;
  country: string | null | undefined;
}): boolean {
  const mode = input.mode ?? "all";
  if (mode === "all") return true;
  const list = (input.countries ?? []).map((row) => row.trim().toUpperCase()).filter(Boolean);
  if (list.length === 0) return mode === "block";
  const country = input.country?.trim().toUpperCase();
  if (!country) return mode === "block";
  return mode === "allow" ? list.includes(country) : !list.includes(country);
}

/* ============================ ABD posta kodu → eyalet ============================ */

/** ZIP kodu ilk 3 hane aralıkları → eyalet (USPS aralıkları). */
const ZIP_STATE_RANGES: { from: number; to: number; state: string }[] = [
  { from: 5, to: 5, state: "NY" }, { from: 6, to: 9, state: "PR" },
  { from: 10, to: 27, state: "MA" }, { from: 28, to: 29, state: "RI" },
  { from: 30, to: 38, state: "NH" }, { from: 39, to: 49, state: "ME" },
  { from: 50, to: 59, state: "VT" }, { from: 60, to: 69, state: "CT" },
  { from: 70, to: 89, state: "NJ" }, { from: 90, to: 98, state: "AE" },
  { from: 100, to: 149, state: "NY" }, { from: 150, to: 196, state: "PA" },
  { from: 197, to: 199, state: "DE" }, { from: 200, to: 205, state: "DC" },
  { from: 206, to: 219, state: "MD" }, { from: 220, to: 246, state: "VA" },
  { from: 247, to: 268, state: "WV" }, { from: 270, to: 289, state: "NC" },
  { from: 290, to: 299, state: "SC" }, { from: 300, to: 319, state: "GA" },
  { from: 320, to: 349, state: "FL" }, { from: 350, to: 369, state: "AL" },
  { from: 370, to: 385, state: "TN" }, { from: 386, to: 397, state: "MS" },
  { from: 398, to: 399, state: "GA" }, { from: 400, to: 427, state: "KY" },
  { from: 430, to: 458, state: "OH" }, { from: 460, to: 479, state: "IN" },
  { from: 480, to: 499, state: "MI" }, { from: 500, to: 528, state: "IA" },
  { from: 530, to: 549, state: "WI" }, { from: 550, to: 567, state: "MN" },
  { from: 570, to: 577, state: "SD" }, { from: 580, to: 588, state: "ND" },
  { from: 590, to: 599, state: "MT" }, { from: 600, to: 629, state: "IL" },
  { from: 630, to: 658, state: "MO" }, { from: 660, to: 679, state: "KS" },
  { from: 680, to: 693, state: "NE" }, { from: 700, to: 714, state: "LA" },
  { from: 716, to: 729, state: "AR" }, { from: 730, to: 749, state: "OK" },
  { from: 750, to: 799, state: "TX" }, { from: 800, to: 816, state: "CO" },
  { from: 820, to: 831, state: "WY" }, { from: 832, to: 838, state: "ID" },
  { from: 840, to: 847, state: "UT" }, { from: 850, to: 865, state: "AZ" },
  { from: 870, to: 884, state: "NM" }, { from: 889, to: 898, state: "NV" },
  { from: 900, to: 961, state: "CA" }, { from: 967, to: 968, state: "HI" },
  { from: 970, to: 979, state: "OR" }, { from: 980, to: 994, state: "WA" },
  { from: 995, to: 999, state: "AK" },
];

/** "90210" → "CA". Geçersiz kodda null döner. */
export function usStateFromZip(zip: string | null | undefined): string | null {
  const digits = (zip ?? "").replace(/\D/g, "");
  if (digits.length < 3) return null;
  const prefix = Number(digits.slice(0, 3));
  const match = ZIP_STATE_RANGES.find((row) => prefix >= row.from && prefix <= row.to);
  return match?.state ?? null;
}

/* ============================ Körfez (GCC) KDV oranları ============================ */

/** Resmî standart KDV oranları (GCC birleşik KDV anlaşması uygulamaları). */
export const GCC_VAT_RATES: Record<string, number> = {
  AE: 5,
  SA: 15,
  BH: 10,
  OM: 5,
  QA: 0,
  KW: 0,
};

export function resolveGccVat(country: string | null | undefined): {
  applies: boolean;
  ratePercent: number;
  note: string;
} {
  const code = country?.trim().toUpperCase();
  if (!code || !(code in GCC_VAT_RATES)) {
    return { applies: false, ratePercent: 0, note: "Körfez ülkesi değil" };
  }
  const rate = GCC_VAT_RATES[code]!;
  if (rate === 0) {
    return { applies: false, ratePercent: 0, note: `${code}: KDV uygulanmıyor (%0)` };
  }
  return { applies: true, ratePercent: rate, note: `${code} ithalat KDV oranı %${rate}` };
}

/* ============================ Çoklu depo / fulfillment ============================ */

export type FulfillmentProvider = "own" | "amazon_fba" | "shipbob" | "third_party";

export const FULFILLMENT_PROVIDER_CATALOG: {
  provider: FulfillmentProvider;
  label: string;
  description: string;
  secretNames: string[];
}[] = [
  {
    provider: "own",
    label: "Kendi deposu (Türkiye)",
    description: "Mikro ihracat: gönderi Türkiye'deki kendi deponuzdan çıkar.",
    secretNames: [],
  },
  {
    provider: "amazon_fba",
    label: "Amazon FBA",
    description: "Amazon deposundan yurt dışında yerel teslimat (local-to-local).",
    secretNames: ["AMAZON_SP_API_CLIENT_ID", "AMAZON_SP_API_CLIENT_SECRET", "AMAZON_SP_API_REFRESH_TOKEN"],
  },
  {
    provider: "shipbob",
    label: "ShipBob",
    description: "ABD/AB 3PL depolarından yerel gönderi.",
    secretNames: ["SHIPBOB_API_TOKEN"],
  },
  {
    provider: "third_party",
    label: "Diğer 3PL deposu",
    description: "Avrupa veya ABD'deki anlaşmalı 3PL deposu.",
    secretNames: [],
  },
];

/**
 * Siparişi hangi depodan karşılamak gerektiğini seçer.
 * Öncelik: alıcı ülkesiyle aynı ülkedeki stoklu depo → aynı bölge → en yüksek öncelikli stoklu depo.
 */
export function routeFulfillment(input: {
  country: string | null | undefined;
  quantity: number;
  warehouses: {
    id: string;
    country_code: string;
    priority?: number | null;
    is_active?: boolean | null;
    available?: number | null;
  }[];
}): { warehouseId: string | null; reason: string } {
  const qty = Math.max(Number(input.quantity) || 1, 1);
  const country = input.country?.trim().toUpperCase() ?? null;
  const usable = (input.warehouses ?? [])
    .filter((w) => w.is_active !== false && (w.available ?? 0) >= qty)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  if (usable.length === 0) return { warehouseId: null, reason: "Stoklu depo bulunamadı" };

  const local = usable.find((w) => w.country_code.toUpperCase() === country);
  if (local) return { warehouseId: local.id, reason: "Alıcı ülkesindeki depodan yerel teslimat" };

  const buyerRegion = findCountry(country)?.region ?? null;
  const regional = usable.find((w) => findCountry(w.country_code)?.region === buyerRegion);
  if (buyerRegion && regional) {
    return { warehouseId: regional.id, reason: "Aynı bölgedeki depodan gönderi" };
  }
  return { warehouseId: usable[0]!.id, reason: "Öncelikli depodan mikro ihracat" };
}

/* ============================ Döviz bazlı net kârlılık ============================ */

export type NetProfitReport = {
  revenue: number;
  cogs: number;
  shipping: number;
  duty: number;
  paymentFee: number;
  netProfit: number;
  marginPercent: number;
  netProfitTry: number;
};

/** Döviz cinsinden ciro üzerinden net kâr; TL karşılığı verilen kurla hesaplanır. */
export function calculateNetProfit(input: {
  revenue: number;
  cogs: number;
  shippingCost?: number;
  dutyCost?: number;
  paymentFeePercent?: number;
  currencyToTryRate?: number;
}): NetProfitReport {
  const revenue = Math.max(Number(input.revenue) || 0, 0);
  const cogs = Math.max(Number(input.cogs) || 0, 0);
  const shipping = Math.max(Number(input.shippingCost) || 0, 0);
  const duty = Math.max(Number(input.dutyCost) || 0, 0);
  const feePercent = Math.min(Math.max(Number(input.paymentFeePercent) || 0, 0), 25);
  const paymentFee = round2(revenue * (feePercent / 100));
  const netProfit = round2(revenue - cogs - shipping - duty - paymentFee);
  const rate = Number(input.currencyToTryRate);
  return {
    revenue: round2(revenue),
    cogs: round2(cogs),
    shipping: round2(shipping),
    duty: round2(duty),
    paymentFee,
    netProfit,
    marginPercent: revenue > 0 ? round2((netProfit / revenue) * 100) : 0,
    netProfitTry: Number.isFinite(rate) && rate > 0 ? round2(netProfit * rate) : netProfit,
  };
}
