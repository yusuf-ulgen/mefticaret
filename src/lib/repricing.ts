/**
 * Otomatik yeniden fiyatlama motoru — saf hesaplama katmanı (test edilebilir, veri okumaz).
 * Rakip fiyatı + kural → önerilen fiyat. Taban/tavan, kâr marjı ve maksimum değişim sınırları
 * burada uygulanır; veritabanına yazma kararı sunucu katmanına aittir.
 */

import { applyRounding, changePercent, marginPercent, type RoundingMode } from "@/lib/pricing-engine";

export type RepricingStrategy = "match" | "undercut_amount" | "undercut_percent" | "premium_percent";

export const REPRICING_STRATEGY_LABELS: Record<RepricingStrategy, string> = {
  match: "Rakip fiyatına eşitle",
  undercut_amount: "Rakibin altına (tutar)",
  undercut_percent: "Rakibin altına (yüzde)",
  premium_percent: "Rakibin üstünde (yüzde)",
};

export type RepricingRuleInput = {
  strategy: RepricingStrategy;
  value: number;
  minMarginPct: number;
  floorPrice: number | null;
  ceilingPrice: number | null;
  maxChangePct: number;
  rounding: RoundingMode;
};

export type RepricingComputation = {
  currentPrice: number;
  competitorPrice: number | null;
  costPrice: number | null;
  rule: RepricingRuleInput;
  decimals?: number;
};

export type RepricingSuggestion = {
  suggestedPrice: number;
  changePct: number;
  marginPct: number | null;
  reasons: string[];
  /** Fiyat gerçekten değişiyor mu (yuvarlama sonrası fark var mı). */
  shouldChange: boolean;
  blocked: boolean;
};

function fmt(value: number): string {
  return value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Rakip fiyatına stratejiyi uygular (sınırlardan önce). */
export function targetFromStrategy(competitorPrice: number, rule: RepricingRuleInput): number {
  const value = Number.isFinite(rule.value) ? rule.value : 0;
  switch (rule.strategy) {
    case "match":
      return competitorPrice;
    case "undercut_amount":
      return competitorPrice - value;
    case "undercut_percent":
      return competitorPrice * (1 - value / 100);
    case "premium_percent":
      return competitorPrice * (1 + value / 100);
    default:
      return competitorPrice;
  }
}

/** Kural + rakip fiyatından önerilen fiyatı ve gerekçeleri üretir. */
export function computeRepricing(input: RepricingComputation): RepricingSuggestion {
  const reasons: string[] = [];
  const decimals = input.decimals ?? 2;
  const current = Number(input.currentPrice) || 0;

  if (input.competitorPrice == null || !Number.isFinite(input.competitorPrice) || input.competitorPrice <= 0) {
    return {
      suggestedPrice: current,
      changePct: 0,
      marginPct: marginPercent(current, input.costPrice ?? 0),
      reasons: ["Rakip fiyatı bilinmiyor, fiyat değiştirilmedi."],
      shouldChange: false,
      blocked: true,
    };
  }

  let target = targetFromStrategy(input.competitorPrice, input.rule);
  reasons.push(
    `${REPRICING_STRATEGY_LABELS[input.rule.strategy]} → ${fmt(target)} (rakip ${fmt(input.competitorPrice)})`,
  );

  // En az kâr marjı: maliyet biliniyorsa marjı koruyan taban fiyat hesaplanır.
  const cost = input.costPrice != null && input.costPrice > 0 ? input.costPrice : null;
  if (cost != null && input.rule.minMarginPct > 0 && input.rule.minMarginPct < 100) {
    const marginFloor = cost / (1 - input.rule.minMarginPct / 100);
    if (target < marginFloor) {
      target = marginFloor;
      reasons.push(`En az %${fmt(input.rule.minMarginPct)} kâr marjı için ${fmt(marginFloor)}'e yükseltildi.`);
    }
  }

  if (input.rule.floorPrice != null && target < input.rule.floorPrice) {
    target = input.rule.floorPrice;
    reasons.push(`Taban fiyat sınırı uygulandı (${fmt(input.rule.floorPrice)}).`);
  }
  if (input.rule.ceilingPrice != null && target > input.rule.ceilingPrice) {
    target = input.rule.ceilingPrice;
    reasons.push(`Tavan fiyat sınırı uygulandı (${fmt(input.rule.ceilingPrice)}).`);
  }

  // Tek seferde aşırı fiyat oynaması engellenir.
  const maxChange = Number.isFinite(input.rule.maxChangePct) ? Math.abs(input.rule.maxChangePct) : 0;
  if (current > 0 && maxChange > 0) {
    const upper = current * (1 + maxChange / 100);
    const lower = current * (1 - maxChange / 100);
    if (target > upper) {
      target = upper;
      reasons.push(`Tek seferde en fazla %${fmt(maxChange)} artış sınırı uygulandı.`);
    } else if (target < lower) {
      target = lower;
      reasons.push(`Tek seferde en fazla %${fmt(maxChange)} indirim sınırı uygulandı.`);
    }
  }

  const suggested = applyRounding(Math.max(0, target), input.rule.rounding, decimals);
  const margin = cost != null ? marginPercent(suggested, cost) : null;
  const blocked = cost != null && margin != null && margin < 0;

  if (blocked) reasons.push("Önerilen fiyat maliyetin altında kalıyor; uygulanmadı.");

  return {
    suggestedPrice: blocked ? current : suggested,
    changePct: changePercent(current, blocked ? current : suggested),
    marginPct: margin,
    reasons,
    shouldChange: !blocked && Math.abs(suggested - current) >= 0.01,
    blocked,
  };
}
