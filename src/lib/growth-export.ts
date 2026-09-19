/**
 * Advanced E-İhracat Growth & Logistics motoru — saf hesaplama katmanı.
 * Affiliate komisyonu, tatil kampanya takvimi, saat dilimine duyarlı bildirim
 * zamanı, depo yönlendirme, taşıyıcı karşılaştırma, beden/ölçü çevirisi ve
 * toptan (B2B) kademeli fiyatlandırma burada hesaplanır. DB/UI bilmez.
 */

import { normalizeCountryCode } from "./global-commerce";

/* --------------------------- affiliate & komisyon ------------------------- */

export type CommissionInput = {
  orderTotal: number;
  orderCurrency: string;
  commissionPercent: number;
  payoutCurrency: string;
  /** 1 birim orderCurrency kaç payoutCurrency eder. */
  fxRate?: number;
};

export function calculateCommission(input: CommissionInput): {
  amount: number;
  currency: string;
  percent: number;
} {
  const percent = Math.max(0, Math.min(90, Number(input.commissionPercent) || 0));
  const gross = Math.max(0, Number(input.orderTotal) || 0) * (percent / 100);
  const sameCurrency = input.orderCurrency.toUpperCase() === input.payoutCurrency.toUpperCase();
  const rate = sameCurrency ? 1 : Number(input.fxRate) || 0;
  const amount = rate > 0 ? gross * rate : gross;
  return {
    amount: Math.round(amount * 100) / 100,
    currency: (rate > 0 ? input.payoutCurrency : input.orderCurrency).toUpperCase(),
    percent,
  };
}

/** Ortak için takip linki ve promo kodu üretir. */
export function affiliateTrackingLink(storefrontUrl: string, code: string): string {
  const base = storefrontUrl.replace(/\/+$/, "");
  return `${base}?ref=${encodeURIComponent(code)}`;
}

