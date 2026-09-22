/**
 * PricingEngine — besleme fiyatlandırma kuralları: KDV, kâr marjı (sabit veya
 * kademeli), pazaryeri gideri ve yuvarlama. Tarayıcı ve sunucuda kullanılabilir.
 */

export type PricingTier = { min: number; max: number | null; margin: number; addAmount: number };

export type PricingRules = {
  marginType: "flat" | "tiered";
  flatMarginPercent: number;
  flatAddAmount: number;
  vatAction: "none" | "add_vat" | "remove_vat";
  vatRate: number;
  roundingType: "none" | "round_99" | "round_90" | "integer";
  tieredMargins: PricingTier[];
  marketplaceFees: { commissionPercent: number; shippingFee: number };
};

export const DEFAULT_PRICING_RULES: PricingRules = {
  marginType: "flat",
  flatMarginPercent: 0,
  flatAddAmount: 0,
  vatAction: "none",
  vatRate: 20,
  roundingType: "none",
  tieredMargins: [],
  marketplaceFees: { commissionPercent: 0, shippingFee: 0 },
};

const num = (value: unknown, fallback: number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asObject = (raw: unknown): Record<string, unknown> =>
  raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

/** Veritabanındaki `pricing_rules` JSON'unu güvenli biçimde okur. */
export function parsePricingRules(raw: unknown): PricingRules {
  const source = asObject(raw);
  const fees = asObject(source["marketplace_fees"]);
  const tiers = Array.isArray(source["tiered_margins"]) ? source["tiered_margins"] : [];
  const vatAction = source["vat_action"];
  const rounding = source["rounding_type"];

  return {
    marginType: source["margin_type"] === "tiered" ? "tiered" : "flat",
    flatMarginPercent: num(source["flat_margin_percent"], 0),
    flatAddAmount: num(source["flat_add_amount"], 0),
    vatAction: vatAction === "add_vat" || vatAction === "remove_vat" ? vatAction : "none",
    vatRate: Math.max(0, num(source["vat_rate"], 20)),
    roundingType:
      rounding === "round_99" || rounding === "round_90" || rounding === "integer" ? rounding : "none",
    tieredMargins: tiers.slice(0, 20).map((item) => {
      const tier = asObject(item);
      const max = tier["max"];
      return {
        min: Math.max(0, num(tier["min"], 0)),
        max: max === null || max === undefined || max === "" ? null : num(max, 0),
        margin: num(tier["margin"], 0),
        addAmount: num(tier["add_amount"], 0),
      };
    }),
    marketplaceFees: {
      commissionPercent: Math.max(0, num(fees["commission_percent"], 0)),
      shippingFee: Math.max(0, num(fees["shipping_fee"], 0)),
    },
  };
}

/** `PricingRules` nesnesini veritabanı JSON biçimine çevirir. */
export function serializePricingRules(rules: PricingRules): Record<string, unknown> {
  return {
    margin_type: rules.marginType,
    flat_margin_percent: rules.flatMarginPercent,
    flat_add_amount: rules.flatAddAmount,
    vat_action: rules.vatAction,
    vat_rate: rules.vatRate,
    rounding_type: rules.roundingType,
    tiered_margins: rules.tieredMargins.map((tier) => ({
      min: tier.min,
      max: tier.max,
      margin: tier.margin,
      add_amount: tier.addAmount,
    })),
    marketplace_fees: {
      commission_percent: rules.marketplaceFees.commissionPercent,
      shipping_fee: rules.marketplaceFees.shippingFee,
    },
  };
}

/** Hiçbir kural tanımlı değilse fiyat olduğu gibi kalır. */
export function pricingRulesActive(rules: PricingRules): boolean {
  if (rules.vatAction !== "none") return true;
  if (rules.roundingType !== "none") return true;
  if (rules.marketplaceFees.commissionPercent > 0 || rules.marketplaceFees.shippingFee > 0) return true;
  if (rules.marginType === "tiered") return rules.tieredMargins.length > 0;
  return rules.flatMarginPercent !== 0 || rules.flatAddAmount !== 0;
}

/** Ham alış fiyatına tanımlı kuralları sırayla uygular. */
export function calculateFinalPrice(basePrice: number, rules: PricingRules): number {
  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0;

  let price = basePrice;

  // 1. KDV
  if (rules.vatAction === "add_vat") price += price * (rules.vatRate / 100);
  else if (rules.vatAction === "remove_vat") price /= 1 + rules.vatRate / 100;

  // 2. Kâr marjı (sabit veya kademeli — kademe ham fiyata göre seçilir)
  if (rules.marginType === "flat") {
    price += price * (rules.flatMarginPercent / 100);
    price += rules.flatAddAmount;
  } else {
    for (const tier of rules.tieredMargins) {
      const max = tier.max ?? Number.POSITIVE_INFINITY;
      if (basePrice >= tier.min && basePrice < max) {
        price += price * (tier.margin / 100);
        price += tier.addAmount;
        break;
      }
    }
  }

  // 3. Pazaryeri komisyonu ve kargo
  const { commissionPercent, shippingFee } = rules.marketplaceFees;
  if (commissionPercent > 0) price += price * (commissionPercent / 100);
  price += shippingFee;

  // 4. Yuvarlama
  if (rules.roundingType === "round_99") price = Math.floor(price) + 0.99;
  else if (rules.roundingType === "round_90") price = Math.floor(price) + 0.9;
  else if (rules.roundingType === "integer") price = Math.round(price);
  else price = Math.round(price * 100) / 100;

  return Math.max(0, price);
}
