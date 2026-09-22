/**
 * Güvenlik sınırları (guardrail): içe aktarımda anormal fiyat/stok verisini
 * canlı ürünlere yazmadan önce yakalar ve incelemeye (karantinaya) alır.
 *
 * Saf mantık — tarayıcı ve sunucu tarafında paylaşılır.
 */

export const QUARANTINE_ISSUE_TYPES = [
  "ZERO_PRICE",
  "PRICE_DROP_LIMIT",
  "PRICE_INCREASE_LIMIT",
  "INVALID_BARCODE",
] as const;
export type QuarantineIssueType = (typeof QUARANTINE_ISSUE_TYPES)[number];

export const QUARANTINE_ISSUE_LABELS: Record<QuarantineIssueType, string> = {
  ZERO_PRICE: "Fiyat sıfır veya eksi",
  PRICE_DROP_LIMIT: "Aşırı fiyat düşüşü",
  PRICE_INCREASE_LIMIT: "Aşırı fiyat artışı",
  INVALID_BARCODE: "Geçersiz barkod",
};

export const QUARANTINE_STATUSES = ["pending_review", "approved", "rejected"] as const;
export type QuarantineStatus = (typeof QUARANTINE_STATUSES)[number];

export const QUARANTINE_STATUS_LABELS: Record<QuarantineStatus, string> = {
  pending_review: "İncelenecek",
  approved: "Onaylandı",
  rejected: "Reddedildi",
};

export const ZERO_PRICE_ACTIONS = ["quarantine", "skip", "allow"] as const;
export type ZeroPriceAction = (typeof ZERO_PRICE_ACTIONS)[number];

export const ZERO_STOCK_ACTIONS = ["update", "quarantine"] as const;
export type ZeroStockAction = (typeof ZERO_STOCK_ACTIONS)[number];

export type GuardrailConfig = {
  enabled: boolean;
  maxPriceDropPercent: number;
  maxPriceIncreasePercent: number;
  zeroPriceAction: ZeroPriceAction;
  zeroStockAction: ZeroStockAction;
  autoQuarantine: boolean;
  notificationEmail: string;
};

export const DEFAULT_GUARDRAIL_CONFIG: GuardrailConfig = {
  enabled: true,
  maxPriceDropPercent: 50,
  maxPriceIncreasePercent: 200,
  zeroPriceAction: "quarantine",
  zeroStockAction: "update",
  autoQuarantine: true,
  notificationEmail: "",
};

const clampPercent = (value: unknown, fallback: number): number => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return Math.min(num, 100000);
};

/** Veritabanı JSON'unu güvenli okur; snake_case ve camelCase kabul eder. */
export function parseGuardrailConfig(value: unknown): GuardrailConfig {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const pick = (a: string, b: string): unknown => raw[a] ?? raw[b];
  const zeroPrice = pick("zero_price_action", "zeroPriceAction");
  const zeroStock = pick("zero_stock_action", "zeroStockAction");
  const email = pick("notification_email", "notificationEmail");
  return {
    enabled: typeof raw["enabled"] === "boolean" ? raw["enabled"] : DEFAULT_GUARDRAIL_CONFIG.enabled,
    maxPriceDropPercent: clampPercent(
      pick("max_price_drop_percent", "maxPriceDropPercent"),
      DEFAULT_GUARDRAIL_CONFIG.maxPriceDropPercent,
    ),
    maxPriceIncreasePercent: clampPercent(
      pick("max_price_increase_percent", "maxPriceIncreasePercent"),
      DEFAULT_GUARDRAIL_CONFIG.maxPriceIncreasePercent,
    ),
    zeroPriceAction: ZERO_PRICE_ACTIONS.includes(zeroPrice as ZeroPriceAction)
      ? (zeroPrice as ZeroPriceAction)
      : DEFAULT_GUARDRAIL_CONFIG.zeroPriceAction,
    zeroStockAction: ZERO_STOCK_ACTIONS.includes(zeroStock as ZeroStockAction)
      ? (zeroStock as ZeroStockAction)
      : DEFAULT_GUARDRAIL_CONFIG.zeroStockAction,
    autoQuarantine:
      typeof pick("auto_quarantine", "autoQuarantine") === "boolean"
        ? (pick("auto_quarantine", "autoQuarantine") as boolean)
        : DEFAULT_GUARDRAIL_CONFIG.autoQuarantine,
    notificationEmail: typeof email === "string" ? email.trim().slice(0, 200) : "",
  };
}

export function serializeGuardrailConfig(config: GuardrailConfig): Record<string, unknown> {
  return {
    enabled: config.enabled,
    max_price_drop_percent: config.maxPriceDropPercent,
    max_price_increase_percent: config.maxPriceIncreasePercent,
    zero_price_action: config.zeroPriceAction,
    zero_stock_action: config.zeroStockAction,
    auto_quarantine: config.autoQuarantine,
    notification_email: config.notificationEmail.trim(),
  };
}

export type GuardrailVerdict =
  | { safe: true }
  | { safe: false; issueType: QuarantineIssueType; quarantine: boolean; reason: string };

/**
 * Bir ürünün canlıya yazılmasının güvenli olup olmadığını söyler.
 * Yeni üründe (mevcut fiyat yok) yalnızca sıfır fiyat ve stok kuralı işler.
 */
export function checkProductSafety(input: {
  newPrice: number;
  newStock: number;
  existingPrice: number | null;
  config: GuardrailConfig;
}): GuardrailVerdict {
  const { config } = input;
  if (!config.enabled) return { safe: true };

  const quarantine = config.autoQuarantine;

  if (!(input.newPrice > 0)) {
    if (config.zeroPriceAction === "allow") return { safe: true };
    return {
      safe: false,
      issueType: "ZERO_PRICE",
      quarantine: config.zeroPriceAction === "quarantine" && quarantine,
      reason: "Gelen fiyat sıfır veya eksi",
    };
  }

  if (input.newStock <= 0 && config.zeroStockAction === "quarantine") {
    return {
      safe: false,
      issueType: "ZERO_PRICE",
      quarantine,
      reason: "Gelen stok sıfır",
    };
  }

  const oldPrice = input.existingPrice ?? 0;
  if (oldPrice > 0) {
    const changePercent = ((input.newPrice - oldPrice) / oldPrice) * 100;
    if (changePercent < 0 && Math.abs(changePercent) >= config.maxPriceDropPercent) {
      return {
        safe: false,
        issueType: "PRICE_DROP_LIMIT",
        quarantine,
        reason: `Fiyat %${Math.abs(Math.round(changePercent))} düştü (sınır %${config.maxPriceDropPercent})`,
      };
    }
    if (changePercent > 0 && changePercent >= config.maxPriceIncreasePercent) {
      return {
        safe: false,
        issueType: "PRICE_INCREASE_LIMIT",
        quarantine,
        reason: `Fiyat %${Math.round(changePercent)} arttı (sınır %${config.maxPriceIncreasePercent})`,
      };
    }
  }

  return { safe: true };
}