export function suggestAffiliateCode(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[ğ]/g, "g")
    .replace(/[ü]/g, "u")
    .replace(/[ş]/g, "s")
    .replace(/[ı]/g, "i")
    .replace(/[ö]/g, "o")
    .replace(/[ç]/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 16);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug || "ortak"}-${suffix}`;
}

/* --------------------------- tatil kampanyaları --------------------------- */

export type HolidayDefinition = {
  key: string;
  name: string;
  /** Varsayılan hedef pazarlar. */
  countries: string[];
  /** Kampanyanın kaç gün süreceği. */
  days: number;
  /** Sabit tarih (ay/gün) ya da yıl bazlı tarih tablosu. */
  fixed?: { month: number; day: number };
  dates?: Record<number, string>;
  bannerText: string;
};

export const HOLIDAY_CALENDAR: HolidayDefinition[] = [
  {
    key: "black_friday",
    name: "Black Friday",
    countries: ["US", "GB", "DE", "FR", "NL", "CA"],
    days: 4,
    dates: { 2026: "2026-11-27", 2027: "2027-11-26", 2028: "2028-11-24" },
    bannerText: "Black Friday — up to {discount}% off, worldwide shipping",
  },
  {
    key: "cyber_monday",
    name: "Cyber Monday",
    countries: ["US", "GB", "DE", "CA"],
    days: 2,
    dates: { 2026: "2026-11-30", 2027: "2027-11-29", 2028: "2028-11-27" },
    bannerText: "Cyber Monday — {discount}% off online only",
  },
  {
    key: "easter",
    name: "Paskalya (Easter)",
    countries: ["DE", "FR", "NL", "IT", "ES", "GB", "US"],
    days: 5,
    dates: { 2026: "2026-04-05", 2027: "2027-03-28", 2028: "2028-04-16" },
    bannerText: "Easter Sale — {discount}% off selected items",
  },
  {
    key: "ramadan",
    name: "Ramazan",
    countries: ["AE", "SA", "QA", "TR"],
    days: 30,
    dates: { 2026: "2026-02-18", 2027: "2027-02-07", 2028: "2028-01-28" },
    bannerText: "Ramadan Offers — {discount}% off, fast Gulf delivery",
  },
  {
    key: "eid",
    name: "Ramazan Bayramı (Eid)",
    countries: ["AE", "SA", "QA", "TR"],
    days: 4,
    dates: { 2026: "2026-03-20", 2027: "2027-03-09", 2028: "2028-02-26" },
    bannerText: "Eid Mubarak — {discount}% off gift selection",
  },
  {
    key: "labor_day",
    name: "Labor Day (ABD)",
    countries: ["US"],
    days: 4,
    fixed: { month: 9, day: 1 },
    bannerText: "Labor Day Weekend — {discount}% off",
  },
  {
    key: "singles_day",
    name: "11.11 Singles Day",
    countries: ["US", "GB", "DE", "AE"],
    days: 2,
    fixed: { month: 11, day: 11 },
    bannerText: "11.11 — {discount}% off for 48 hours",
  },
];

export type PlannedCampaign = {
  key: string;
  name: string;
  countries: string[];
  startsAt: string;
  endsAt: string;
  bannerText: string;
};

/** Verilen yıl için tatil kampanya takvimini üretir (ISO zaman damgaları). */
export function planHolidayCampaigns(year: number, discountPercent = 15): PlannedCampaign[] {
  return HOLIDAY_CALENDAR.flatMap((holiday) => {
    const dateStr = holiday.dates?.[year]
      ?? (holiday.fixed
        ? `${year}-${String(holiday.fixed.month).padStart(2, "0")}-${String(holiday.fixed.day).padStart(2, "0")}`
        : null);
    if (!dateStr) return [];
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) return [];
    const end = new Date(start.getTime() + holiday.days * 24 * 60 * 60 * 1000);
    return [
      {
        key: holiday.key,
        name: holiday.name,
        countries: holiday.countries,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        bannerText: holiday.bannerText.replace("{discount}", String(Math.round(discountPercent))),
      },
    ];
  });
}

export function campaignIsLive(
  campaign: { starts_at: string; ends_at: string; is_active: boolean },
  now = new Date(),
): boolean {
  if (!campaign.is_active) return false;
  const start = new Date(campaign.starts_at).getTime();
  const end = new Date(campaign.ends_at).getTime();
  return now.getTime() >= start && now.getTime() <= end;
}

/* ---------------------- saat dilimine duyarlı bildirim -------------------- */

/** Ülke → IANA saat dilimi (bildirim zamanı için yeterli yaklaşım). */
export const COUNTRY_TIMEZONES: Record<string, string> = {
  TR: "Europe/Istanbul",
  DE: "Europe/Berlin",
  FR: "Europe/Paris",
  NL: "Europe/Amsterdam",
  AT: "Europe/Vienna",
  BE: "Europe/Brussels",
  IT: "Europe/Rome",
  ES: "Europe/Madrid",
  GB: "Europe/London",
  US: "America/New_York",
  CA: "America/Toronto",
  AE: "Asia/Dubai",
  SA: "Asia/Riyadh",
  QA: "Asia/Qatar",
  RU: "Europe/Moscow",
};

export function countryTimezone(country: string | null | undefined): string {
  return COUNTRY_TIMEZONES[normalizeCountryCode(country, "TR")] ?? "UTC";
}

/** Bir zaman diliminin o andaki UTC farkını (dakika) hesaplar. */
export function timezoneOffsetMinutes(timeZone: string, at = new Date()): number {
  try {
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
    const parts = formatter.formatToParts(at);
    const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
    const asUtc = Date.UTC(
      pick("year"),
      pick("month") - 1,
      pick("day"),
      pick("hour") % 24,
      pick("minute"),
      pick("second"),
    );
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch {
    return 0;
  }
}

/**
 * Alıcının ülkesinde istenen yerel saate denk gelen bir sonraki UTC anını döner.
 * Böylece e-posta/WhatsApp bildirimleri gece yarısı değil, uygun saatte gider.
 */
export function nextLocalSendTime(
  country: string | null | undefined,
  localHour: number,
  from = new Date(),
): { timezone: string; sendAt: string; localHour: number } {
  const timezone = countryTimezone(country);
  const offset = timezoneOffsetMinutes(timezone, from);
  const hour = Math.max(0, Math.min(23, Math.round(localHour)));
  const localNow = new Date(from.getTime() + offset * 60000);
  const target = new Date(localNow);
  target.setUTCHours(hour, 0, 0, 0);
  if (target.getTime() <= localNow.getTime()) {
    target.setTime(target.getTime() + 24 * 60 * 60 * 1000);
  }
  return {
    timezone,
    localHour: hour,
    sendAt: new Date(target.getTime() - offset * 60000).toISOString(),
  };
}

/* --------------------------- depo yönlendirme ---------------------------- */

const REGION_OF_COUNTRY: Record<string, string> = {
  TR: "TR",
  DE: "EU",
  FR: "EU",
  NL: "EU",
  AT: "EU",
  BE: "EU",
  IT: "EU",
  ES: "EU",
  GB: "UK",
  US: "NA",
  CA: "NA",
  AE: "GCC",
  SA: "GCC",
  QA: "GCC",
  RU: "OTHER",
};

/** Hedef ülke ile depo ülkesi arasındaki yakınlık skoru (küçük = yakın). */
export function warehouseDistanceScore(warehouseCountry: string, destinationCountry: string): number {
  const from = normalizeCountryCode(warehouseCountry, "TR");
  const to = normalizeCountryCode(destinationCountry, "TR");
  if (from === to) return 0;
  const fromRegion = REGION_OF_COUNTRY[from] ?? "OTHER";
  const toRegion = REGION_OF_COUNTRY[to] ?? "OTHER";
  if (fromRegion === toRegion) return 1;
  if ((fromRegion === "EU" && toRegion === "UK") || (fromRegion === "UK" && toRegion === "EU")) return 2;
  if ((fromRegion === "TR" && toRegion === "GCC") || (fromRegion === "GCC" && toRegion === "TR")) return 3;
  if ((fromRegion === "TR" && toRegion === "EU") || (fromRegion === "EU" && toRegion === "TR")) return 3;
  return 5;
}

export type RoutableWarehouse = {
  id: string;
  code: string;
  name: string;
  provider: string;
  country_code: string;
  priority: number;
  is_active: boolean;
  available?: number | null;
};

export type RoutingDecision = {
  warehouse: RoutableWarehouse | null;
  reason: string;
  ranked: Array<{ warehouse: RoutableWarehouse; score: number; distance: number }>;
};

/**
 * Siparişi hedefe en yakın, stoğu yeten ve önceliği yüksek depoya yönlendirir.
 * Stok bilgisi verilmezse yalnızca yakınlık + öncelik kullanılır.
 */
export function routeOrderToWarehouse(
  warehouses: RoutableWarehouse[],
  destinationCountry: string,
  requiredQuantity = 1,
): RoutingDecision {
  const eligible = warehouses.filter(
    (w) => w.is_active && (w.available == null || w.available >= requiredQuantity),
  );
  const ranked = eligible
    .map((warehouse) => {
      const distance = warehouseDistanceScore(warehouse.country_code, destinationCountry);
      return { warehouse, distance, score: distance * 10 - Math.max(0, warehouse.priority) };
    })
    .sort((a, b) => a.score - b.score);

  if (ranked.length === 0) {
    return { warehouse: null, reason: "Uygun ve stoğu yeten depo bulunamadı", ranked: [] };
  }
  const best = ranked[0]!;
  const reason =
    best.distance === 0
      ? `${best.warehouse.name} yurt içi teslim (${best.warehouse.country_code})`
      : `${best.warehouse.name} hedefe en yakın depo (${best.warehouse.country_code} → ${normalizeCountryCode(destinationCountry)})`;
  return { warehouse: best.warehouse, reason, ranked };
}

/* ------------------------ taşıyıcı karşılaştırma -------------------------- */

export type RateQuote = {
  id?: string;
  carrier_code: string;
  service?: string | null;
  cost: number;
  currency: string;
  transit_days?: number | null;
  source?: string;
};

export type CarrierComparison = {
  cheapest: RateQuote | null;
  fastest: RateQuote | null;
  ranked: Array<RateQuote & { costTry?: number }>;
};

/** Taşıyıcı tekliflerini en ucuz ve en hızlı olacak şekilde sıralar. */
export function compareCarrierQuotes(
  quotes: RateQuote[],
  fxToBase: Record<string, number> = {},
  strategy: "cheapest" | "fastest" = "cheapest",
): CarrierComparison {
  if (quotes.length === 0) return { cheapest: null, fastest: null, ranked: [] };
  const withBase = quotes.map((quote) => {
    const rate = fxToBase[quote.currency.toUpperCase()] ?? 1;
    return { ...quote, costTry: Math.round(quote.cost * rate * 100) / 100 };
  });
  const byCost = [...withBase].sort((a, b) => (a.costTry ?? a.cost) - (b.costTry ?? b.cost));
  const bySpeed = [...withBase].sort(
    (a, b) => (a.transit_days ?? 99) - (b.transit_days ?? 99) || (a.costTry ?? 0) - (b.costTry ?? 0),
  );
  return {
    cheapest: byCost[0] ?? null,
    fastest: bySpeed[0] ?? null,
    ranked: strategy === "fastest" ? bySpeed : byCost,
  };
}

/* ------------------------ beden & ölçü dönüşümü -------------------------- */

export type SizeSystem = "EU" | "US" | "UK";

const APPAREL_SIZES: Array<{ EU: string; US: string; UK: string; alpha: string }> = [
  { EU: "32", US: "0", UK: "4", alpha: "XXS" },
  { EU: "34", US: "2", UK: "6", alpha: "XS" },
  { EU: "36", US: "4", UK: "8", alpha: "S" },
  { EU: "38", US: "6", UK: "10", alpha: "M" },
  { EU: "40", US: "8", UK: "12", alpha: "L" },
  { EU: "42", US: "10", UK: "14", alpha: "XL" },
  { EU: "44", US: "12", UK: "16", alpha: "XXL" },
  { EU: "46", US: "14", UK: "18", alpha: "3XL" },
];

const SHOE_SIZES: Array<{ EU: string; US: string; UK: string }> = [
  { EU: "36", US: "5.5", UK: "3.5" },
  { EU: "37", US: "6.5", UK: "4.5" },
  { EU: "38", US: "7.5", UK: "5.5" },
  { EU: "39", US: "8", UK: "6" },
  { EU: "40", US: "9", UK: "7" },
  { EU: "41", US: "9.5", UK: "7.5" },
  { EU: "42", US: "10.5", UK: "8.5" },
  { EU: "43", US: "11", UK: "9" },
  { EU: "44", US: "11.5", UK: "10" },
  { EU: "45", US: "12.5", UK: "11" },
];

/** Ziyaretçinin ülkesine göre varsayılan beden sistemi. */
export function sizeSystemForCountry(country: string | null | undefined): SizeSystem {
  const code = normalizeCountryCode(country, "TR");
  if (code === "US" || code === "CA") return "US";
  if (code === "GB") return "UK";
  return "EU";
}

export function convertApparelSize(
  value: string,
  from: SizeSystem | "ALPHA",
  to: SizeSystem | "ALPHA",
): string | null {
  const needle = value.trim().toUpperCase();
  const key = (system: SizeSystem | "ALPHA") => (system === "ALPHA" ? "alpha" : system) as
    | "EU"
    | "US"
    | "UK"
    | "alpha";
  const row = APPAREL_SIZES.find((entry) => entry[key(from)].toUpperCase() === needle);
  return row ? row[key(to)] : null;
}

export function convertShoeSize(value: string, from: SizeSystem, to: SizeSystem): string | null {
  const needle = value.trim();
  const row = SHOE_SIZES.find((entry) => entry[from] === needle);
  return row ? row[to] : null;
}

export function apparelSizeTable() {
  return APPAREL_SIZES;
}

export function shoeSizeTable() {
  return SHOE_SIZES;
}

export function cmToInch(cm: number): number {
  return Math.round(cm * 0.393701 * 100) / 100;
}

export function inchToCm(inch: number): number {
  return Math.round(inch * 2.54 * 100) / 100;
}

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 100) / 100;
}

export function lbsToKg(lbs: number): number {
  return Math.round((lbs / 2.20462) * 100) / 100;
}

/** Ülkeye göre ölçü birimi tercihi (ABD/İngiltere imperial, diğerleri metrik). */
export function unitSystemForCountry(country: string | null | undefined): "metric" | "imperial" {
  const code = normalizeCountryCode(country, "TR");
  return code === "US" || code === "GB" ? "imperial" : "metric";
}

/* -------------------------- B2B toptan fiyatlama ------------------------- */

export type WholesaleTier = {
  min_quantity: number;
  discount_percent: number;
  is_active?: boolean;
};

export type WholesaleQuoteLine = {
  title: string;
  unitPrice: number;
  quantity: number;
  discountPercent: number;
  lineTotal: number;
};

/** Adet aralığına uyan en yüksek iskontoyu bulur. */
export function resolveWholesaleTier(tiers: WholesaleTier[], quantity: number): WholesaleTier | null {
  const eligible = tiers
    .filter((tier) => tier.is_active !== false && quantity >= tier.min_quantity)
    .sort((a, b) => b.discount_percent - a.discount_percent);
  return eligible[0] ?? null;
}

export function meetsMoq(quantity: number, moq: number): boolean {
  return quantity >= Math.max(1, Math.round(moq || 1));
}

/** Toptan teklif (RFQ) kalemlerini ve toplamı hesaplar. */
export function buildWholesaleQuote(
  lines: Array<{ title: string; unitPrice: number; quantity: number }>,
  tiers: WholesaleTier[],
): { lines: WholesaleQuoteLine[]; subtotal: number; discountTotal: number; total: number } {
  const computed = lines.map((line) => {
    const tier = resolveWholesaleTier(tiers, line.quantity);
    const discountPercent = tier?.discount_percent ?? 0;
    const gross = line.unitPrice * line.quantity;
    const lineTotal = Math.round(gross * (1 - discountPercent / 100) * 100) / 100;
    return { ...line, discountPercent, lineTotal };
  });
  const subtotal = Math.round(computed.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0) * 100) / 100;
  const total = Math.round(computed.reduce((sum, l) => sum + l.lineTotal, 0) * 100) / 100;
  return {
    lines: computed,
    subtotal,
    discountTotal: Math.round((subtotal - total) * 100) / 100,
    total,
  };
}

/* --------------------------- pazaryeri kanalları ------------------------- */

export const GLOBAL_MARKETPLACES = [
  { code: "amazon_us", name: "Amazon US", currency: "USD", region: "US" },
  { code: "amazon_eu", name: "Amazon EU", currency: "EUR", region: "EU" },
  { code: "etsy", name: "Etsy", currency: "USD", region: "US" },
  { code: "ebay", name: "eBay", currency: "USD", region: "US" },
  { code: "walmart", name: "Walmart", currency: "USD", region: "US" },
  { code: "allegro", name: "Allegro", currency: "EUR", region: "EU" },
  { code: "noon", name: "Noon", currency: "AED", region: "GCC" },
] as const;

export type GlobalMarketplaceCode = (typeof GLOBAL_MARKETPLACES)[number]["code"];

export function marketplaceLabel(code: string): string {
  return GLOBAL_MARKETPLACES.find((row) => row.code === code)?.name ?? code;
}

/* --------------------------- iade oranı analizi -------------------------- */

export function returnRate(orders: number, returns: number): number {
  if (orders <= 0) return 0;
  return Math.round((returns / orders) * 1000) / 10;
}
